from unittest.mock import MagicMock, Mock

import pytest
from django.core.exceptions import ValidationError
from django.utils import timezone

from checkin.models import CheckIn, Configuration, Event
from checkin.oracle_reconciliation import reconcile_batch
from core.models import Unit
from scheduling.models import Appointment


@pytest.fixture
def setup(db):
    unit = Unit.objects.create(slug="sansaude", name="Sansaúde")
    other = Unit.objects.create(slug="outra", name="Outra")
    config = Configuration.objects.create(unit=unit)
    records = []
    for i in range(3):
        appointment = Appointment.objects.create(unit=unit, external_id=str(i), kind="exam", patient="Teste", procedure="Teste", scheduled_at=timezone.now(), arrival_time="")
        records.append(CheckIn.objects.create(unit=unit, appointment=appointment))
    return unit, other, config, records


def test_gates_and_bounds(setup):
    unit, other, config, records = setup
    source = Mock()
    assert reconcile_batch(unit=unit, source=source).status == "disabled"
    source.lookup.assert_not_called()
    with pytest.raises(ValidationError): reconcile_batch(unit=other, source=source)
    with pytest.raises(ValidationError): reconcile_batch(unit=unit, source=source, limit=101)
    config.enabled = config.oracle_enabled = True
    config.save()
    assert reconcile_batch(unit=unit, source=source).changed == 0
    source.lookup.assert_not_called()


def test_unique_ambiguous_late_and_replay(setup):
    unit, _, config, records = setup
    config.enabled = config.oracle_enabled = config.appointment_enabled = True
    config.save()
    source = Mock()
    source.lookup.return_value = {records[0].pk: [True], records[1].pk: [True, True]}
    result = reconcile_batch(unit=unit, source=source, limit=2)
    assert result.changed == 1 and result.reviewed == ((records[1].pk, "ambiguous"),)
    assert reconcile_batch(unit=unit, source=source, cursor=result.next_cursor).status == "unavailable"  # extraneous ids rejected
    source.lookup.return_value = {records[2].pk: [False]}
    assert reconcile_batch(unit=unit, source=source, cursor=result.next_cursor).changed == 0
    source.lookup.return_value = {r.pk: [True] for r in records}
    assert reconcile_batch(unit=unit, source=source).changed == 2
    assert reconcile_batch(unit=unit, source=source).changed == 0
    assert Event.objects.count() == 3
    assert all(e.evidence == {"cd_atendimento_present": True} for e in Event.objects.all())


def test_timeout_secret_and_divergence(setup, caplog):
    unit, _, config, records = setup
    config.enabled = config.oracle_enabled = config.appointment_enabled = True
    config.save()
    source = Mock()
    source.lookup.side_effect = TimeoutError("secret credential")
    result = reconcile_batch(unit=unit, source=source)
    assert result.status == "unavailable" and result.next_cursor is None
    assert "secret credential" not in caplog.text and "secret credential" not in repr(result)
    records[0].attendance = "absent"
    records[0].save()
    source.lookup.side_effect = None
    source.lookup.return_value = {records[0].pk: [True]}
    assert (records[0].pk, "divergence") in reconcile_batch(unit=unit, source=source).reviewed
    records[0].refresh_from_db()
    assert records[0].attendance == "absent"


def test_missing_and_stale_revision_are_reviewed(setup):
    unit, _, config, records = setup
    config.enabled = config.oracle_enabled = config.appointment_enabled = True
    config.save()
    appointment = records[0].appointment
    appointment.revision += 1
    appointment.save()
    result = reconcile_batch(unit=unit, source=Mock(lookup=Mock(return_value={records[0].pk: [True]})))
    assert (records[0].pk, "conflict") in result.reviewed
    assert (records[1].pk, "no_match") in result.reviewed
    records[0].refresh_from_db()
    assert records[0].attendance == "unknown"


def test_scheduled_oracle_read_only_and_late_arrival(setup, settings, monkeypatch):
    from checkin.tasks import reconcile_oracle
    from scheduling.connectors import OracleSource

    unit, _, config, records = setup
    config.enabled = config.oracle_enabled = config.appointment_enabled = True
    config.save()
    settings.CHECKIN_ORACLE_VIEW = "TEST_OWNER.TEST_VIEW"
    settings.CHECKIN_ORACLE_KEY_COLUMN = "AGENDA_ID"
    settings.CHECKIN_ORACLE_SCHEDULER_ENABLED = False
    connection = MagicMock()
    cursor = connection.cursor.return_value.__enter__.return_value
    cursor.fetchmany.side_effect = [[(123,)], [(None,)], [(1,), (2,)]]
    connection.__enter__ = Mock(return_value=connection)
    connection.__exit__ = Mock(return_value=False)
    connect = Mock(return_value=connection)
    monkeypatch.setattr(OracleSource, "connect", connect)

    reconcile_oracle()
    connect.assert_not_called()
    settings.CHECKIN_ORACLE_SCHEDULER_ENABLED = True
    reconcile_oracle()
    for record in records:
        record.refresh_from_db()
    assert [r.attendance for r in records] == ["attended", "unknown", "unknown"]
    assert records[0].events.get().evidence == {"cd_atendimento_present": True}
    calls = cursor.execute.call_args_list
    assert calls[0].args == ("SET TRANSACTION READ ONLY",)
    assert all(call.args[0].startswith("SELECT CD_ATENDIMENTO FROM TEST_OWNER.TEST_VIEW") for call in calls[1:])
    assert [call.args[1]["source_id"] for call in calls[1:]] == ["0", "1", "2"]
    connection.rollback.assert_called_once()
    cursor.fetchmany.side_effect = [[(123,)], [(42,)], []]
    reconcile_oracle()
    records[1].refresh_from_db()
    assert records[1].attendance == "attended"
    assert records[0].events.count() == 1


def test_scheduled_oracle_requires_configuration_and_safe_identifiers(setup, settings, monkeypatch):
    from checkin.tasks import reconcile_oracle
    from scheduling.connectors import OracleSource

    unit, _, config, _ = setup
    settings.CHECKIN_ORACLE_SCHEDULER_ENABLED = True
    settings.CHECKIN_ORACLE_VIEW = "VIEW_NAME; DELETE FROM X"
    settings.CHECKIN_ORACLE_KEY_COLUMN = "KEY"
    connect = Mock()
    monkeypatch.setattr(OracleSource, "connect", connect)
    reconcile_oracle()
    config.enabled = config.oracle_enabled = config.appointment_enabled = True
    config.save()
    reconcile_oracle()
    connect.assert_not_called()
