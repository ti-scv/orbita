import math
import re
import zoneinfo
from datetime import date, datetime, time
from django.db import models
from rest_framework import serializers, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from core.features import unit_feature_enabled
from core.permissions import get_unit
from operations.models import ReportConnection
from messaging.models import MetaConfiguration, Template
from surveys.models import SurveyAutomation, SurveyExecution
from surveys.inspect import inspect_table_columns, fetch_survey_candidates
from surveys.sender import (
    send_meta_survey_template,
    format_patient_first_name,
    normalize_recipient_phone,
    build_survey_url,
)
from surveys.runner import run_survey_automation


def analyze_template_components(components: list) -> dict:
    body_text = ""
    body_vars = []
    button_url = ""
    button_text = ""
    button_has_var = False
    base_url = ""
    header_text = ""

    for comp in components or []:
        c_type = (comp.get("type") or "").upper()
        if c_type == "BODY":
            body_text = comp.get("text", "")
            body_vars = re.findall(r"\{\{(\d+)\}\}", body_text)
        elif c_type == "HEADER":
            header_text = comp.get("text", "")
        elif c_type == "BUTTONS":
            for b in comp.get("buttons", []):
                if (b.get("type") or "").upper() == "URL":
                    button_text = b.get("text", "")
                    button_url = b.get("url", "")
                    if "{{1}}" in button_url:
                        button_has_var = True
                        clean_base = re.sub(r"[?&][a-zA-Z0-9_-]+=\{\{1\}\}.*$", "", button_url)
                        clean_base = re.sub(r"\{\{1\}\}.*$", "", clean_base)
                        base_url = clean_base.rstrip("?&")
                    else:
                        base_url = button_url

    return {
        "body_text": body_text,
        "body_variables": body_vars,
        "body_variables_count": len(set(body_vars)),
        "header_text": header_text,
        "has_url_button": bool(button_url),
        "button_text": button_text,
        "button_url": button_url,
        "button_has_variable": button_has_var,
        "extracted_base_url": base_url,
        "is_survey_ready": bool(button_has_var and len(body_vars) >= 1),
    }


class SurveyAutomationSerializer(serializers.ModelSerializer):
    connection_name = serializers.CharField(source="connection.name", read_only=True)

    class Meta:
        model = SurveyAutomation
        fields = [
            "id",
            "name",
            "connection",
            "connection_name",
            "table_name",
            "column_mapping",
            "template_name",
            "template_language",
            "survey_base_url",
            "button_parameter_type",
            "schedule_type",
            "discharge_period",
            "interval_minutes",
            "weekdays",
            "start_time",
            "end_time",
            "lookback_hours",
            "batch_limit",
            "enabled",
            "version",
            "last_run_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["version", "last_run_at", "created_at", "updated_at"]


class SurveyExecutionSerializer(serializers.ModelSerializer):
    class Meta:
        model = SurveyExecution
        fields = [
            "id",
            "automation",
            "source_record_id",
            "attendance_id",
            "patient_name",
            "phone",
            "survey_url",
            "status",
            "error_message",
            "payload",
            "created_at",
        ]


class SurveyAutomationViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = SurveyAutomationSerializer

    def get_unit_checked(self, roles=None):
        unit = get_unit(self.request, roles)
        if not unit_feature_enabled(unit, "surveys"):
            raise PermissionDenied("Pesquisas de satisfação desabilitadas para esta unidade.")
        return unit

    def get_queryset(self):
        unit = self.get_unit_checked(["admin", "operator", "viewer"])
        return SurveyAutomation.objects.filter(unit=unit).select_related("connection").order_by("-created_at")

    def perform_create(self, serializer):
        unit = self.get_unit_checked(["admin", "operator"])
        serializer.save(unit=unit)

    def perform_update(self, serializer):
        self.get_unit_checked(["admin", "operator"])
        instance = serializer.instance
        serializer.save(version=instance.version + 1)

    def perform_destroy(self, instance):
        self.get_unit_checked(["admin", "operator"])
        instance.delete()


class SurveysConnectionsListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        unit = get_unit(request, ["admin", "operator", "viewer"])
        qs = ReportConnection.objects.filter(
            models.Q(unit=unit) | models.Q(unit__slug="scv")
        ).filter(enabled=True).order_by("name")
        data = [
            {
                "id": c.id,
                "name": c.name,
                "engine": c.engine,
                "database": c.database,
                "unit": c.unit.slug,
            }
            for c in qs
        ]
        return Response({"results": data})


class InspectColumnsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        unit = get_unit(request, ["admin", "operator"])
        if not unit_feature_enabled(unit, "surveys"):
            raise PermissionDenied("Pesquisas desabilitadas para esta unidade.")

        conn_id = request.data.get("connection_id")
        table_name = request.data.get("table_name", "").strip()

        if not conn_id or not table_name:
            raise ValidationError("Informe connection_id e table_name.")

        conn = ReportConnection.objects.filter(pk=conn_id).filter(
            models.Q(unit=unit) | models.Q(unit__slug="scv")
        ).first()
        if not conn:
            raise ValidationError("Conexão não encontrada.")

        try:
            columns = inspect_table_columns(conn, table_name)
        except Exception as e:
            raise ValidationError(f"Erro ao inspecionar colunas: {e}")

        return Response({"columns": columns})


class MetaTemplatesListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        unit = get_unit(request, ["admin", "operator", "viewer"])
        meta_cfg = MetaConfiguration.objects.filter(unit=unit).first()
        templates_list = []

        if meta_cfg and meta_cfg.templates:
            for t in meta_cfg.templates:
                if t.get("status") == "APPROVED":
                    comps = t.get("components", [])
                    analysis = analyze_template_components(comps)
                    templates_list.append({
                        "name": t.get("name"),
                        "category": t.get("category"),
                        "language": t.get("language") or "pt_BR",
                        "components": comps,
                        **analysis,
                    })

        # Se esta unidade não tiver templates Meta configurados, busca de outra unidade (ex.: sansaude/scv)
        if not templates_list:
            other_cfg = MetaConfiguration.objects.exclude(templates=[]).exclude(templates__isnull=True).first()
            if other_cfg and other_cfg.templates:
                for t in other_cfg.templates:
                    if t.get("status") == "APPROVED":
                        comps = t.get("components", [])
                        analysis = analyze_template_components(comps)
                        templates_list.append({
                            "name": t.get("name"),
                            "category": t.get("category"),
                            "language": t.get("language") or "pt_BR",
                            "components": comps,
                            **analysis,
                        })

        if not templates_list:
            for t in Template.objects.filter(unit=unit):
                comps = t.components or []
                analysis = analyze_template_components(comps)
                templates_list.append({
                    "name": t.name,
                    "category": t.purpose,
                    "language": t.language or "pt_BR",
                    "components": comps,
                    **analysis,
                })

        return Response({"templates": templates_list})


class TestSendSurveyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        unit = get_unit(request, ["admin", "operator"])
        if not unit_feature_enabled(unit, "surveys"):
            raise PermissionDenied("Pesquisas desabilitadas para esta unidade.")

        attendance_id = str(request.data.get("attendance_id", "")).strip()
        test_phone = str(request.data.get("test_phone", "")).strip()
        automation_id = request.data.get("automation_id")

        if not attendance_id:
            raise ValidationError("Informe o código de atendimento para o teste.")

        automation = None
        if automation_id:
            automation = SurveyAutomation.objects.filter(pk=automation_id, unit=unit).first()

        if not automation:
            # Configuração inline enviada pelo form antes de salvar
            conn_id = request.data.get("connection_id")
            table_name = request.data.get("table_name", "").strip()
            column_mapping = request.data.get("column_mapping", {})
            template_name = request.data.get("template_name", "pesquisa_nps")
            template_language = request.data.get("template_language", "pt_BR")
            survey_base_url = request.data.get("survey_base_url", "")

            conn = ReportConnection.objects.filter(pk=conn_id).filter(
                models.Q(unit=unit) | models.Q(unit__slug="scv")
            ).first()
            if not conn or not table_name:
                raise ValidationError("Configuração incompleta para teste (conexão e tabela obrigatórias).")

            automation = SurveyAutomation(
                unit=unit,
                name="Teste Temporário",
                connection=conn,
                table_name=table_name,
                column_mapping=column_mapping,
                template_name=template_name,
                template_language=template_language,
                survey_base_url=survey_base_url,
            )

        # Busca dados do atendimento no Oracle
        try:
            candidates = fetch_survey_candidates(automation, specific_attendance_id=attendance_id, limit=1)
        except Exception as e:
            raise ValidationError(f"Erro ao consultar atendimento no banco de dados: {e}")

        if not candidates:
            raise ValidationError(f"Atendimento {attendance_id} não encontrado na tabela/view informada.")

        candidate = candidates[0]
        dest_phone = test_phone if test_phone else candidate.get("phone", "")

        first_name_only = automation.column_mapping.get("patient_first_name_only", True)

        send_result = send_meta_survey_template(
            unit=unit,
            recipient_phone=dest_phone,
            patient_name=candidate.get("patient_name", ""),
            attendance_id=attendance_id,
            template_name=automation.template_name,
            template_language=automation.template_language,
            first_name_only=first_name_only,
            button_parameter=attendance_id,
        )

        # Grava log de teste
        survey_link = build_survey_url(automation.survey_base_url, attendance_id)
        if automation.pk:
            SurveyExecution.objects.create(
                automation=automation,
                unit=unit,
                source_record_id=candidate.get("record_id", ""),
                attendance_id=attendance_id,
                patient_name=candidate.get("patient_name", ""),
                phone=dest_phone,
                survey_url=survey_link,
                status="test",
                error_message="" if send_result.get("success") else send_result.get("error", ""),
                payload={
                    "request": send_result.get("payload"),
                    "response": send_result.get("response"),
                    "is_test": True,
                },
            )

        return Response({
            "candidate": candidate,
            "send_result": send_result,
            "survey_url": survey_link,
        })


class TriggerAutomationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk=None):
        unit = get_unit(request, ["admin", "operator"])
        automation = SurveyAutomation.objects.filter(pk=pk, unit=unit).first()
        if not automation:
            raise ValidationError("Automação não encontrada.")

        result = run_survey_automation(automation.pk, force=True)
        return Response(result)


class SurveyExecutionsListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        unit = get_unit(request, ["admin", "operator", "viewer"])
        qs = SurveyExecution.objects.filter(unit=unit)
        auto_id = request.query_params.get("automation_id")
        if auto_id:
            qs = qs.filter(automation_id=auto_id)

        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)

        search = request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                models.Q(attendance_id__icontains=search)
                | models.Q(patient_name__icontains=search)
                | models.Q(phone__icontains=search)
            )

        # Filtros por data (fuso horário da unidade)
        tz_name = unit.timezone or "America/Sao_Paulo"
        try:
            tz = zoneinfo.ZoneInfo(tz_name)
        except Exception:
            tz = zoneinfo.ZoneInfo("America/Sao_Paulo")

        start_date_str = request.query_params.get("start_date", "").strip()
        if start_date_str:
            try:
                d_start = date.fromisoformat(start_date_str)
                dt_start = datetime.combine(d_start, time.min).replace(tzinfo=tz)
                qs = qs.filter(created_at__gte=dt_start)
            except Exception:
                pass

        end_date_str = request.query_params.get("end_date", "").strip()
        if end_date_str:
            try:
                d_end = date.fromisoformat(end_date_str)
                dt_end = datetime.combine(d_end, time.max).replace(tzinfo=tz)
                qs = qs.filter(created_at__lte=dt_end)
            except Exception:
                pass

        total = qs.count()

        try:
            page = max(1, int(request.query_params.get("page", 1)))
        except (ValueError, TypeError):
            page = 1

        try:
            page_size = min(100, max(5, int(request.query_params.get("page_size", 20))))
        except (ValueError, TypeError):
            page_size = 20

        total_pages = max(1, math.ceil(total / page_size)) if total > 0 else 1
        if page > total_pages and total > 0:
            page = total_pages

        start = (page - 1) * page_size
        items = qs.order_by("-created_at")[start : start + page_size]

        serializer = SurveyExecutionSerializer(items, many=True)
        return Response({
            "count": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "has_next": (start + page_size) < total,
            "has_previous": page > 1,
            "results": serializer.data,
        })
