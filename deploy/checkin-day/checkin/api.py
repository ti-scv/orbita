
from core.features import unit_feature_enabled
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import get_unit
from .models import CheckIn, Configuration
from .services import Conflict, transition


class CheckInSerializer(serializers.ModelSerializer):
    source = serializers.SerializerMethodField()
    label = serializers.SerializerMethodField()
    events = serializers.SerializerMethodField()
    summary = serializers.SerializerMethodField()

    def get_summary(self, obj):
        from .support import summary
        return summary(obj)

    def get_source(self, obj):
        return "appointment" if obj.appointment_id else "booking"

    def get_label(self, obj):
        return obj.attendance if obj.attendance != "unknown" else obj.response

    def get_events(self, obj):
        if getattr(self.context.get("view"),"action",None)!="retrieve":return []
        return list(obj.events.values("id", "origin", "actor_id", "reason", "previous_response", "response", "previous_attendance", "attendance", "evidence", "occurred_at", "recorded_at", "version"))

    class Meta:
        model = CheckIn
        fields = ("id", "unit", "appointment", "booking", "source", "source_revision", "cycle", "scheduled_at", "planned_send_at", "sent_at", "response_deadline", "responded_at", "attendance_checked_at", "message_id", "provider_message_id", "response", "attendance", "label", "version", "created_at", "updated_at", "events", "summary")
        read_only_fields = fields


class TransitionInput(serializers.Serializer):
    version = serializers.IntegerField(min_value=1)
    idempotency_key = serializers.CharField(max_length=128)
    response = serializers.ChoiceField(choices=CheckIn.Response.choices, required=False)
    attendance = serializers.ChoiceField(choices=CheckIn.Attendance.choices, required=False)
    reason = serializers.CharField(max_length=500)

    def validate(self, data):
        if set(self.initial_data) - set(self.fields):
            raise serializers.ValidationError("Campos desconhecidos.")
        if "response" not in data and "attendance" not in data:
            raise serializers.ValidationError("Informe resposta ou comparecimento.")
        return data


class CheckInViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CheckInSerializer

    def get_queryset(self):
        unit = get_unit(self.request)
        if not unit_feature_enabled(unit, "checkin"):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Check-in desabilitado nesta unidade.")
        qs = CheckIn.objects.filter(unit=unit).select_related("appointment", "booking").order_by("-scheduled_at", "-id")
        params = self.request.query_params
        source = params.get("source")
        if source:
            if source not in ("appointment", "booking"):
                raise ValidationError({"source": "Origem inválida."})
            qs = qs.filter(**{source + "__isnull": False})
        for field, choices in (("response", CheckIn.Response.values), ("attendance", CheckIn.Attendance.values)):
            value = params.get(field)
            if value:
                if value not in choices:
                    raise ValidationError({field: "Estado inválido."})
                qs = qs.filter(**{field: value})
        if params.get("search"):
            from django.db.models import Q
            term=params["search"][:150]
            qs=qs.filter(Q(appointment__patient__icontains=term)|Q(booking__conversation__patient__icontains=term)|Q(appointment__external_id__icontains=term))
        config = Configuration.objects.filter(unit=unit).first()
        zone = ZoneInfo(config.timezone if config else "America/Sao_Paulo")
        for param, lookup in (("start", "gte"), ("end", "lt")):
            if params.get(param):
                try:
                    day = date.fromisoformat(params[param])
                    if param == "end":
                        day += timedelta(days=1)
                    boundary = datetime.combine(day, time.min, tzinfo=zone)
                except (ValueError, OverflowError):
                    raise ValidationError({param: "Data inválida."}) from None
                qs = qs.filter(**{"scheduled_at__" + lookup: boundary})
        if not params.get("start") and not params.get("end"):
            from django.utils import timezone
            today=timezone.now().astimezone(zone).date()
            qs=qs.filter(scheduled_at__gte=datetime.combine(today,time.min,tzinfo=zone),scheduled_at__lt=datetime.combine(today+timedelta(days=1),time.min,tzinfo=zone))
        return qs

    @action(detail=True, methods=["post"])
    def transition(self, request, pk=None):
        record = self.get_object()
        serializer = TransitionInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            data = serializer.validated_data
            evidence = {"requested_fields": sorted(key for key in ("response", "attendance") if key in data)}
            record, event = transition(unit=get_unit(request), checkin_id=record.pk, origin="operator", actor=request.user, evidence=evidence, **data)
        except Conflict as exc:
            return Response({"detail": exc.messages}, status=409)
        except DjangoValidationError as exc:
            raise ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages) from None
        return Response({"checkin": CheckInSerializer(record).data, "event_id": event.pk})


class ConfigurationSerializer(serializers.ModelSerializer):
    def validate(self, data):
        unknown = set(self.initial_data) - set(self.fields)
        if unknown:
            raise serializers.ValidationError("Campos desconhecidos: " + ", ".join(sorted(unknown)))
        from .support import validate_template
        validate_template(data, self.instance)
        return data

    class Meta:
        model = Configuration
        fields = ("enabled", "booking_enabled", "appointment_enabled", "oracle_enabled", "channel", "timezone", "weekdays", "business_start", "business_end", "holidays", "lead_value", "lead_unit", "template", "parameter_map")


class ConfigurationView(APIView):
    def get(self, request):
        unit = get_unit(request)
        config = Configuration.objects.filter(unit=unit).first() or Configuration(unit=unit)
        return Response(ConfigurationSerializer(config).data)

    def patch(self, request):
        unit = get_unit(request, ["admin"])
        with transaction.atomic():
            config, _ = Configuration.objects.select_for_update().get_or_create(unit=unit)
            serializer = ConfigurationSerializer(config, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            try:
                serializer.save()
                from .programming import calculate_schedule, ScheduleError
                from messaging.models import Message
                from django.utils import timezone
                pending=CheckIn.objects.select_for_update().filter(unit=unit,response="pending",sent_at__isnull=True)
                for row in pending.iterator():
                    if row.message_id:
                        message=Message.objects.filter(pk=row.message_id,unit=unit).first()
                        if message and message.state not in ("preview","queued","blocked","cancelled"):
                            continue
                        if message:
                            Message.objects.filter(pk=message.pk,state__in=("preview","queued","blocked")).update(state="cancelled")
                    try:
                        plan=calculate_schedule(row.scheduled_at,config,timezone.now())
                        row.planned_send_at,row.response_deadline=plan.planned_send_at,plan.response_deadline
                    except ScheduleError:
                        row.planned_send_at=None
                    row.message_id=""
                    row.save()

            except DjangoValidationError as exc:
                raise ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages) from None
        return Response(serializer.data)


def source_label(source, request):
    from core.access import LEVELS, effective_permissions
    if not unit_feature_enabled(source.unit, "checkin") or LEVELS[effective_permissions(request, source.unit).get("checkin", "none")] < 1:
        return None
    filters = {"appointment": source, "source_revision": source.revision} if hasattr(source, "revision") else {"booking": source, "source_revision": 1}
    row = CheckIn.objects.filter(unit=source.unit, **filters).order_by("-cycle").first()
    return {"id": row.pk, "response": row.response, "attendance": row.attendance, "label": row.attendance if row.attendance != "unknown" else row.response, "version": row.version} if row else None
