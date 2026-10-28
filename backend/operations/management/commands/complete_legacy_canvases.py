"""Completa somente Canvas das fontes SQL previamente homologadas."""
import json
from pathlib import Path
from django.core.management.base import BaseCommand, CommandError
from operations.models import ReportDefinition
from operations.legacy_delivery import plan_report, validate_candidate, apply_plans, legacy_inventory


class Command(BaseCommand):
    help = 'Inventaria o legado e valida Canvas sem enviar mensagens; padr?o dry-run.'

    def add_arguments(self, parser):
        parser.add_argument('--archive', required=True)
        parser.add_argument('--output', required=True)
        parser.add_argument('--apply', action='store_true')
        parser.add_argument('--backup', default='')
        parser.add_argument('--approved-plan', default='')

    def handle(self, *args, **options):
        archive = json.loads(Path(options['archive']).read_text())
        output = Path(options['output']); output.mkdir(parents=True, exist_ok=True)
        if options['apply']:
            p = Path(options['backup'])
            if not p.is_file() or p.stat().st_size < 100:
                raise CommandError('Informe o pg_dump conclu?do antes de aplicar.')
            with p.open('rb') as stream:
                stream.seek(max(0, p.stat().st_size - 2000))
                if b'-- PostgreSQL database dump complete' not in stream.read():
                    raise CommandError('Backup incompleto; aplica??o bloqueada.')
            if not options['approved_plan']:
                raise CommandError('Informe --approved-plan com a simula??o anterior.')
            approved = json.loads(Path(options['approved_plan']).read_text())
            if approved.get('mode') != 'dry_run':
                raise CommandError('O plano deve ser uma simula??o.')
        plans = []; checks = []
        for report in ReportDefinition.objects.select_related('unit', 'connection').order_by('pk'):
            values = plan_report(report)
            if values is None:
                continue
            try:
                layout, evidence = validate_candidate(report, values)
                plans.append((report, layout, evidence))
                checks.append({'id': report.pk, 'code': report.code, 'version': report.version,
                               'status': 'validated', **evidence})
            except Exception as exc:
                # No driver exception text: it can expose identifiers or connection details.
                checks.append({'id': report.pk, 'code': report.code, 'status': 'pending',
                               'reason': type(exc).__name__ + ': fonte ou amostra requer revis?o.'})
        if options['apply']:
            expected = {(r['id'], r['version'], r['query_sha256']) for r in approved['checks'] if r['status'] == 'validated'}
            actual = {(r.pk, r.version, evidence['query_sha256']) for r, _, evidence in plans}
            completed = set()
            for row in approved['checks']:
                if row['status'] != 'validated':
                    continue
                current = ReportDefinition.objects.filter(pk=row['id']).first()
                saved = current.legacy.get('canvas_legacy_delivery', {}) if current else {}
                if (saved.get('version') == 1 and saved.get('previous', {}).get('version') == row['version']
                        and saved.get('validation', {}).get('query_sha256') == row['query_sha256']):
                    completed.add((row['id'], row['version'], row['query_sha256']))
            if actual | completed != expected:
                raise CommandError('Simula??o divergente; refa?a o dry-run antes de aplicar.')
        changed = apply_plans(plans) if options['apply'] else []
        result = {'mode': 'apply' if options['apply'] else 'dry_run', 'checks': checks, 'changed': changed,
                  'created_ids': [], 'sends': False, 'inventory': legacy_inventory(archive)}
        (output / 'result.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
        self.stdout.write(json.dumps({'mode': result['mode'], 'validated': sum(c['status']=='validated' for c in checks),
                                     'pending': sum(c['status']=='pending' for c in checks), 'changed': changed,
                                     'legacy_definitions': len(result['inventory']), 'sends': False}))
