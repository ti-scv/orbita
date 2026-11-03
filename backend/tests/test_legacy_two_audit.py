from contextlib import nullcontext
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
import pytest
from django.core.management.base import CommandError
from operations.management.commands.audit_legacy_two import IDS, blocker, inventory


def test_exact_scope_and_dependencies():
    assert list(IDS.values()) == [18,19,23,24,25,42,51,52,54,58,62,63,64,65,68]
    assert len(IDS) == 15
    assert "G4" in blocker(35)
    assert "Canvas 63" in blocker(61)
    assert "denominadores" in blocker(74)
    assert "homologação" in blocker(78)


def reports():
    return [SimpleNamespace(pk=pk, code=f"legacy123-{legacy}", unit_id=2,
            name="Fictício", legacy={}, connection=None, connection_id=10,
            query_sql="", canvas_layout={}, enabled=False, reviewed=False,
            canvas_enabled=False, version=1) for pk, legacy in IDS.items()]

def test_read_only_inventory_is_repeatable_without_writes():
    objects = MagicMock()
    objects.filter.return_value.select_related.return_value.order_by.return_value = reports()
    cursor = MagicMock()
    with patch("operations.management.commands.audit_legacy_two.ReportDefinition.objects", objects), \
         patch("operations.management.commands.audit_legacy_two.transaction.atomic", return_value=nullcontext()), \
         patch("operations.management.commands.audit_legacy_two.connection.cursor", return_value=cursor):
        first, second = inventory(), inventory()
    cursor.__enter__.return_value.execute.assert_called_with("SET TRANSACTION READ ONLY")
    first.pop("metadata_seconds")
    second.pop("metadata_seconds")
    assert first == second
    assert len(first["reports"]) == 15
    assert first["changed_ids"] == first["created_ids"] == []
    assert not first["writes"] and not first["sends"]
    assert all(row["status"] == "PENDENTE" for row in first["reports"])
    assert not objects.create.called and not objects.update.called

@pytest.mark.parametrize("bad_identity", [False, True])
def test_incomplete_or_wrong_identity_is_rejected(bad_identity):
    values = reports()
    if bad_identity:
        values[0].unit_id = 1
    else:
        values.pop()
    objects = MagicMock()
    objects.filter.return_value.select_related.return_value.order_by.return_value = values
    with patch("operations.management.commands.audit_legacy_two.ReportDefinition.objects", objects), \
         patch("operations.management.commands.audit_legacy_two.transaction.atomic", return_value=nullcontext()), \
         patch("operations.management.commands.audit_legacy_two.connection.cursor", return_value=MagicMock()):
        with pytest.raises(CommandError):
            inventory()
