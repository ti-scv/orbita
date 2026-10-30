from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.test import override_settings
from rest_framework.test import APIClient

from checkin.models import Configuration
from checkin.tasks import reconcile_oracle, tick
from core.models import Audit, Membership, Unit


@pytest.mark.django_db
def test_features_are_independent_and_audited():
    user = get_user_model().objects.create_superuser(username="flags-admin", password="test")
    client = APIClient()
    client.force_authenticate(user)
    unit = Unit.objects.create(slug="unit-example", name="Exemplo")
    for path in ("checkins", "checkin-configuration", "autoagenda/config"):
        assert client.get(f"/api/v1/{path}/?unit={unit.slug}").status_code == 403
    response = client.post(f"/api/v1/units/{unit.pk}/configure/?unit={unit.slug}",
        {"version": unit.version, "checkin_enabled": True, "autoagenda_enabled": True}, format="json", HTTP_IDEMPOTENCY_KEY="enable-feature-test")
    assert response.status_code == 200, response.data
    assert Audit.objects.get(unit=unit, action="unit.configured").details["recursos"]["checkin_enabled"]["depois"]
    assert client.get(f"/api/v1/checkins/?unit={unit.slug}").status_code == 200
    assert client.get(f"/api/v1/autoagenda/config/?unit={unit.slug}").status_code == 200
    assert client.patch(f"/api/v1/checkin-configuration/?unit={unit.slug}", {"lead_value": 48}, format="json").status_code == 200
    assert client.put(f"/api/v1/autoagenda/config/?unit={unit.slug}", {"version": 1}, format="json").status_code == 200
    unit.refresh_from_db()
    response = client.post(f"/api/v1/units/{unit.pk}/configure/?unit={unit.slug}",
        {"version": unit.version, "checkin_enabled": False, "autoagenda_enabled": False}, format="json", HTTP_IDEMPOTENCY_KEY="disable-feature-test")
    assert response.status_code == 200, response.data
    assert client.get(f"/api/v1/checkins/?unit={unit.slug}").status_code == 403
    assert client.get(f"/api/v1/autoagenda/config/?unit={unit.slug}").status_code == 403


@pytest.mark.django_db
@override_settings(CHECKIN_SCHEDULER_ENABLED=True, CHECKIN_ORACLE_SCHEDULER_ENABLED=True)
def test_periodic_jobs_only_visit_enabled_units():
    on = Unit.objects.create(slug="on", name="Ativa", checkin_enabled=True)
    off = Unit.objects.create(slug="off", name="Inativa", checkin_enabled=True)
    for unit in (on, off):
        Configuration.objects.create(unit=unit, enabled=True, appointment_enabled=True, oracle_enabled=True)
    off.checkin_enabled = False
    off.save()
    with patch("checkin.tasks.create_unit_cycles") as create, patch("checkin.tasks.reconcile_unit_oracle") as reconcile:
        tick()
        reconcile_oracle()
    assert [call.args[0].unit_id for call in create.call_args_list] == [on.pk]
    assert [call.args[0].pk for call in reconcile.call_args_list] == [on.pk]


@pytest.mark.django_db(transaction=True)
def test_unit_feature_migration_forward_and_backward():
    from django.db import connection
    from django.db.migrations.executor import MigrationExecutor

    before = [("core", "0014_instanceaccesskey_export_user_identities")]
    after = [("core", "0015_unit_features")]
    executor = MigrationExecutor(connection)
    executor.migrate(before)
    try:
        old_apps = executor.loader.project_state(before).apps
        old_unit = old_apps.get_model("core", "Unit")
        old_unit.objects.create(slug="sansaude", name="Sansaúde")
        old_unit.objects.create(slug="outra", name="Outra")
        executor = MigrationExecutor(connection)
        executor.migrate(after)
        apps = executor.loader.project_state(after).apps
        UnitAtMigration = apps.get_model("core", "Unit")
        preserved = UnitAtMigration.objects.get(slug="sansaude")
        other = UnitAtMigration.objects.get(slug="outra")
        assert preserved.checkin_enabled and preserved.autoagenda_enabled
        assert not other.checkin_enabled and not other.autoagenda_enabled
        executor = MigrationExecutor(connection)
        executor.migrate(before)
        old_apps = executor.loader.project_state(before).apps
        assert set(old_apps.get_model("core", "Unit").objects.values_list("slug", flat=True)) >= {"sansaude", "outra"}
    finally:
        MigrationExecutor(connection).migrate(after)


@pytest.mark.django_db
def test_report_checks_unit_flag():
    from rest_framework.exceptions import PermissionDenied
    from operations.checkin_report import HANDLER
    from operations.checkin_report_access import check_report
    from operations.models import ReportDefinition
    unit = Unit.objects.create(slug="report-unit", name="Unidade", checkin_enabled=True)
    user = get_user_model().objects.create_superuser(username="report-flags", password="test")
    report = ReportDefinition.objects.create(unit=unit, code="checkin-flags", name="Check-in", source="local", handler=HANDLER)
    check_report(report, user=user)
    unit.checkin_enabled = False
    unit.save()
    with pytest.raises(PermissionDenied):
        check_report(report, user=user)


@pytest.mark.django_db
def test_non_admin_cannot_edit_unit_flags():
    unit = Unit.objects.create(slug="nonadmin", name="Unidade")
    user = get_user_model().objects.create_user(username="nonadmin-flags")
    Membership.objects.create(user=user, unit=unit, role="operator", permissions={"settings": "write"})
    client = APIClient()
    client.force_authenticate(user)
    response = client.post(f"/api/v1/units/{unit.pk}/configure/?unit={unit.slug}",
        {"version": unit.version, "checkin_enabled": True}, format="json", HTTP_IDEMPOTENCY_KEY="nonadmin-feature-test")
    assert response.status_code == 403
    unit.refresh_from_db()
    assert not unit.checkin_enabled


@pytest.mark.django_db
@pytest.mark.parametrize("feature,path", [("checkin", "checkins"), ("autoagenda", "autoagenda/config")])
def test_each_feature_can_be_enabled_independently(feature, path):
    unit = Unit.objects.create(slug="independent", name="Unidade")
    user = get_user_model().objects.create_superuser(username="independent", password="test")
    client = APIClient()
    client.force_authenticate(user)
    url = f"/api/v1/{path}/?unit={unit.slug}"
    assert client.get(url).status_code == 403
    setattr(unit, feature + "_enabled", True)
    unit.save()
    assert client.get(url).status_code == 200
    other_path = "autoagenda/config" if feature == "checkin" else "checkins"
    assert client.get(f"/api/v1/{other_path}/?unit={unit.slug}").status_code == 403
    setattr(unit, feature + "_enabled", False)
    unit.save()
    assert client.get(url).status_code == 403
