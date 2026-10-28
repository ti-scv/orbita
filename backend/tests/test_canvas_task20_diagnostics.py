from types import SimpleNamespace
from contextlib import ExitStack
from unittest.mock import patch
import pytest
from rest_framework.exceptions import ValidationError
from operations.report_canvas.diagnostics import safe_error
from operations.report_canvas.sources import ReportSource
from tests.test_report_canvas import env

def test_removes_connection_strings_and_secrets():
    connection=SimpleNamespace(ciphertext="encrypted-private",username="private-user")
    with patch("operations.report_engine.secret",return_value="private-pass"):
        text=safe_error(Exception("relation missing password=private-pass postgresql://private-user:private-pass@db/x encrypted-private"), connection)
    assert "Referência:" in text
    assert "relation missing" not in text
    assert all(s not in text for s in ("private-pass","private-user","encrypted-private","postgresql://"))

def test_real_database_error_identifies_source(env):
    setup, owner, child=env
    child.query_sql="SELECT missing_column FROM totals"
    child.save(update_fields=["query_sql"])
    spec={"id":"dados", "label":"Totais", "type":"report", "report_id":child.pk}
    with ExitStack() as stack:
        ctx=SimpleNamespace(report=owner,parameters={},sessions={},stack=stack)
        with pytest.raises(ValidationError) as error: ReportSource().read(ctx,spec)
    assert "missing_column" not in str(error.value.detail)
    assert "Referência:" in str(error.value.detail)
    assert error.value.detail["source_id"] == "dados"
