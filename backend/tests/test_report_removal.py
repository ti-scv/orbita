import uuid
import pytest
from core.models import Audit, Membership
from django.contrib.auth import get_user_model
from operations.models import ReportConnection, ReportDefinition


def post(client, path, data):
    return client.post(f"/api/v1/{path}/?unit=ame", data, format="json", HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()))


@pytest.mark.django_db
def test_report_remove_restore_and_permissions(setup):
    client = setup["client"]
    report = ReportDefinition.objects.create(unit=setup["unit"], code="removal", name="Relatório teste", enabled=True)
    path = f"reports/{report.pk}"
    from django.utils import timezone
    from operations.models import ReportAccess
    viewer = get_user_model().objects.create_user("public-viewer", password="x")
    Membership.objects.create(user=viewer, unit=setup["unit"], role="viewer")
    access = ReportAccess.objects.create(unit=setup["unit"], user=viewer, phone="5511888880000", active=True, verified_at=timezone.now())
    access.reports.add(report)
    assert post(client, f"{path}/remover", {"version": report.version}).status_code == 200
    report.refresh_from_db()
    client.force_authenticate(viewer)
    assert client.get(f"/api/v1/{path}/?unit=ame").status_code == 404
    assert not any(row["id"] == report.pk for row in client.get("/api/v1/reports/?unit=ame").json()["results"])
    client.force_authenticate(setup["user"])
    assert report.removed_at is not None and not report.enabled and report.removed_by == setup["user"]
    assert client.get("/api/v1/reports/?unit=ame").status_code == 200
    assert client.get(f"/api/v1/{path}/?unit=ame").status_code == 404
    assert client.get(f"/api/v1/{path}/canvas/?unit=ame").status_code == 404
    archived = client.get("/api/v1/reports/?unit=ame&removidos=1").json()
    assert any(row["id"] == report.pk for row in archived["results"])
    assert post(client, f"{path}/restaurar", {"version": report.version}).status_code == 200
    report.refresh_from_db()
    assert report.removed_at is None and report.enabled
    assert Audit.objects.filter(action="report.removed", object_id=str(report.pk)).exists()
    assert Audit.objects.filter(action="report.restored", object_id=str(report.pk)).exists()
    assert post(client, "reports/999999/remover", {"version": 1}).status_code == 404
    user = get_user_model().objects.create_user("viewer", password="x")
    Membership.objects.create(user=user, unit=setup["unit"], role="viewer")
    client.force_authenticate(user)
    assert post(client, f"{path}/remover", {"version": report.version}).status_code == 403


@pytest.mark.django_db
def test_connection_with_report_is_blocked_and_keeps_secret(setup):
    client = setup["client"]
    connection = ReportConnection.objects.create(unit=setup["unit"], name="Banco teste", engine="sqlite", ciphertext="cifrado", enabled=False)
    report = ReportDefinition.objects.create(unit=setup["unit"], code="linked", name="Fonte teste", catalog_kind="component", connection=connection)
    path = f"report-connections/{connection.pk}"
    response = client.get(f"/api/v1/{path}/dependencias/?unit=ame")
    assert response.status_code == 200 and "Fonte teste" in str(response.json())
    assert post(client, f"{path}/remover", {"version": 1}).status_code == 400
    connection.refresh_from_db()
    assert connection.removed_at is None and connection.ciphertext == "cifrado"
    report.connection = None
    report.save(update_fields=["connection"])
    assert post(client, f"{path}/remover", {"version": 1}).status_code == 200
    connection.refresh_from_db()
    assert connection.ciphertext == "cifrado" and connection.removed_at is not None
    assert post(client, f"{path}/restaurar", {"version": connection.version}).status_code == 200
    connection.refresh_from_db()
    assert connection.ciphertext == "cifrado" and not connection.enabled



@pytest.mark.django_db
def test_report_with_schedules_and_canvas_references_cannot_be_removed(setup):
    from datetime import time
    from operations.models import ReportAccess, ReportSchedule
    client = setup["client"]
    report = ReportDefinition.objects.create(unit=setup["unit"], code="dep", name="Origem", enabled=True)
    access = ReportAccess.objects.create(unit=setup["unit"], user=setup["user"], phone="5511999990001")
    ReportSchedule.objects.create(unit=setup["unit"], access=access, report=report, send_time=time(9))
    ReportDefinition.objects.create(unit=setup["unit"], code="parent", name="Painel principal", canvas_layout={"sources":[{"type":"report", "report_id":report.pk}]})
    path = f"reports/{report.pk}"
    deps = client.get(f"/api/v1/{path}/dependencias/?unit=ame").json()["dependencias"]
    assert any("Agendamento" in item for item in deps)
    assert any("Painel principal" in item for item in deps)
    assert post(client, f"{path}/remover", {"version": 1}).status_code == 400
    report.refresh_from_db()
    assert report.enabled and report.removed_at is None


@pytest.mark.django_db
def test_app_connection_restore_preserves_previous_inactive_state(setup):
    from operations.models import ReportApplicationConnection
    client = setup["client"]
    connection = ReportApplicationConnection.objects.create(unit=setup["unit"], name="App teste", enabled=False)
    path = f"report-app-connections/{connection.pk}"
    assert post(client, f"{path}/remover", {"version": 9}).status_code == 409
    assert post(client, f"{path}/remover", {"version": 1}).status_code == 200
    connection.refresh_from_db()
    assert connection.removed_at is not None
    assert post(client, f"{path}/restaurar", {"version": connection.version}).status_code == 200
    connection.refresh_from_db()
    assert connection.removed_at is None and not connection.enabled


@pytest.mark.django_db
def test_other_unit_cannot_remove_report(setup):
    from core.models import Unit
    other = Unit.objects.create(slug="outra", name="Outra")
    report = ReportDefinition.objects.create(unit=other, code="foreign", name="Outro relatório")
    assert post(setup["client"], f"reports/{report.pk}/remover", {"version": 1}).status_code == 404

