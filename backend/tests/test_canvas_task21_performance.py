"""Regression checks for bounded previews, isolation and operational join equivalence."""
from types import SimpleNamespace
from unittest.mock import Mock
import pytest
from operations import report_engine
from operations.report_canvas.preview_sql import optimize, OLD_JOIN
from operations.report_canvas.source_preview import _cache
from operations.models import ReportDefinition
from operations.report_canvas.schema import default_layout


def test_postgres_preview_pushes_limit_and_offset_without_changing_export(monkeypatch):
    conn = SimpleNamespace(engine="postgres", enabled=True, validated=True, unit_id=1, options={}, max_rows=1000)
    report = SimpleNamespace(connection=conn, unit_id=1, query_sql="SELECT 1 AS n; -- final comment", parameter_schema={})
    # Use ordinary SQL with a terminal delimiter; comments and literals remain intact.
    report.query_sql = "SELECT ':literal' AS n;"
    cursor = Mock()
    cursor.description = [("n",)]
    cursor.fetchmany.return_value = [(":literal",)]
    session = Mock()
    session.cursor.return_value = cursor
    report_engine.run_query(report, {}, session=session, typed=True, preview_limit=51, preview_offset=100)
    assert cursor.execute.call_args.args[0].endswith("AS canvas_sample LIMIT 51 OFFSET 100")
    assert cursor.fetchmany.call_args.args == (51,)
    assert cursor.close.called
    report_engine.run_query(report, {}, session=session, typed=True)
    assert cursor.execute.call_args.args[0] == report.query_sql
    assert cursor.fetchmany.call_args.args == (1001,)


def test_postgres_count_is_bounded(monkeypatch):
    conn = SimpleNamespace(engine="postgres", enabled=True, validated=True, unit_id=1, options={}, max_rows=1000)
    report = SimpleNamespace(connection=conn, unit_id=1, query_sql="SELECT 1 AS n", parameter_schema={})
    cursor = Mock()
    cursor.description = [("count",)]
    cursor.fetchmany.return_value = [(10001,)]
    session = Mock()
    session.cursor.return_value = cursor
    _, rows = report_engine.run_query(report, {}, session=session, typed=True, preview_limit=1, preview_count=True)
    assert rows == [[10001]]
    assert "LIMIT 10001" in cursor.execute.call_args.args[0]
    assert cursor.fetchmany.call_args.args == (1,)


def test_operational_rewrite_is_narrow():
    assert optimize("SELECT 1") == "SELECT 1"
    assert optimize("SELECT 1 -- " + OLD_JOIN) == "SELECT 1 -- " + OLD_JOIN
    from operations.operational_sql import query_for
    sql = query_for("response_stats", SimpleNamespace(pk=1, timezone="America/Sao_Paulo"), {})
    assert "UNION ALL" in optimize(sql)
    assert OLD_JOIN not in optimize(sql)
    changed = sql.replace("SELECT DISTINCT ON (appointment_id) appointment_id,id", "SELECT appointment_id,id") + "\n-- SELECT DISTINCT ON (appointment_id) appointment_id,id FROM selected WHERE appointment_id IS NOT NULL ORDER BY appointment_id,data_evento DESC,id DESC"
    assert optimize(changed) == changed


@pytest.fixture
def sample(setup):
    _cache.clear()
    report = ReportDefinition.objects.create(unit=setup["unit"], code="t21", name="T21", source="legacy_pending", enabled=True, reviewed=True, canvas_layout=default_layout())
    return setup["client"], report


def test_preview_pagination_cache_and_changed_input(sample):
    client, report = sample
    url = f"/api/v1/reports/{report.pk}/canvas-source-preview/?unit=ame"
    source = {"id":"s","type":"inline","columns":["n"],"rows":[[i] for i in range(12)]}
    payload = {"source":source,"limit":5,"offset":5}
    first = client.post(url,payload,format="json")
    assert first.status_code == 200
    assert first.data["rows"] == [[5],[6],[7],[8],[9]]
    assert first.data["total_rows"] == 12
    assert first.data["next_offset"] == 10
    assert first.data["total_rows_exact"] is True
    assert client.post(url,payload,format="json").data["cache_hit"] is True
    source["rows"][5] = [99]
    changed = client.post(url,payload,format="json")
    assert changed.data["rows"][0] == [99]
    assert changed.data["cache_hit"] is False
    invalid = client.post(url,{**payload,"offset":10001},format="json")
    assert invalid.status_code == 400


def test_cached_preview_still_requires_permission(sample):
    client, report = sample
    url = f"/api/v1/reports/{report.pk}/canvas-source-preview/?unit=ame"
    data = {"source":{"id":"s","type":"inline","columns":["n"],"rows":[[1]]}}
    assert client.post(url,data,format="json").status_code == 200
    from core.models import Membership
    Membership.objects.filter(unit=report.unit).delete()
    assert client.post(url,data,format="json").status_code == 403


def test_native_cache_with_tuple_keys(sample, monkeypatch):
    client, report = sample
    from operations.report_canvas.sources import Dataset
    from operations.report_canvas.registry import SOURCES
    def read(ctx, spec):
        ctx.native_cache[("native", report.pk)] = {"rows": [["safe"]]}
        return Dataset(["n"], [[1]])
    monkeypatch.setattr(SOURCES["inline"], "read", read)
    url = f"/api/v1/reports/{report.pk}/canvas-source-preview/?unit=ame"
    payload = {"source":{"id":"s","type":"inline","columns":["n"],"rows":[[1]]}}
    assert client.post(url,payload,format="json").status_code == 200
    assert client.post(url,payload,format="json").data["cache_hit"] is True


def test_postgres_pagination_timeout_and_revoked_source(sample, monkeypatch):
    from contextlib import nullcontext
    from operations.models import ReportConnection
    from operations.report_canvas import sources
    client, report = sample
    conn = ReportConnection.objects.create(unit=report.unit,name="T21 PG",engine="postgres",host="db",database="orbita",enabled=True,validated=True)
    report.source="sql"
    report.query_sql="SELECT 1 AS n"
    report.connection=conn
    report.save()
    monkeypatch.setattr(report_engine,"connect",lambda c:nullcontext(object()))
    calls=[]
    def run(child, vals, **kw):
        assert child.connection.timeout_seconds == 5
        calls.append(kw)
        if kw.get("preview_count"):
            return ["count"], [[65]]
        offset=kw["preview_offset"]
        return ["n"],[[i] for i in range(offset, min(offset+kw["preview_limit"], 65))]
    monkeypatch.setattr(sources,"run_query",run)
    url=f"/api/v1/reports/{report.pk}/canvas-source-preview/?unit=ame"
    payload={"source":{"id":"s","type":"report","report_id":report.pk},"limit":50}
    first=client.post(url,payload,format="json")
    assert first.status_code==200
    assert "connection_ms" in first.data["timings"]
    assert len(first.data["rows"])==50
    assert first.data["total_rows"]==65
    assert first.data["total_rows_exact"] is True
    second=client.post(url,{**payload,"offset":50},format="json")
    assert second.data["rows"]==[[i] for i in range(50,65)]
    assert second.data["total_rows"]==65
    assert second.data["total_rows_exact"] is True
    assert second.data["next_offset"] is None
    conn.refresh_from_db()
    assert conn.timeout_seconds==30
    conn.enabled=False
    conn.save()
    assert client.post(url,payload,format="json").status_code==400
    conn.enabled=True
    conn.version+=1
    conn.save()
    def timeout(*a,**kw):raise TimeoutError()
    monkeypatch.setattr(sources,"run_query",timeout)
    response=client.post(url,payload,format="json")
    assert response.status_code==400
    assert response.data["code"]=="source_query_timeout"


def test_short_first_page_avoids_count_but_full_and_later_pages_count(sample, monkeypatch):
    from contextlib import nullcontext
    from operations.models import ReportConnection
    from operations.report_canvas import sources
    client, report = sample
    conn = ReportConnection.objects.create(unit=report.unit, name="PG curta", engine="postgres", host="db", database="orbita", enabled=True, validated=True)
    report.source = "sql"
    report.query_sql = "SELECT 1 AS n"
    report.connection = conn
    report.save()
    monkeypatch.setattr(report_engine, "connect", lambda c: nullcontext(object()))
    calls = []
    size = [2]
    def run(child, vals, **kw):
        calls.append(kw)
        if kw.get("preview_count"):
            return ["count"], [[size[0]]]
        offset = kw["preview_offset"]
        return ["n"], [[i] for i in range(offset, min(offset + kw["preview_limit"], size[0]))]
    monkeypatch.setattr(sources, "run_query", run)
    url = f"/api/v1/reports/{report.pk}/canvas-source-preview/?unit=ame"
    payload = {"source": {"id": "curta", "type": "report", "report_id": report.pk}, "limit": 3}
    first = client.post(url, payload, format="json")
    assert first.data["total_rows"] == 2 and first.data["total_rows_exact"] is True
    assert len(calls) == 1
    size[0] = 5
    payload["source"]["parameters"] = {}
    # Bypass the preview cache by requesting another page size.
    full = client.post(url, {**payload, "limit": 4}, format="json")
    assert full.data["total_rows"] == 5 and full.data["has_more"] is True
    assert calls[-1].get("preview_count") is True
    later = client.post(url, {**payload, "limit": 4, "offset": 4}, format="json")
    assert later.data["total_rows"] == 5 and later.data["total_rows_exact"] is True
    assert calls[-1].get("preview_count") is True
