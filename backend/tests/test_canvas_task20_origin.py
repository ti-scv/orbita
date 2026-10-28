from tests.test_report_canvas import env

def test_origin_reads_sql_and_connection_label_without_running(env):
    setup, owner, child=env
    original=child.version
    child.query_sql="SELECT label,total FROM totals"
    child.save(update_fields=["query_sql"])
    url=f"/api/v1/reports/{owner.pk}/canvas-column-origin/?unit=ame"
    r=setup["client"].post(url,{"source":{"id":"dados","type":"report","report_id":child.pk},"column":"total"},format="json")
    assert r.status_code == 200
    assert r.json()["query"] == child.query_sql
    assert r.json()["database"] == "SQLite · Canvas source"
    assert not any(k in r.json() for k in ("password","host","username","ciphertext"))
    child.refresh_from_db()
    assert child.version == original
    r=setup["client"].post(url,{"source":{"id":"foreign","type":"report","report_id":999999},"column":"total"},format="json")
    assert r.status_code == 400


def test_native_origin_does_not_expose_internal_identifiers(env):
    from unittest.mock import patch
    setup, owner, child = env
    child.handler = "internal_handler_name"
    child.save(update_fields=["handler"])
    url = f"/api/v1/reports/{owner.pk}/canvas-column-origin/?unit=ame"
    with patch("operations.report_canvas.native.datasets", return_value={"internal_dataset": ["total"]}):
        response = setup["client"].post(url, {"source": {"id": "dados", "type": "report", "report_id": child.pk, "dataset": "internal_dataset"}, "column": "total"}, format="json")
    assert response.status_code == 200
    assert response.json()["expression"] == "Dados preparados pelo relatório de origem."
    assert "internal_handler_name" not in response.content.decode()
    assert "internal_dataset" not in response.content.decode()
