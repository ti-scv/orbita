"""Remoção reversível de cadastros de relatórios; nunca elimina registros ou segredos."""
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from core.models import Audit
from core.permissions import get_unit
from operations import models as m
from operations.services import Conflict
from operations.report_removal_compat import require_removal
from django.conf import settings


def dependencies(obj):
    if isinstance(obj, (m.ReportConnection, m.ReportApplicationConnection)):
        key = "connection" if isinstance(obj, m.ReportConnection) else "app_connection"
        reports = m.ReportDefinition.objects.filter(unit=obj.unit, **{key: obj}).only("name", "catalog_kind").order_by("name")
        return [f"{'Fonte' if row.catalog_kind == 'component' else 'Relatório'}: {row.name}" for row in reports]
    items = []
    for row in m.ReportSchedule.objects.filter(unit=obj.unit, report=obj).select_related("access__user"):
        items.append(f"Agendamento de {row.access.user.get_username()} às {row.send_time:%H:%M}")
    for row in m.ReportAutomation.objects.filter(unit=obj.unit, report=obj).select_related("recipient"):
        items.append(f"Programação de {row.recipient.name} às {row.send_time:%H:%M}")
    snapshots = m.ReportSnapshotConfiguration.objects.filter(unit=obj.unit).filter(
        Q(source_report=obj) | Q(output_report=obj) | Q(consumers=obj)
    ).distinct()
    items.extend(f"Coleta: {row.name}" for row in snapshots)
    for parent in m.ReportDefinition.objects.filter(unit=obj.unit).exclude(pk=obj.pk).only("name", "components", "canvas_layout"):
        components = parent.components if isinstance(parent.components, list) else []
        layout = parent.canvas_layout if isinstance(parent.canvas_layout, dict) else {}
        sources = layout.get("sources", [])
        if any(isinstance(entry, dict) and entry.get("code") == obj.code for entry in components) or (
            isinstance(sources, list) and any(isinstance(src, dict) and src.get("type") == "report" and src.get("report_id") == obj.pk for src in sources)
        ):
            items.append(f"Relatório: {parent.name}")
    return sorted(set(items))


class ReversibleRemovalMixin:
    def get_queryset(self):
        return self.scope_removals(super().get_queryset())

    def scope_removals(self, qs):
        if self.action in {"restore", "remove"}:
            require_removal()
        if not settings.REPORT_REMOVAL_ENABLED:
            return qs
        if self.action == "restore" or (self.action == "list" and self.request.query_params.get("removidos") == "1"):
            get_unit(self.request, ["admin"])
            return qs.filter(removed_at__isnull=False)
        return qs.filter(removed_at__isnull=True)

    def list(self, request, *args, **kwargs):
        if request.query_params.get("removidos") == "1" and not settings.REPORT_REMOVAL_ENABLED:
            get_unit(request, ["admin"])
            return Response({"count": 0, "next": None, "previous": None, "results": [], "remocao_disponivel": False})
        return super().list(request, *args, **kwargs)

    @action(detail=True, methods=["get"], url_path="dependencias")
    def removal_dependencies(self, request, pk=None):
        get_unit(request, ["admin"])
        return Response({"dependencias": dependencies(self.get_object()), "remocao_disponivel": settings.REPORT_REMOVAL_ENABLED})

    @action(detail=True, methods=["post"], url_path="remover")
    def remove(self, request, pk=None):
        unit = get_unit(request, ["admin"])
        require_removal()
        def execute():
            obj = get_object_or_404(self.queryset.model.objects.select_for_update(), pk=pk, unit=unit, removed_at__isnull=True)
            if type(request.data.get("version")) is not int or request.data["version"] != obj.version:
                raise Conflict()
            linked = dependencies(obj)
            if linked:
                raise ValidationError({"detail": "Remoção bloqueada por vínculos. Resolva-os antes de remover.", "dependencias": linked})
            obj.removed_was_enabled = obj.enabled
            obj.enabled = False
            obj.removed_at = timezone.now()
            obj.removed_by = request.user
            obj.version += 1
            obj.save(update_fields=["removed_was_enabled", "enabled", "removed_at", "removed_by", "version"])
            Audit.objects.create(unit=unit, actor=request.user, action="report.removed", object_id=str(obj.pk), details={"resource": obj._meta.model_name, "name": obj.name})
            return {"name": obj.name, "version": obj.version}
        with transaction.atomic():
            return self.once(request, execute)

    @action(detail=True, methods=["post"], url_path="restaurar")
    def restore(self, request, pk=None):
        unit = get_unit(request, ["admin"])
        require_removal()
        def execute():
            obj = get_object_or_404(self.queryset.model.objects.select_for_update(), pk=pk, unit=unit, removed_at__isnull=False)
            if type(request.data.get("version")) is not int or request.data["version"] != obj.version:
                raise Conflict()
            obj.enabled = bool(obj.removed_was_enabled)
            obj.removed_at = None
            obj.removed_by = None
            obj.removed_was_enabled = None
            obj.version += 1
            obj.save(update_fields=["enabled", "removed_at", "removed_by", "removed_was_enabled", "version"])
            Audit.objects.create(unit=unit, actor=request.user, action="report.restored", object_id=str(obj.pk), details={"resource": obj._meta.model_name, "name": obj.name})
            return {"name": obj.name, "version": obj.version}
        with transaction.atomic():
            return self.once(request, execute)

