from unittest.mock import Mock

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
