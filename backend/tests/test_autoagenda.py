import copy
import uuid
from datetime import timedelta
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from core.models import Unit,Membership
from autoagenda.models import Configuration,Conversation,Booking,Event
from autoagenda.security import seal,unseal,cpf_valid
from autoagenda.api import finish_booking
from autoagenda.oracle import SourceError

class Repo:
    def __init__(self,*args):pass
    def beneficiaries(self,cpf):return [{'CD_MATRICULA':1,'DS_PLANO':'Teste','NM_RESPONSAVEL_FINANCEIRO':'Fictício'}]
    def beneficiary(self,matricula):return {'CD_MATRICULA':1,'NM_SEGURADO':'Paciente Fictício','CD_PLANO':1,'CD_PACIENTE_MV':10,'ELEGIBILIDADE':'#OK#','IDADE':30}
    def specialties(self,age):return [{'CD_ESPECIALID':1,'DS_ESPECIALID':'Clínica teste'}]
    def existing(self,*args):return None
    def providers(self,*args):return [{'CD_PRESTADOR':9,'NM_PRESTADOR':'Profissional Teste'}]
    def next_consultation(self,*args):return None
    def dates(self,*args):return [{'DT_AGENDA':'30/10/2026','CD_TIP_MAR':1}]
    def slots(self,*args):return [{'CD_AGENDA_CENTRAL':1,'CD_IT_AGENDA_CENTRAL':77,'CD_UNIDADE_ATENDIMENTO':1,'CD_SETOR':1,'CD_ITEM_AGENDAMENTO':1,'CD_SERVICO':1,'CD_PRESTADOR':9,'NM_PRESTADOR':'Profissional Teste','CD_TIP_MAR':1,'TEMPO_CONSULTA':15,'DH_AGENDA':'30/10/2026 09:00:00','HR_AGENDA':'09:00'}]
    def book(self,*args):pass
    def check(self):return {'DB_NAME':'tstvotu','INSTANCE_NAME':'tstvotu'}
    def confirmed(self,*args,**kwargs):return True

@pytest.fixture
def env(db):
    from django.core.cache import cache
    cache.clear()
    unit=Unit.objects.create(slug='sansaude', checkin_enabled=True, autoagenda_enabled=True,name='Sansaúde')
    cfg=Configuration.objects.create(unit=unit,enabled=True,validated=True,password_ciphertext=seal({'password':'fictional'}))
    user=get_user_model().objects.create_superuser(username='auto-admin',password='test-auto-pass')
    client=APIClient(HTTP_HOST='localhost');client.force_authenticate(user)
    with patch('autoagenda.api.Oracle',Repo):yield unit,cfg,client

def open_chat(env):
    _,_,admin=env
    result=admin.post('/api/v1/autoagenda/links/?unit=sansaude',{'phone':'17992714448'},format='json',HTTP_IDEMPOTENCY_KEY=str(uuid.uuid4()))
    assert result.status_code==200,result.data
    ticket=result.data['path'].split('#ticket=')[1]
    client=APIClient(HTTP_HOST='localhost')
    result=client.post('/api/v1/autoagenda/public/',{'action':'start','ticket':ticket},format='json')
    assert result.status_code==200,result.data
    assert result.data['unit_name']==env[0].name and result.data['unit_logo']==env[0].logo
    token=result.data['session_token'];return client,token,result.data,ticket

def action(client,token,view,act,value='',key=None):
    return client.post('/api/v1/autoagenda/public/',{'action':act,'value':value,'version':view['version'],'request_id':key or str(uuid.uuid4())},format='json',HTTP_X_AUTOAGENDA_SESSION=token)

def to_confirm(env):
    client,token,data,ticket=open_chat(env)
    for act,value in [('texto','37436716468'),('opcao','0'),('opcao','0'),('opcao','0'),('opcao','0'),('opcao','0')]:
        response=action(client,token,data,act,value);assert response.status_code==200,response.data;data=response.data
    assert data['step']=='confirm';return client,token,data

def test_cpf_check_digits():
    assert cpf_valid('374.367.164-68')
    assert not cpf_valid('11111111111') and not cpf_valid('37436716469')

def test_isolated_sessions_one_use_links_and_no_plaintext_state(env):
    a,token_a,data_a,ticket_a=open_chat(env);b,token_b,data_b,_=open_chat(env)
    response=action(a,token_a,data_a,'texto','37436716468');assert response.status_code==200
    assert response.data['step']=='menu'
    resumed=b.post('/api/v1/autoagenda/public/',{'action':'resume'},format='json',HTTP_X_AUTOAGENDA_SESSION=token_b)
    assert resumed.data['step']=='cpf' and resumed.data['version']==data_b['version']
    replay=a.post('/api/v1/autoagenda/public/',{'action':'start','ticket':ticket_a},format='json');assert replay.status_code==403
    assert all('37436716468' not in c.payload_ciphertext for c in Conversation.objects.all())
    assert not Event.objects.filter(text__contains='37436716468').exists()

def test_invalid_cpf_retries_but_missing_beneficiary_queues_human(env):
    client,token,data,_=open_chat(env)
    r=action(client,token,data,'texto','123');assert r.data['step']=='cpf'
    with patch.object(Repo,'beneficiaries',return_value=[]):r=action(client,token,r.data,'texto','37436716468')
    assert r.data['state']=='human' and r.data['done']
    assert Conversation.objects.get(token_hash=__import__('autoagenda.security',fromlist=['digest']).digest(token)).reason

def test_booking_disabled_and_tampered_options_cannot_write(env):
    client,token,data=to_confirm(env)
    with patch.object(Repo,'book',side_effect=AssertionError('Must not write')):
        r=action(client,token,data,'opcao','0')
    assert r.status_code==200 and r.data['state']=='active'
    assert not Booking.objects.exists()
    r=action(client,token,r.data,'opcao','-1');assert r.status_code==400

def test_booking_idempotency_conflict_and_success(env):
    env[1].booking_enabled=True;env[1].save()
    client,token,data=to_confirm(env);key=str(uuid.uuid4())
    with patch.object(Repo,'book') as book:
        r=action(client,token,data,'opcao','0',key);assert r.status_code==200,r.data
        assert r.data['state']=='scheduled'
        repeated=action(client,token,data,'opcao','0',key);assert repeated.status_code==200
        assert book.call_count==1 and Booking.objects.count()==1
    assert Booking.objects.get().state=='confirmed'

def test_uncertain_result_never_retries_procedure(env):
    env[1].booking_enabled=True;env[1].save()
    client,token,data=to_confirm(env)
    with patch.object(Repo,'book',side_effect=SourceError('ORA-03113')) as book:
        r=action(client,token,data,'opcao','0');assert r.data['state']=='human'
        action(client,token,r.data,'opcao','0')
        assert book.call_count==1
    assert Booking.objects.get().state=='uncertain'

def test_concurrent_version_and_expired_session(env):
    client,token,data,_=open_chat(env)
    newer=action(client,token,data,'texto','123')
    assert action(client,token,data,'texto','123').status_code==409
    Conversation.objects.update(last_activity=timezone.now()-timedelta(hours=3))
    assert action(client,token,newer.data,'texto','123').status_code==403

def test_configuration_and_console_unit_permissions(env):
    unit,cfg,admin=env
    assert admin.get('/api/v1/autoagenda/config/?unit=sansaude').data['has_password']
    assert 'password_ciphertext' not in admin.get('/api/v1/autoagenda/config/?unit=sansaude').data
    other=Unit.objects.create(slug='ame',name='Outra')
    assert admin.get('/api/v1/autoagenda/console/?unit=ame').status_code==403
    user=get_user_model().objects.create_user(username='reader');Membership.objects.create(unit=unit,user=user,role='viewer',permissions={'autoagenda':'read'})
    client=APIClient(HTTP_HOST='localhost');client.force_authenticate(user)
    assert client.get('/api/v1/autoagenda/console/?unit=sansaude').status_code==200
    assert client.post('/api/v1/autoagenda/links/?unit=sansaude',{'phone':'17992714448'},format='json').status_code==403
    assert client.put('/api/v1/autoagenda/config/?unit=sansaude',{'version':1},format='json').status_code==403

def test_messages_and_options_editable_config_conflict_invalidates_connection(env):
    _,cfg,admin=env
    r=admin.put('/api/v1/autoagenda/config/?unit=sansaude',{'version':cfg.version,'texts':{'cpf':'Digite o CPF.'},'options':{'cancel':False}},format='json')
    assert r.status_code==200,r.data
    _,_,data,_=open_chat(env);assert data['message']=='Digite o CPF.'
    assert admin.put('/api/v1/autoagenda/config/?unit=sansaude',{'version':1},format='json').status_code==409
    r=admin.put('/api/v1/autoagenda/config/?unit=sansaude',{'version':r.data['version'],'oracle_user':'OTHER'},format='json');assert not r.data['validated'] and not r.data['booking_enabled']

def test_disabled_and_human_resolution_audit(env):
    unit,cfg,admin=env;client,token,data,_=open_chat(env)
    r=action(client,token,data,'humano');c=Conversation.objects.get(state='human')
    r=admin.post(f'/api/v1/autoagenda/conversations/{c.pk}/?unit=sansaude',{'version':c.version,'note':'Ligação realizada.','close':True},format='json')
    assert r.status_code==200 and r.data['state']=='closed'
    assert Event.objects.filter(conversation=c,actor='operator',text='Ligação realizada.').exists()
    cfg.enabled=False;cfg.save()
    assert client.post('/api/v1/autoagenda/public/',{'action':'resume'},format='json',HTTP_X_AUTOAGENDA_SESSION=token).status_code==403


def test_reconcile_checks_view_without_repeating_procedure(env):
    _,cfg,admin=env;cfg.booking_enabled=True;cfg.save()
    client,token,data=to_confirm(env)
    with patch.object(Repo,'book',side_effect=SourceError('ORA-03113')):
        action(client,token,data,'opcao','0')
    row=Conversation.objects.get(state='human')
    with patch.object(Repo,'book',side_effect=AssertionError('Never retry')):
        r=admin.post(f'/api/v1/autoagenda/conversations/{row.pk}/?unit=sansaude',{'action':'reconcile'},format='json')
    assert r.status_code==200 and r.data['confirmed']
    row.refresh_from_db();assert row.state=='scheduled' and Booking.objects.get().state=='confirmed'

def test_menu_options_are_independent_from_messages(env):
    env[1].options={'new':False,'cancel':False};env[1].save()
    client,token,data,_=open_chat(env)
    r=action(client,token,data,'texto','37436716468')
    labels=[o['label'] for o in r.data['options']]
    assert 'Agendar uma consulta' not in labels and 'Solicitar cancelamento' not in labels
    assert 'Meus agendamentos' in labels

@pytest.mark.django_db(transaction=True)
def test_real_postgresql_row_locks_serialize_two_operators():
    import concurrent.futures,threading
    from django.db import connection,transaction,close_old_connections
    from core.models import Unit
    if connection.vendor!='postgresql':pytest.skip('PostgreSQL required')
    unit=Unit.objects.create(slug='sansaude', checkin_enabled=True, autoagenda_enabled=True,name='Sansaúde')
    cfg=Configuration.objects.create(unit=unit)
    c=Conversation.objects.create(unit=unit,configuration=cfg,token_hash='a'*64,expires_at=timezone.now()+timedelta(hours=1))
    barrier=threading.Barrier(2)
    def update():
        close_old_connections();barrier.wait()
        with transaction.atomic():
            row=Conversation.objects.select_for_update().get(pk=c.pk)
            row.version+=1;row.save(update_fields=['version'])
        close_old_connections()
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        jobs=[pool.submit(update) for _ in range(2)]
        for job in jobs:job.result(timeout=15)
    c.refresh_from_db();assert c.version==3

def test_two_patients_cannot_reserve_same_slot(env):
    env[1].booking_enabled=True;env[1].save()
    a,token_a,data_a=to_confirm(env);b,token_b,data_b=to_confirm(env)
    with patch.object(Repo,'book') as book:
        first=action(a,token_a,data_a,'opcao','0')
        second=action(b,token_b,data_b,'opcao','0')
        assert first.data['state']=='scheduled' and second.data['step']=='slot_conflict'
        assert book.call_count==1 and Booking.objects.count()==1


def test_explicit_autoagenda_grant_covers_configuration_console_and_followup(env):
    unit,cfg,admin=env
    user=get_user_model().objects.create_user(username="auto-editor", password="fictional")
    member=Membership.objects.create(unit=unit,user=user,role="operator",permissions={"autoagenda":"write"})
    client=APIClient(HTTP_HOST="localhost"); client.force_authenticate(user)
    for endpoint in ("config", "console"):
        assert client.get(f"/api/v1/autoagenda/{endpoint}/?unit=sansaude").status_code == 200
    assert client.put("/api/v1/autoagenda/config/?unit=sansaude", {"version":cfg.version,"session_minutes":35}, format="json").status_code == 403
    assert admin.put("/api/v1/autoagenda/config/?unit=sansaude", {"version":cfg.version,"session_minutes":35}, format="json").status_code == 200
    row=Conversation.objects.create(unit=unit,configuration=cfg,token_hash="fictional",expires_at=timezone.now()+timedelta(hours=1),state="human")
    path=f"/api/v1/autoagenda/conversations/{row.pk}/?unit=sansaude"
    assert client.get(path).status_code == 200
    assert client.post(path,{"version":row.version,"note":"Atendimento fictício"},format="json").status_code == 200
    member.permissions={"autoagenda":"none"}; member.save()
    for endpoint in ("config", "console", f"conversations/{row.pk}"):
        assert client.get(f"/api/v1/autoagenda/{endpoint}/?unit=sansaude").status_code == 403
    assert client.put("/api/v1/autoagenda/config/?unit=sansaude",{"version":2},format="json").status_code == 403
