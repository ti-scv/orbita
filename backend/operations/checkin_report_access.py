"""Authorization for check-in report data, including Canvas sources."""
from rest_framework.exceptions import PermissionDenied
from core.access import effective_permissions, local_permissions
from operations.checkin_report import HANDLER


def check_report(report, *, request=None, user=None, layout=None, seen=None):
    seen = set(seen or ())
    if report.pk in seen:
        return
    seen.add(report.pk)
    if report.handler == HANDLER:
        principal = request.user if request is not None else user
        policy = effective_permissions(request, report.unit) if request is not None else (local_permissions(principal, report.unit) if principal and principal.is_active else {})
        if report.unit.slug != "sansaude" or not principal or not principal.is_active or policy.get("checkin", "none") not in ("read", "write"):
            raise PermissionDenied("Sem permissão para consultar check-in nesta unidade.")
    from operations.models import ReportDefinition
    canvas = layout if layout is not None else report.canvas_layout
    if canvas:
        for source in canvas.get("sources", []):
            if source.get("type") == "report":
                child = ReportDefinition.objects.filter(pk=source.get("report_id"), unit_id=report.unit_id).select_related("unit").first()
                if child:
                    check_report(child, request=request, user=user, layout={}, seen=seen)
    if report.source == "composite":
        from operations.reporting import composition_child
        for entry in report.components:
            child = composition_child(report, entry)
            if child:
                check_report(child, request=request, user=user, seen=seen)
