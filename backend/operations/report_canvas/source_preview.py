"""Bounded source samples; no export behavior or production settings are changed."""
import hashlib
import json
import logging
import pickle
import time
from contextlib import ExitStack
from types import SimpleNamespace
from django.core.cache.backends.locmem import LocMemCache
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from core.models import Audit
from .schema import default_layout, validate_layout, fail_at, source_label
from .registry import SOURCES
from .sources import Dataset, signature, external_source
from .native import datasets

logger = logging.getLogger(__name__)
# Private per-worker memory, bounded entries/size, no Redis or disk persistence.
_cache = LocMemCache("canvas-source-preview-t21", {"TIMEOUT": 15, "OPTIONS": {"MAX_ENTRIES": 32}})

def source_preview(view, request):
    from .api import context_report, infer_column_metadata, serialize_cell
    start_time = time.perf_counter()
    report = context_report(view, request)

    source = request.data.get("source")
    if not isinstance(source, dict):
        fail_at("Informe a especificação da fonte para a prévia.", code="source_required")

    source_type = source.get("type")
    if not isinstance(source_type, str) or source_type not in SOURCES:
        fail_at(f'Tipo de fonte desconhecido: "{source_type}".', code="source_type_invalid")

    validation_layout = default_layout()
    validation_layout["sources"] = [source]
    validate_layout(validation_layout)
    if source_type == "report":
        from .sources import resolve_report
        child = resolve_report(report, source)
    else:
        child = None

    raw_params = request.data.get("parameters")
    params = raw_params if isinstance(raw_params, dict) else {}

    raw_limit = request.data.get("limit", 50)
    try:
        limit = int(raw_limit)
        if not (1 <= limit <= 500):
            limit = 50
    except (ValueError, TypeError):
        limit = 50

    try:
        offset = int(request.data.get("offset", 0))
    except (ValueError, TypeError):
        offset = -1
    if not 0 <= offset <= 10000:
        fail_at("Página inválida: use offset entre 0 e 10.000.", code="source_page_invalid")
    postgres = bool(child and child.connection_id and child.connection.engine == "postgres" and not datasets(child))
    external = bool(child and external_source(child))
    # Authorization and source contract were checked above, even on cache hits.
    identity = [request.user.pk, report.unit_id, report.pk, report.version,
                report.monthly_goals, {k:v for k,v in source.items() if k not in {"id","label","dataset"}},
                params, signature(child) if child else None]
    base_key = hashlib.sha256(json.dumps(identity, sort_keys=True, default=str).encode()).hexdigest()
    page_key = base_key + ":" + str(source.get("dataset")) + ":" + str(limit) + ":" + str(offset)
    cached = _cache.get(page_key)
    cache_hit = cached is not None
    timings = {}
    read_start = time.perf_counter()
    with ExitStack() as stack:
        ctx = SimpleNamespace(
            report=report,
            parameters=params,
            goals=report.monthly_goals,
            assets={},
            datasets={},
            sessions={},
            native_cache=_cache.get(base_key + ":native") or {},
            preview_limit=limit + 1,
            preview_offset=offset,
            stack=stack,
            timings=timings,
        )
        try:
            dataset = cached if cache_hit else SOURCES[source_type].read(ctx, source)
            if not cache_hit and len(pickle.dumps([dataset, ctx.native_cache])) <= 2 * 1024 * 1024:
                _cache.set(page_key, dataset, 15)
                if ctx.native_cache:
                    _cache.set(base_key + ":native", ctx.native_cache, 15)
        except ValidationError:
            raise
        except Exception as exc:
            if isinstance(exc, TimeoutError) or getattr(exc, "sqlstate", None) == "57014":
                fail_at("A origem excedeu o tempo de consulta da prévia. Reduza o período e tente novamente.", source_id=source.get("id"), code="source_query_timeout")
            from .diagnostics import safe_error
            logger.warning("Canvas source preview failed (details suppressed)")
            fail_at(
                f'Fonte "{source_label(source)}": {safe_error(exc)}',
                source_id=source.get("id"),
                code="source_connection_failed",
            )

    read_ms = round((time.perf_counter() - read_start) * 1000, 2)
    serialize_start = time.perf_counter()
    bounded_total = dataset.total
    total_rows = len(dataset.rows)
    has_more = total_rows > limit if postgres else total_rows > offset + limit
    if not postgres:
        dataset = Dataset(dataset.columns, dataset.rows[offset:offset + limit])
    else:
        dataset = Dataset(dataset.columns, dataset.rows[:limit])
    if total_rows > 30000:
        fail_at(
            f'Fonte "{source_label(source)}" excede o limite de 30.000 linhas (retornou {total_rows}).',
            source_id=source.get("id"),
            code="source_limit_exceeded",
        )
    raw_size = len(json.dumps(dataset.rows, default=str).encode())
    if raw_size > 10 * 1024 * 1024:
        fail_at(
            f'Fonte "{source_label(source)}" excede o limite de 10 MB.',
            source_id=source.get("id"),
            code="source_size_exceeded",
        )

    columns = [
        infer_column_metadata(col_name, [r[col_idx] for r in dataset.rows])
        for col_idx, col_name in enumerate(dataset.columns)
    ]

    # The local adapter declares these types even when the requested period has no values.
    from .native import LOCAL_COLUMN_TYPES
    from operations.reports import HANDLERS
    if child and child.source == "local" and child.handler in HANDLERS:
        for column in columns:
            if column["type"] == "unknown" and column["name"] in LOCAL_COLUMN_TYPES:
                column["type"] = LOCAL_COLUMN_TYPES[column["name"]]
                column["estimated"] = True

    preview_rows = [
        [serialize_cell(cell) for cell in row]
        for row in dataset.rows[:limit]
    ]

    serialize_ms = round((time.perf_counter() - serialize_start) * 1000, 2)
    elapsed_ms = int((time.perf_counter() - start_time) * 1000)

    Audit.objects.create(
        unit=report.unit,
        actor=request.user,
        action="report.canvas_source_previewed",
        object_id=str(report.pk),
        details={
            "source_id": source.get("id"),
            "source_type": source_type,
            "total_rows": total_rows,
            "elapsed_ms": elapsed_ms,
        },
    )

    effective_parameters = None
    if child and not datasets(child):
        from operations.report_engine import parameters as resolve_parameters
        from .sources import source_parameter_values
        supplied = source_parameter_values(SimpleNamespace(report=report, parameters=params), source, child)
        values = resolve_parameters(child, supplied)
        effective_parameters = [
            {"name": name, "label": spec.get("label") or name, "value": serialize_cell(values[name]),
             "default": name not in supplied and spec.get("default") is not None}
            for name, spec in child.parameter_schema.items()
        ]

    if child and child.handler == "app_operational_v1":
        from .sources import source_parameter_values
        from operations.app_reporting import date_range
        supplied = source_parameter_values(SimpleNamespace(report=report, parameters=params), source, child)
        start, end = date_range(child.unit, supplied)
        effective_parameters = [
            {"name": name, "label": label, "value": str(value), "default": not supplied.get(name)}
            for name, label, value in [("start", "Data inicial", start), ("end", "Data final", end)]
        ]

    if child and child.handler == "app_operational_v1":
        from .sources import source_parameter_values
        from operations.app_reporting import date_range
        supplied = source_parameter_values(SimpleNamespace(report=report, parameters=params), source, child)
        start, end = date_range(child.unit, supplied)
        effective_parameters = [
            {"name": name, "label": label, "value": str(value), "default": not supplied.get(name)}
            for name, label, value in [("start", "Data inicial", start), ("end", "Data final", end)]
        ]

    return Response({
        "effective_parameters": effective_parameters,
        "columns": columns,
        "rows": preview_rows,
        "truncated": has_more,
        "has_more": has_more,
        "offset": offset,
        "next_offset": offset + limit if has_more else None,
        "total_rows": (min(bounded_total, 10000) if bounded_total is not None else offset + total_rows) if postgres else total_rows,
        "total_rows_exact": (bounded_total <= 10000 if bounded_total is not None else not has_more) if postgres else True,
        "total_rows_capped": bounded_total is not None and bounded_total > 10000,
        "cache_hit": cache_hit,
        "external": external,
        "notice": "Origem externa: o tempo depende do sistema consultado." if external else "",
        "timings": {**timings, "read_ms": read_ms, "serialize_ms": serialize_ms},
        "elapsed_ms": elapsed_ms,
    })

