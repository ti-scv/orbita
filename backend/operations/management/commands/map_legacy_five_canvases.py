"""Mapeia somente o lote A; leitura Oracle não equivale a aceite do cache legado."""
import copy
import hashlib
import json
import time
from pathlib import Path
from types import SimpleNamespace

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from core.models import Audit
from operations.models import ReportDefinition
from operations.external_report_mapping import draft
from operations.report_canvas.ports import text
from operations.report_canvas.schema import validate_layout
from operations.report_engine import connect, sql_contract

IDS = {30: 'legacy123-17', 42: 'legacy123-30', 67: 'legacy123-57',
       76: 'legacy123-66', 77: 'legacy123-67'}
COLUMNS = {
    30: ['CD_UNID_INT', 'DS_UNID_INT', 'QUANTIDADE', 'DATA'],
    42: ['Atendimento', 'Prestador', 'DS_ESPECIALID', 'Dias_Internado', 'Hora_Alta',
         'Motivo_Alta', 'Data_Alta_Medica', 'Hora_Alta_Medica', 'Data_Alta_Hospitalar',
         'Hora_Alta_Hospitalar', 'TIPO_CONVENIO', 'NM_USUARIO', 'CD_PRESTADOR',
         'Alta_Medica', 'H_Alta_Medica'],
    67: ['ID', 'COMPETENCIA', 'DIA', 'Centro_Cirurgico', 'CONVENIO', 'TP_CIRURGIAS'],
    76: ['CD_ATENDIMENTO', 'DT_SOLICITACAO', 'DS_ESPECIALID', 'DT_PARECER', 'DATA'],
    77: ['CD_ATENDIMENTO', 'Competencia', 'Tipo_Atendimento'],
}
KEY = 'legacy_five_mapping'
PENDING = ('Pendente: amostra do cache legado aceita por Danilo para comparar totais e filtros; '
           'leitura Oracle não homologa o cálculo dos consumidores. Sem ativação ou envio.')


def sha(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False,
                                    default=str).encode()).hexdigest()


def state(report):
    return {f.attname: getattr(report, f.attname) for f in report._meta.concrete_fields}


def eligible(report):
    c = report.connection
    if (IDS.get(report.pk) != report.code or report.unit_id != 2 or report.source != 'sql'
            or report.reviewed or report.enabled or report.canvas_enabled or report.review_queue
            or not c or c.pk != 1 or c.unit_id != 2 or not c.enabled or not c.validated
            or c.engine != 'oracle' or report.parameter_schema
            or report.query_sql != report.legacy.get('original_sql')):
        raise CommandError('Estado fora do lote ou consulta alterada: ' + str(report.pk))
    sql_contract(report.query_sql, {}, 'oracle')


def probe(report):
    started = time.monotonic()
    with connect(report.connection) as session:
        session.call_timeout = 8000
        cursor = session.cursor()
        try:
            cursor.arraysize = 51
            cursor.execute(report.query_sql.rstrip().rstrip(';'))
            columns = [c[0] for c in cursor.description]
            oracle_types = [str(c[1]) for c in cursor.description]
            rows = cursor.fetchmany(51)
        finally:
            cursor.close()
    if columns != COLUMNS[report.pk] or not rows:
        raise CommandError('Colunas divergentes ou amostra vazia: ' + str(report.pk))
    sample = rows[:50]
    from operations.report_canvas.registry import BLOCKS
    from operations.report_canvas.sources import Dataset
    from operations.report_canvas.pdf import PDFExporter
    layout = mapped_layout(report, columns)
    ctx = SimpleNamespace(datasets={'dados': Dataset(columns, sample)},
                          parameters={}, report=report, assets={}, goals=[])
    pages = [{**p, 'blocks': [BLOCKS[b['type']].prepare(b, ctx) for b in p['blocks']]}
             for p in layout['pages']]
    pdf = PDFExporter().render({'name': report.name, 'page': layout['page'], 'pages': pages})
    return layout, {
        'columns': columns, 'oracle_types': dict(zip(columns, oracle_types)),
        'sample_types': {c: sorted({type(row[i]).__name__ for row in sample if row[i] is not None})
                         for i, c in enumerate(columns)},
        'sample_rows': len(sample), 'has_more': len(rows) > 50,
        'elapsed_seconds': round(time.monotonic() - started, 3), 'sample_pdf_bytes': len(pdf),
        'sql_equals_legacy_original': True, 'numeric_parity': 'pending_accepted_legacy_sample',
        'read_only': True, 'query_sha256': hashlib.sha256(report.query_sql.encode()).hexdigest(),
    }


def mapped_layout(report, columns):
    value = copy.deepcopy(report.canvas_layout) or draft(report, {'columns': columns})
    # Preservar blocos existentes e apenas identificar a origem de cada página.
    for i, page in enumerate(value['pages']):
        block_id = 'legacy_five_source_' + str(i)
        if not any(b['id'] == block_id for b in page['blocks']):
            page['blocks'].append(text(block_id, 'Fonte: Oracle Santa Casa · ' + report.code
                                      + ' · consulta original · homologação pendente',
                                      32, 86, 1536, 24, 10))
    return validate_layout(value)


def apply_plan(plan):
    changed = []
    if (plan.get('mode') != 'dry_run' or len(plan['reports']) != len(IDS)
            or set(r['id'] for r in plan['reports']) != set(IDS)):
        raise CommandError('Simulação deve conter exatamente os cinco IDs do lote A.')
    with transaction.atomic():
        for row in plan['reports']:
            r = ReportDefinition.objects.select_for_update(of=("self",)).select_related('connection').get(pk=row['id'])
            eligible(r)
            saved = r.legacy.get(KEY, {})
            if saved.get('plan_sha256') == sha(row):
                if saved.get('applied_state_sha256') != sha({
                        'layout': r.canvas_layout, 'version': r.version}):
                    raise CommandError('Canvas editado após aplicação: ' + str(r.pk))
                continue
            if row['before_sha256'] != sha(state(r)):
                raise CommandError('Cadastro alterado desde a simulação: ' + str(r.pk))
            if not row['evidence']['read_only'] or row['evidence']['numeric_parity'] != 'pending_accepted_legacy_sample':
                raise CommandError('Evidência incompatível.')
            previous = {f: copy.deepcopy(getattr(r, f)) for f in ['canvas_layout', 'legacy', 'version']}
            r.canvas_layout = validate_layout(row['layout'])
            r.version += 1
            r.legacy = {**r.legacy, KEY: {
                'version': 1, 'previous': previous, 'validation': row['evidence'],
                'pending': PENDING, 'plan_sha256': sha(row),
                'applied_state_sha256': sha({'layout': r.canvas_layout, 'version': r.version})}}
            r.save(update_fields=['canvas_layout', 'legacy', 'version'])
            Audit.objects.create(unit=r.unit, action='report.legacy_five_draft_mapped',
                                 object_id=str(r.pk), details={'code': r.code, 'sends': False,
                                 'homologated': False, 'sample_rows': row['evidence']['sample_rows']})
            changed.append(r.pk)
    return changed


def revert_plan(plan, *, apply=False):
    """Reverte apenas os cinco layouts; recusa qualquer versão posterior."""
    if (plan.get('mode') != 'dry_run' or len(plan['reports']) != len(IDS)
            or {row['id'] for row in plan['reports']} != set(IDS)):
        raise CommandError('Plano fora do lote A.')
    changed = []
    with transaction.atomic():
        for row in plan['reports']:
            records = ReportDefinition.objects.select_related('connection')
            if apply:
                records = records.select_for_update(of=("self",))
            r = records.get(pk=row['id'])
            eligible(r)
            saved = r.legacy.get(KEY, {})
            if (saved.get('plan_sha256') != sha(row)
                    or saved.get('applied_state_sha256') != sha({
                        'layout': r.canvas_layout, 'version': r.version})):
                raise CommandError('Edição posterior ou mapeamento ausente: ' + str(r.pk))
            if apply:
                r.canvas_layout = saved['previous']['canvas_layout']
                r.legacy = saved['previous']['legacy']
                r.version += 1
                r.save(update_fields=['canvas_layout', 'legacy', 'version'])
                Audit.objects.create(unit=r.unit, action='report.legacy_five_draft_reverted',
                                     object_id=str(r.pk), details={'sends': False})
            changed.append(r.pk)
    return changed


class Command(BaseCommand):
    help = 'Mapeia cinco rascunhos sem homologar fontes; padrão dry-run, sem procedures/envios.'

    def add_arguments(self, p):
        p.add_argument('--output', required=True)
        p.add_argument('--apply', action='store_true')
        p.add_argument('--backup', default='')
        p.add_argument('--approved-plan', default='')

    def handle(self, *args, **opts):
        output = Path(opts['output'])
        output.parent.mkdir(parents=True, exist_ok=True)
        if opts['apply']:
            backup = Path(opts['backup'])
            if not backup.is_file() or backup.stat().st_size < 100:
                raise CommandError('Informe pg_dump concluído antes da aplicação.')
            with backup.open('rb') as stream:
                stream.seek(max(0, backup.stat().st_size - 2000))
                if b'-- PostgreSQL database dump complete' not in stream.read():
                    raise CommandError('Backup incompleto.')
            if not opts['approved_plan']:
                raise CommandError('Informe a simulação em --approved-plan.')
            plan = json.loads(Path(opts['approved_plan']).read_text())
            result = {'mode': 'apply', 'changed': apply_plan(plan), 'created_ids': [], 'sends': False}
        else:
            reports = list(ReportDefinition.objects.filter(pk__in=IDS)
                           .select_related('connection', 'unit').order_by('pk'))
            if {r.pk for r in reports} != set(IDS):
                raise CommandError('Lote incompleto.')
            rows = []
            for r in reports:
                eligible(r)
                try:
                    layout, evidence = probe(r)
                except Exception as exc:
                    # Drivers podem expor detalhes de acesso; registrar apenas a classe.
                    raise CommandError('Leitura/Canvas bloqueado no ID ' + str(r.pk)
                                       + ': ' + type(exc).__name__) from None
                rows.append({'id': r.pk, 'code': r.code, 'unit': 'scv', 'version': r.version,
                             'before_sha256': sha(state(r)), 'layout': layout,
                             'evidence': evidence, 'pending': PENDING})
            result = {'mode': 'dry_run', 'reports': rows, 'created_ids': [], 'sends': False}
        output.write_text(json.dumps(result, ensure_ascii=False, indent=2))
        output.chmod(0o600)
        self.stdout.write(json.dumps({k: v for k, v in result.items() if k != 'reports'}))
