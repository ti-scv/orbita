from types import SimpleNamespace
import pytest
from rest_framework.exceptions import ValidationError
from operations.report_canvas.parameter_editor import declarations, apply_edits

def report():
    return SimpleNamespace(pk=999999, version=1, parameter_schema={"start":{"type":"date"}}, legacy={"parameters":[{"NOME":"ANTIGO"}]}, query_sql="select :start", canvas_layout={"sources":[],"pages":[]})

def test_live_usage_and_explicit_removal():
    r=report()
    rows=declarations(r)
    assert rows[0]["status"] == "Usado" and "Consulta atual: :start" in rows[0]["uses"]
    assert rows[1]["status"] == "Não usado"
    apply_edits(r,[{"name":"ANTIGO"}])
    assert r.legacy["parameters"] == [] and "start" in r.parameter_schema

def test_unknown_and_unsafe_rename_rejected():
    with pytest.raises(ValidationError): apply_edits(report(),[{"name":"start","rename":"other"}])
    with pytest.raises(ValidationError): apply_edits(report(),[{"name":"unknown"}])
