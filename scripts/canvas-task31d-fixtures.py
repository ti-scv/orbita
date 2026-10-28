"""Execute with manage.py shell only in the disposable 31d database."""
from django.conf import settings
assert settings.DATABASES['default']['NAME'] == 'orbita_t31d'
assert settings.DATABASES['default']['HOST'] == 'orbita-t31d-test-db'
from django.contrib.auth import get_user_model
from django.contrib.sessions.backends.db import SessionStore
from core.models import Unit, Membership
from operations.models import ReportDefinition, ReportConnection, ReportSchedule, ReportAccess
from operations.report_canvas.schema import default_layout
import json
unit,_=Unit.objects.get_or_create(slug='qa31d',defaults={'name':'Unidade de teste 31d'})
user,_=get_user_model().objects.get_or_create(username='qa31d',defaults={'is_superuser':True,'is_staff':True})
Membership.objects.get_or_create(unit=unit,user=user,defaults={'role':'admin'})
columns=['Telefone','Resposta','Atendimento','Responsável']+[f'Coluna {i:02d}' for i in range(5,25)]
rows=[['5517991279767','pending','open','Equipe de teste']+[f'Dado {i}-{j}' for j in range(5,25)] for i in range(1,9)]
layout=default_layout();layout['page'].update(width=1123,height=794)
layout['sources']=[{'id':'wide','type':'inline','columns':columns,'rows':rows}]
layout['pages'][0]['blocks']=[{'id':'title','type':'text','x':20,'y':10,'width':1000,'height':30,'text':'Relatório largo de teste'}, {'id':'table','type':'table','source_id':'wide','title':'Dados de teste','x':20,'y':50,'width':1080,'height':620,'options':{'font_size':8,'columns':columns}}]
ids={}
for code,enabled in [('draft31d',False),('active31d',True)]:
 report,_=ReportDefinition.objects.update_or_create(unit=unit,code=code,defaults={'name':'Relatório largo '+('ativo' if enabled else 'rascunho'),'source':'local','handler':'contacts','enabled':enabled,'reviewed':True,'manual_enabled':True,'canvas_enabled':True,'canvas_layout':layout,'parameter_schema':{'start':{'type':'date','required':False},'end':{'type':'date','required':False}}})
 ids[code]=report.pk
conn,_=ReportConnection.objects.update_or_create(unit=unit,name='Banco de teste',defaults={'engine':'postgres','host':'db','database':'orbita','enabled':False})
linked,_=ReportDefinition.objects.update_or_create(unit=unit,code='linked31d',defaults={'name':'Relatório com vínculo','source':'sql','connection':conn,'enabled':False})
access,_=ReportAccess.objects.get_or_create(unit=unit,user=user,phone='5511999990001')
access.reports.add(linked)
from datetime import time
ReportSchedule.objects.get_or_create(unit=unit,report=linked,access=access,defaults={'send_time':time(9,0)})
ids.update(connection=conn.pk,linked=linked.pk)
s=SessionStore();s['_auth_user_id']=str(user.pk);s['_auth_user_backend']='django.contrib.auth.backends.ModelBackend';s['_auth_user_hash']=user.get_session_auth_hash();s.save()
from pathlib import Path
Path('/qa-session').write_text(s.session_key)
print(json.dumps(ids))
