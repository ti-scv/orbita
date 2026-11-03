"""Invent?rio e Canvas de consultas j? homologadas; nunca executa rotinas legadas."""
import copy
import hashlib
import json
import re
import time
from datetime import timedelta
from types import SimpleNamespace
from zoneinfo import ZoneInfo

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from core.models import Audit
from operations.models import ReportDefinition
from operations.external_report_mapping import draft
from operations.report_canvas.ports import text
from operations.report_canvas.sql_columns import query_columns
from operations.report_engine import run_query

VERSION = 1
# Estas consultas j? foram homologadas e alimentam relat?rios/coletas existentes.
# N?o promover procedures ou relat?rios com sem?ntica ainda pendente.
CODES = {
    'legacy123-33', 'legacy123-35', 'bed-position-oracle',
    'snapshot-lives-oracle', 'vidas-sansaude-production-oracle',
    'exams-attendance-exams-source', 'exams-attendance-visits-source',
    'occupancy-patients-production', 'occupancy-attendances-production',
    'occupancy-surgeries-production', 'medical-stays', 'medical-attendances',
    'medical-exams', 'medical-opinions-months', 'medical-opinions-days',
}
FIELDS = ('canvas_layout', 'legacy', 'version')


def sample_parameters(report, today=None):
    today = today or timezone.localtime(timezone.now(), ZoneInfo(report.unit.timezone)).date()
    result = {}
    for name, spec in report.parameter_schema.items():
        if spec.get('default') is not None:
            result[name] = spec['default']
        elif spec.get('type') == 'date':
            start = bool(re.search(r'inicial|inicio|start', name, re.I))
            result[name] = (today - timedelta(days=30) if start else today).isoformat()
        elif spec.get('required', True):
            raise ValidationError('Sem padr?o seguro para o par?metro: ' + name)
    return result


def plan_report(report):
    if report.code not in CODES or report.source != 'sql' or not report.reviewed or report.review_queue:
        return None
    if report.legacy.get('canvas_legacy_delivery', {}).get('version') == VERSION:
        return None
    if report.canvas_layout:
        return None  # Preservar inclusive rascunhos editados manualmente.
    c = report.connection
    if not c or not c.enabled or not c.validated or c.unit_id != report.unit_id:
        return None
    return sample_parameters(report)


def validate_candidate(report, values):
    started = time.monotonic()
    columns, rows = run_query(report, values, typed=True)
    known = query_columns(report.query_sql, report.connection.engine)
    if known and known != columns:
        raise ValidationError('Colunas retornadas divergem da defini??o SQL.')
    if not rows:
        raise ValidationError('Nenhum dado na amostra; manter pendente at? validar per?odo com registros.')
    layout = draft(report, {'columns': columns})
    if not layout:
        raise ValidationError('Sem campos para montar o Canvas.')
    for i, page in enumerate(layout['pages']):
        page['blocks'].append(text('source_' + str(i),
            'Fonte: ' + report.connection.name + ' ? ' + report.code,
            32, 86, 1536, 17, 10))
    # Pr?-validar todos os blocos com as linhas reais, sem nova consulta e sem persistir pacientes.
    from operations.report_canvas.registry import BLOCKS
    from operations.report_canvas.sources import Dataset
    from operations.report_canvas.pdf import PDFExporter
    ctx = SimpleNamespace(datasets={'dados': Dataset(columns, rows)}, parameters=values,
                          report=report, assets={}, goals=[])
    pages = [{**p, 'blocks': [BLOCKS[b['type']].prepare(b, ctx) for b in p['blocks']]} for p in layout['pages']]
    document = {'name': report.name, 'page': layout['page'], 'pages': pages}
    rendered = PDFExporter().render(document)
    elapsed = round(time.monotonic() - started, 3)
    return layout, {'rows': len(rows), 'columns': columns,
                    'types': {c: sorted({type(r[i]).__name__ for r in rows if r[i] is not None})
                              for i, c in enumerate(columns)},
                    'elapsed_seconds': elapsed,
                    'auto_preview': elapsed <= 5, 'pdf_bytes': len(rendered),
                    'query_sha256': hashlib.sha256(report.query_sql.encode()).hexdigest(),
                    'parameters': values, 'numeric_parity': 'Fonte previamente homologada; SQL e filtros preservados.'}


def apply_plans(plans):
    changed = []
    with transaction.atomic():
        for original, layout, evidence in plans:
            current = ReportDefinition.objects.select_for_update().get(pk=original.pk)
            if current.version != original.version or current.query_sql != original.query_sql or current.canvas_layout:
                raise ValidationError('Relat?rio alterado ap?s a simula??o: ' + original.code)
            previous = {field: copy.deepcopy(getattr(current, field)) for field in FIELDS}
            current.canvas_layout = layout
            # Amostra com dados pessoais nunca faz parte do layout ou da evid?ncia versionada.
            current.legacy = {**current.legacy, 'canvas_legacy_delivery': {
                'version': VERSION, 'previous': previous, 'validation': evidence,
                'data_mode': 'preview' if evidence.get('auto_preview') else 'sample', 'sends': False}}
            current.version += 1
            current.save(update_fields=FIELDS)
            Audit.objects.create(unit=current.unit, action='report.legacy_canvas_completed',
                                 object_id=str(current.pk), details={'code': current.code, 'rows': evidence['rows'], 'sends': False})
            changed.append(current.pk)
    return changed


def legacy_inventory(archive):
    current = {(r.unit.slug, r.code): r for r in ReportDefinition.objects.select_related('unit', 'connection')}
    rows = []
    for old in sorted(archive['reports'], key=lambda r: r['ID_RELATORIO']):
        code = 'legacy123-' + str(old['ID_RELATORIO'])
        r = current.get(('scv', code))
        if r is None:
            rows.append({'legacy_id': old['ID_RELATORIO'], 'name': old.get('NOME_RELATORIO') or code,
                         'exists': False, 'canvas': False, 'source_ready': False,
                         'note': 'Cadastro legado ausente; origem e permiss?es precisam ser recuperadas.'})
            continue
        mapping = r.legacy.get('external_mapping', {})
        has_source = (r.source == 'sql' and r.connection_id and r.connection.enabled and r.connection.validated
                      and r.connection.unit_id == r.unit_id and bool(r.query_sql) and r.reviewed)
        if r.handler and r.reviewed and r.canvas_enabled:
            has_source = True
        if r.source == 'composite' and r.reviewed and r.canvas_enabled:
            has_source = True
        if has_source and r.connection_id and (not r.connection.enabled or not r.connection.validated):
            has_source = False
        if has_source and r.canvas_enabled:
            from operations.report_canvas.engine import report_readiness
            if report_readiness(r):
                has_source = False
        note = mapping.get('blocker') or '; '.join(str(v) for v in r.dependencies) or r.unavailable_reason
        if not has_source and r.connection_id and (not r.connection.enabled or not r.connection.validated):
            note = 'Conexao desativada ou nao validada. ' + note
        if r.source == 'sql' and not r.query_sql.strip():
            note = 'Consulta SELECT ainda ausente. ' + note
        if r.review_queue:
            note = 'Revis?o/manuten??o: n?o executar como relat?rio. ' + note
        elif has_source and r.canvas_layout and not r.canvas_enabled:
            note = 'Canvas edit?vel ligado ? fonte homologada; formato e coleta existentes preservados.'
        elif has_source and r.canvas_enabled:
            note = 'Integrado; valida??o num?rica anterior preservada.'
        elif r.source == 'external_file':
            note = 'PDF pronto: arquivo dispon?vel n?o comprova gerador ou Canvas edit?vel. ' + note
        rows.append({'legacy_id': old['ID_RELATORIO'], 'id': r.pk, 'name': r.name, 'unit': r.unit.slug,
                     'kind': r.catalog_kind, 'exists': True, 'canvas': bool(r.canvas_layout),
                     'source_ready': bool(has_source), 'enabled': r.enabled, 'reviewed': r.reviewed,
                     'note': note or 'Falta homologar consulta, tipos, per?odo e equival?ncia num?rica.'})
    return rows


def revert_canvases(ids, *, apply=False):
    """Revers?o por registro; recusa qualquer edi??o posterior ? entrega."""
    changed = []
    with transaction.atomic():
        for pk in sorted(set(ids)):
            current = ReportDefinition.objects.select_for_update().get(pk=pk)
            saved = current.legacy.get('canvas_legacy_delivery', {})
            previous = saved.get('previous', {})
            if saved.get('version') != VERSION or current.version != previous.get('version', -2) + 1:
                raise ValidationError('Edi??o posterior ou entrega ausente; revers?o bloqueada: ' + str(pk))
            if hashlib.sha256(current.query_sql.encode()).hexdigest() != saved['validation']['query_sha256']:
                raise ValidationError('Consulta alterada; revers?o bloqueada: ' + str(pk))
            if apply:
                current.canvas_layout = previous['canvas_layout']
                current.legacy = previous['legacy']
                current.version += 1
                current.save(update_fields=FIELDS)
                Audit.objects.create(unit=current.unit, action='report.legacy_canvas_reverted',
                                     object_id=str(pk), details={'sends': False})
            changed.append(pk)
    return changed
