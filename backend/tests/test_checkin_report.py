from datetime import datetime, timezone
import base64
import pytest
from django.core.management import call_command
from rest_framework.exceptions import ValidationError
from checkin.models import CheckIn
from core.models import Unit
from scheduling.models import Appointment
from operations.models import ReportDefinition
from operations.checkin_report import collect
from operations.report_canvas.engine import export

@pytest.mark.django_db
def test_summary_period_dimensions_and_export():
    unit = Unit.objects.create(slug="sansaude", name="Sansaúde", timezone="America/Sao_Paulo")
    call_command("configure_checkin_report")
    report = ReportDefinition.objects.get(code="checkin-summary")
    assert not report.enabled and not report.canvas_enabled and not report.manual_enabled
    def record(external, when, response="pending", attendance="unknown", sent=False):
        appointment = Appointment.objects.create(unit=unit, external_id=external, kind="exam", patient="Teste", procedure="Teste", scheduled_at=when, arrival_time="")
        return CheckIn.objects.create(unit=unit, appointment=appointment, scheduled_at=when, response=response, attendance=attendance, sent_at=when if sent else None)
    record("before", datetime(2026, 10, 1, 2, 59, tzinfo=timezone.utc), "confirmed", "attended", True)
    record("first", datetime(2026, 10, 1, 3, tzinfo=timezone.utc), "confirmed", "absent", True)
    record("last", datetime(2026, 10, 2, 2, 59, tzinfo=timezone.utc), "confirmed", "unknown", True)
    record("next", datetime(2026, 10, 2, 3, tzinfo=timezone.utc), "no_response", "unknown", True)
    columns, rows = collect(report, {"start":"2026-10-01", "end":"2026-10-01"})
    data = {row[0]: row[1:] for row in rows}
    assert data["Ciclos no período"][0] == 2
    assert data["Confirmados que não compareceram"][0] == 1
    assert data["Confirmados com comparecimento desconhecido"][0] == 1
    assert data["Confirmação / enviados (%)"] == [2, 2, 100]
    assert data["Falta / confirmados com comparecimento conhecido (%)"] == [1, 1, 100]
    content, _ = export(report, report.canvas_layout, {"start":"2026-10-01", "end":"2026-10-01"}, [], "pdf")
    assert base64.b64decode(content).startswith(b"%PDF")
    _, empty = collect(report, {"start":"2026-09-01", "end":"2026-09-01"})
    assert empty[-1][1:] == [0, 0, None]
    with pytest.raises(ValidationError): collect(report, {"start":"2026-10-02", "end":"2026-10-01"})
    report.unit = Unit.objects.create(slug="other", name="Outra")
    with pytest.raises(ValidationError): collect(report, {"start":"2026-10-01", "end":"2026-10-01"})
