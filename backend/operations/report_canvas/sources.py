from operations.report_removal_compat import active_conditions
from dataclasses import dataclass
from copy import copy
import hashlib
import json
import math
import time
from rest_framework.exceptions import ValidationError
from operations.models import ReportDefinition
from operations.report_engine import run_query, sql_contract
from .registry import SOURCES
from .schema import fail

@dataclass
class Dataset:
    columns: list
    rows: list
    total: int | None = None
    types: list | None = None


def resolve_report(owner, spec, *, reports_by_id=None):
    if reports_by_id is None:
        child=ReportDefinition.objects.filter(pk=spec["report_id"],unit=owner.unit,**active_conditions(),reviewed=True,review_queue=False).select_related("connection","unit").first()
    else:
        # Request-local catalog index: preserve every restriction of the DB lookup.
        child=reports_by_id.get(spec["report_id"])
        if child and (child.unit_id != owner.unit_id or getattr(child, "removed_at", None) is not None or not child.reviewed or child.review_queue):
            child=None
        if child:
            child=copy(child)
    if not child or (not child.enabled and child.pk!=owner.pk):fail("Fonte indisponível nesta unidade.")
    from .native import datasets
    native=datasets(child)
    dataset=spec.get("dataset","rows")
    if native:
        if dataset not in native:fail("Conjunto de dados não disponível para este relatório.")
        return child
    if child.source!="sql" or not child.connection_id or child.connection.unit_id != owner.unit_id or not child.connection.enabled or not child.connection.validated:
        fail("Fonte SQL indisponível nesta unidade.")
    if spec.get("dataset"):fail("Consulta SQL não possui este conjunto de dados.")
    from operations.report_parameters import normalized_schema
    child.parameter_schema=normalized_schema(child.parameter_schema)
    sql_contract(child.query_sql,child.parameter_schema,child.connection.engine)
    return child


def signature(child):
    from .native import datasets,manifest
    payload={"sql":child.query_sql,"schema":child.parameter_schema,"version":child.version,"connection":child.connection_id,"connection_version":child.connection.version if child.connection_id else None,"handler":child.handler}
    if datasets(child):payload["native"]=manifest(child)
    return hashlib.sha256(json.dumps(payload,sort_keys=True).encode()).hexdigest()


def external_source(child):
    if child.handler in {"lives_indicators_v1", "exams_per_attendance_v1"}:
        return True
    if not child.connection_id or child.connection.engine == "sqlite":
        return False
    from operations.operational_sql import is_internal
    return not (is_internal(child.connection) or child.connection.engine == "postgres" and child.connection.host in {"db", "orbita-db-1", "localhost", "127.0.0.1", "172.16.0.59"})


class InlineSource:
    def validate(self,s):
        cols=s.get("columns");rows=s.get("rows")
        if not isinstance(cols,list) or not 1<=len(cols)<=100 or any(not isinstance(c,str) or not c or len(c)>100 for c in cols) or len(set(cols))!=len(cols) or not isinstance(rows,list) or len(rows)>2000:
            fail("Colunas ou linhas da fonte manual inválidas.")
        for r in rows:
            if not isinstance(r,list) or len(r)!=len(cols) or any(type(v) not in (str,int,float,bool,type(None)) or (isinstance(v,str) and len(v)>2000) or (type(v) is float and not math.isfinite(v)) for v in r):
                fail("Linha da fonte manual inválida.")
    def read(self,context,s): return Dataset(s["columns"],s["rows"])

class GoalsSource:
    def validate(self,s): pass
    def read(self,context,s):
        return Dataset(["year","month","value"],[[r["year"],r["month"],r["value"]] for r in context.goals])

def source_parameter_values(context, source, child):
    defaults = {}
    for key, value in source.get("parameters", {}).items():
        if isinstance(value, dict):
            name = value["parameter"]
            if name not in context.parameters:
                fail("Parâmetro de origem não informado: " + name)
            value = context.parameters[name]
        defaults[key] = value
    runtime = {k: v for k, v in context.parameters.items() if k in child.parameter_schema}
    if context.report.source == "composite" and runtime.get("unidade") == "_origens":
        runtime.pop("unidade")
    return {**defaults, **runtime}

class ReportSource:
    def validate(self,s):
        if "dataset" in s and (not isinstance(s["dataset"],str) or not s["dataset"] or len(s["dataset"])>50):fail("Conjunto de dados inválido.")
        params=s.get("parameters",{})
        if type(s.get("report_id")) is not int or s["report_id"]<1 or not isinstance(params,dict) or len(params)>30 or any(not isinstance(k,str) or len(k)>50 or (type(v) not in (str,int,float,bool,type(None)) and not (isinstance(v,dict) and set(v)=={"parameter"} and isinstance(v["parameter"],str) and len(v["parameter"])<=50)) for k,v in params.items()):
            fail("Fonte SQL ou parâmetros inválidos.")
    def read(self,context,s):
        child = None
        try:
            child = resolve_report(context.report, s)
            return self._read(context, s, child)
        except Exception as exc:
            if getattr(context, "preview_limit", None) is not None and (isinstance(exc, TimeoutError) or getattr(exc, "sqlstate", None) == "57014"):
                from .schema import fail_at
                fail_at("A origem excedeu o tempo de consulta da prévia. Reduza o período e tente novamente.", source_id=s.get("id"), code="source_query_timeout")
            from .diagnostics import source_failure
            raise source_failure(exc, s, child.connection if child and child.connection_id else None) from None

    def _read(self,context,s,child):
        vals = source_parameter_values(context, s, child)
        from .native import datasets,read
        if datasets(child):return read(context,child,s.get("dataset","rows"),vals)
        preview_limit = getattr(context, "preview_limit", None)
        preview_offset = getattr(context, "preview_offset", 0)
        if preview_limit is not None and child.connection.engine == "postgres":
            # A copy keeps the persisted connection and export timeout untouched.
            child.connection = copy(child.connection)
            child.connection.timeout_seconds = min(child.connection.timeout_seconds, 5)
        if child.connection_id not in context.sessions:
            from operations.report_engine import connect
            connection_start = time.perf_counter()
            context.sessions[child.connection_id]=context.stack.enter_context(connect(child.connection))
            if hasattr(context, "timings"):
                context.timings["connection_ms"] = round((time.perf_counter() - connection_start) * 1000, 2)
        column_types = []
        cols,rows=run_query(child,vals,session=context.sessions[child.connection_id],typed=True,column_types=column_types,**({"preview_limit":preview_limit,"preview_offset":preview_offset,"timings":getattr(context,"timings",None)} if preview_limit is not None and child.connection.engine == "postgres" else {}))
        total = None
        if preview_limit is not None and child.connection.engine == "postgres":
            if preview_offset == 0 and len(rows) < preview_limit:
                # The first page includes a lookahead row, so a short page is the full result.
                total = len(rows)
            else:
                try:
                    _, count_rows = run_query(child, vals, session=context.sessions[child.connection_id], typed=True, preview_limit=1, preview_count=True)
                    total = int(count_rows[0][0])
                except Exception:
                    # Keep the sample usable when a bounded count times out or is unsupported.
                    pass
        return Dataset(cols,rows,total,column_types)

SOURCES.register("inline",InlineSource())
SOURCES.register("goals",GoalsSource())
SOURCES.register("report",ReportSource())
