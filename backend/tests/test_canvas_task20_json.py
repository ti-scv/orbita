import json
from tests.test_report_canvas import env
from operations.report_canvas.schema import default_layout

def test_json_validation_is_read_only_and_matches_save(env):
    setup, report, child = env
    client=setup["client"]
    url=f"/api/v1/reports/{report.pk}/canvas-validate/?unit=ame"
    original=report.canvas_layout
    r=client.post(url,{"json":"{\n invalid}"},format="json")
    assert r.status_code == 400 and r.json()["line"] == 2 and r.json()["column"] == 2
    valid=default_layout()
    r=client.post(url,{"json":json.dumps(valid)},format="json")
    assert r.status_code == 200 and r.json()["layout"] == valid
    report.refresh_from_db()
    assert report.canvas_layout == original
    valid["page"]["width"] = 1
    r=client.post(url,{"json":json.dumps(valid)},format="json")
    assert r.status_code == 400 and "Esquema inválido" in r.json()["detail"]

def test_json_cannot_reference_other_units_or_unknown_assets(env):
    setup, report, child=env
    valid=default_layout()
    valid["sources"]=[{"id":"foreign","type":"report","report_id":999999}]
    r=setup["client"].post(f"/api/v1/reports/{report.pk}/canvas-validate/?unit=ame", {"json":json.dumps(valid)},format="json")
    assert r.status_code == 400 and "outra unidade" in r.json()["detail"]
