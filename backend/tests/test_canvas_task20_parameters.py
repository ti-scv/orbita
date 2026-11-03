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

from tests.test_report_canvas import env, post
from operations.report_canvas.schema import default_layout
from unittest.mock import patch

def test_save_is_explicit_and_audits_parameter_changes(env):
    setup, owner, child=env
    owner.legacy={"parameters":[{"NOME":"ANTIGO"}]}
    owner.save(update_fields=["legacy"])
    result=post(setup,owner,"canvas",{"version":owner.version,"layout":default_layout(),"enabled":False,"parameter_edits":[{"name":"ANTIGO"}]})
    assert result.status_code == 200
    owner.refresh_from_db()
    assert owner.legacy["parameters"] == []

def test_duplicate_and_historical_suggestion_are_version_scoped():
    r=report()
    r.legacy["parameters"]=[{"NOME":"TIPO ENVIO"},{"NOME":"DATA INICAL"}]
    r.parameter_schema={"tipo_envio":{"type":"string"}}
    evidence={str(r.pk):{"version":r.version,"items":{"DATA INICAL":{"suggestion":"DATA INICIAL"}}}}
    with patch("operations.report_canvas.parameter_editor.snapshot",return_value=evidence):
        rows=declarations(r)
        assert rows[0]["status"] == "Duplicado"
        assert rows[2]["status"] == "Nome parecido com DATA INICIAL"
        apply_edits(r,[{"name":"DATA INICAL","rename":"DATA INICIAL"}])
        assert r.legacy["parameters"][1]["NOME"] == "DATA INICIAL"
        r.version+=1
        assert not declarations(r)[-1]["suggestion"]
