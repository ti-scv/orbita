from django.conf import settings
assert settings.DATABASES['default']['NAME'] == 'orbita_task34'
assert settings.DATABASES['default']['HOST'] == 'orbita-t31d-test-db'
from core.models import Unit,Membership
from operations.models import ReportDefinition
from operations.report_canvas.schema import default_layout
from django.contrib.auth import get_user_model
from django.contrib.sessions.backends.db import SessionStore
from pathlib import Path
u=Unit.objects.create(slug='scv',name='SCV')
a=Unit.objects.create(slug='ame',name='AME Votuporanga')
user=get_user_model().objects.create(username='task34qa',is_superuser=True,is_staff=True)
for unit in (u,a): Membership.objects.create(unit=unit,user=user,role='admin')
layout=default_layout()
for pk,unit,name,loc in [(1,a,'Acompanhamentos e contatos',''),(57,u,'Consultas e exames','ROB8 MENSAGENS CONFIRMACAO CONSULTAS E EXAMES'),(58,u,'Ranking por resposta','AME VOTUPORANGA ROB8'),(59,u,'Ranking por resposta','AME VOTUPORANGA ROB8'),(60,u,'Relatório de Jales','AME JALES ROB8')]:
 ReportDefinition.objects.create(id=pk,unit=unit,code='qa-'+str(pk),name=name,source='local',handler='contacts',enabled=True,reviewed=True,canvas_enabled=True,canvas_layout=layout,legacy={'source_location':{'name':loc}})
s=SessionStore(); s['_auth_user_id']=str(user.pk); s['_auth_user_backend']='django.contrib.auth.backends.ModelBackend'; s['_auth_user_hash']=user.get_session_auth_hash(); s.save(); Path('/tmp/task34-session').write_text(s.session_key)
