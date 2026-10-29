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
    icon = report.canvas_layout["pages"][0]["blocks"][0]
    assert icon["type"] == "image" and report.canvas_assets.filter(pk=icon["asset_id"]).exists()
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

@pytest.mark.django_db
def test_checkin_report_access_direct_composed_and_revocation():
    from types import SimpleNamespace
    from django.contrib.auth import get_user_model
    from rest_framework.exceptions import PermissionDenied
    from core.models import Membership
    from operations.checkin_report_access import check_report
    unit = Unit.objects.create(slug="sansaude", name="Sansaúde")
    call_command("configure_checkin_report")
    report = ReportDefinition.objects.get(code="checkin-summary")
    report.enabled = True
    report.canvas_enabled = True
    report.save()
    user = get_user_model().objects.create_user("checkin-report")
    membership = Membership.objects.create(user=user, unit=unit, role="operator", permissions={"reports":"write"})
    wrapper = ReportDefinition.objects.create(unit=unit, code="wrapper", name="Outro", source="local", canvas_enabled=True, canvas_layout={"sources":[{"type":"report", "report_id":report.pk}]})
    composite = ReportDefinition.objects.create(unit=unit, code="composite", name="Composto", source="composite", components=[{"report_id":report.pk, "code":report.code}])
    with pytest.raises(PermissionDenied): check_report(report, user=user)
    with pytest.raises(PermissionDenied): check_report(wrapper, user=user)
    with pytest.raises(PermissionDenied): check_report(composite, user=user)
    membership.permissions = {"reports":"write", "checkin":"read"}
    membership.save()
    check_report(report, user=user)
    check_report(wrapper, user=user)
    check_report(composite, user=user)
    request = SimpleNamespace(user=user, auth=SimpleNamespace(effective_role="operator", section_limit={"reports":"write", "checkin":"none"}))
    with pytest.raises(PermissionDenied): check_report(wrapper, request=request)
    membership.permissions["checkin"] = "none"
    membership.save()
    with pytest.raises(PermissionDenied): check_report(wrapper, user=user)
    with pytest.raises(PermissionDenied): check_report(wrapper, user=None)

@pytest.mark.django_db
def test_canvas_checkin_source_requires_permission_even_on_cached_preview():
    from django.contrib.auth import get_user_model
    from rest_framework.test import APIClient
    from core.models import Membership
    unit = Unit.objects.create(slug="sansaude", name="Sansaúde", timezone="America/Sao_Paulo")
    call_command("configure_checkin_report")
    report = ReportDefinition.objects.get(code="checkin-summary")
    report.enabled = report.canvas_enabled = True
    report.save()
    wrapper = ReportDefinition.objects.create(unit=unit, code="wrapper", name="Outro", source="local", enabled=True, reviewed=True)
    user = get_user_model().objects.create_user("checkin-canvas")
    membership = Membership.objects.create(user=user, unit=unit, role="operator", permissions={"reports":"write", "checkin":"read"})
    client = APIClient()
    client.force_authenticate(user)
    source = {"id":"dados", "type":"report", "report_id":report.pk, "dataset":"rows"}
    data = {"source":source, "parameters":{"start":"2026-10-01", "end":"2026-10-01"}}
    url = f"/api/v1/reports/{wrapper.pk}/canvas-source-preview/?unit=sansaude"
    response = client.post(url, data, format="json")
    assert response.status_code == 200, response.data
    membership.permissions["checkin"] = "none"
    membership.save()
    response = client.post(url, data, format="json")
    assert response.status_code == 403, response.data
    url = f"/api/v1/reports/{report.pk}/canvas-preview/?unit=sansaude"
    response = client.post(url, {"layout":report.canvas_layout, "parameters":data["parameters"]}, format="json")
    assert response.status_code == 403, response.data

@pytest.mark.django_db
def test_async_report_access_rechecked_after_revocation():
    from django.contrib.auth import get_user_model
    from rest_framework.exceptions import PermissionDenied
    from core.models import Membership
    from operations.reporting import make_execution, execution_access
    unit = Unit.objects.create(slug="sansaude", name="Sansaúde", timezone="America/Sao_Paulo")
    call_command("configure_checkin_report")
    report = ReportDefinition.objects.get(code="checkin-summary")
    report.enabled = report.canvas_enabled = report.manual_enabled = True
    report.save()
    user = get_user_model().objects.create_user("checkin-job")
    membership = Membership.objects.create(user=user, unit=unit, role="admin", permissions={"checkin":"read"})
    job = make_execution(report, {"start":"2026-10-01", "end":"2026-10-01"}, user=user)
    execution_access(job)
    membership.permissions = {"checkin":"none"}
    membership.save()
    with pytest.raises(PermissionDenied): execution_access(job)
    with pytest.raises(PermissionDenied): execution_access(job, for_download=True)


def test_percentual_canvas_uses_brazilian_decimal_and_preserves_spreadsheet_number():
    from operations.report_canvas.formatting import display_cell, export_cell
    assert display_cell(12.5, "Percentual") == "12,5"
    assert export_cell(12.5, "Percentual") == 12.5
