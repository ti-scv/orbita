"""Local, aggregate-only check-in dataset for ReportCanvas."""

from core.features import unit_feature_enabled
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo
from django.db.models import Count, Q
from rest_framework.exceptions import ValidationError
from checkin.models import CheckIn
from operations.app_reporting import date_range

HANDLER = "checkin_summary_v1"
COLUMNS = ["Indicador", "Numerador", "Denominador", "Percentual"]


def collect(report, values):
    if not unit_feature_enabled(report.unit, "checkin") or report.source != "local" or report.handler != HANDLER:
        raise ValidationError("Relatório de check-in indisponível para esta unidade.")
    start, end = date_range(report.unit, values)
    zone = ZoneInfo(report.unit.timezone)
    lo = datetime.combine(start, time.min, zone)
    hi = datetime.combine(end + timedelta(days=1), time.min, zone)
    qs = CheckIn.objects.filter(unit_id=report.unit_id, scheduled_at__gte=lo, scheduled_at__lt=hi)
    counts = qs.aggregate(
        total=Count("pk"), sent=Count("pk", filter=Q(sent_at__isnull=False)),
        confirmed=Count("pk", filter=Q(response="confirmed")),
        no_response=Count("pk", filter=Q(response="no_response")),
        attended=Count("pk", filter=Q(attendance="attended")),
        absent_confirmed=Count("pk", filter=Q(response="confirmed", attendance="absent")),
        known_confirmed=Count("pk", filter=Q(response="confirmed", attendance__in=["attended", "absent"])),
        unknown=Count("pk", filter=Q(attendance="unknown")),
        unknown_confirmed=Count("pk", filter=Q(response="confirmed", attendance="unknown")),
    )
    def rate(n, d):
        return round(100 * n / d, 2) if d else None
    c = counts
    return COLUMNS, [
        ["Ciclos no período", c["total"], None, None],
        ["Enviados", c["sent"], None, None],
        ["Confirmados", c["confirmed"], None, None],
        ["Sem resposta", c["no_response"], None, None],
        ["Compareceram", c["attended"], None, None],
        ["Confirmados que não compareceram", c["absent_confirmed"], None, None],
        ["Comparecimento desconhecido", c["unknown"], None, None],
        ["Confirmados com comparecimento desconhecido", c["unknown_confirmed"], None, None],
        ["Confirmação / enviados (%)", c["confirmed"], c["sent"], rate(c["confirmed"], c["sent"])],
        ["Falta / confirmados com comparecimento conhecido (%)", c["absent_confirmed"], c["known_confirmed"], rate(c["absent_confirmed"], c["known_confirmed"])],
    ]
