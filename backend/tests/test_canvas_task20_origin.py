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
