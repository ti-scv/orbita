import getpass
import json
import os
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from operations.models import ReportDefinition
from operations.operational_sql import migrate_reports
from operations.operational_local_sql import migrate_standard_reports
from operations.reports import HANDLERS


class Command(BaseCommand):
    help = 'Converte fontes operacionais locais para SQL isolado por unidade, após comparar resultados.'

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true')
        parser.add_argument('--admin-user', default='admin')
        parser.add_argument('--password-env', default='')

    def handle(self, *args, **options):
        if not options['apply']:
            self.stdout.write(json.dumps({'pending': ReportDefinition.objects.filter(source='app',handler='app_operational_v1').count() + ReportDefinition.objects.filter(source='local',handler__in=HANDLERS).count(), 'sends': False}))
            return
        password = os.environ.get(options['password_env'], '') if options['password_env'] else getpass.getpass('Senha do administrador SCV: ')
        user = get_user_model().objects.filter(username=options['admin_user'],is_active=True,is_superuser=True).first()
        if not user or not user.check_password(password):
            raise CommandError('Credencial administrativa inválida.')
        result = {'adapted': migrate_reports(password), 'standard': migrate_standard_reports(password)}
        self.stdout.write(json.dumps(result))
