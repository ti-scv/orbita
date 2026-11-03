import json,sys
from pathlib import Path
from django.core.management.base import BaseCommand,CommandError
from django.db import transaction
from core.models import Unit,Audit
from autoagenda.models import Configuration
from autoagenda.security import seal

class Command(BaseCommand):
    help='Inicializa Sansaúde; padrão dry-run. Recebe credenciais exclusivamente por stdin.'
    def add_arguments(self,p):
        p.add_argument('--apply',action='store_true');p.add_argument('--backup',default='')
    def handle(self,*args,**options):
        payload=json.load(sys.stdin)
        required={'host','porta','sid','usuario','senha'}
        if not required<=set(payload) or payload['sid'].lower()!='tstvotu' or payload['host']!='172.16.2.254':raise CommandError('Origem de homologação incompatível.')
        if not payload['senha']:raise CommandError('Credencial ausente.')
        if not options['apply']:
            self.stdout.write(json.dumps({'mode':'dry_run','unit':'sansaude','credentials_available':True,'sid':payload['sid'],'writes':False}));return
        backup=Path(options['backup'])
        if not backup.is_file():raise CommandError('Informe backup concluído.')
        with backup.open('rb') as stream:
            stream.seek(max(0,backup.stat().st_size-2000))
            if b'-- PostgreSQL database dump complete' not in stream.read():raise CommandError('Backup incompleto.')
        with transaction.atomic():
            unit=Unit.objects.select_for_update().get(slug='sansaude')
            c,created=Configuration.objects.get_or_create(unit=unit,defaults={
                'enabled':True,'booking_enabled':False,'environment':'homologation',
                'oracle_host':payload['host'],'oracle_port':int(payload['porta']),
                'oracle_sid':payload['sid'],'oracle_user':payload['usuario'],
                'password_ciphertext':seal({'password':payload['senha']}),
                'redirect_phone':payload.get('redirect_phone',''),
                'public_base_url':'http://172.16.0.59:8081'})
            if created:Audit.objects.create(unit=unit,action='autoagenda.initialized',object_id=str(c.pk),details={'environment':'homologation','booking_enabled':False})
        self.stdout.write(json.dumps({'created':created,'id':c.pk,'unit':'sansaude','booking_enabled':c.booking_enabled}))
