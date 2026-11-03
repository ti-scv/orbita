from datetime import datetime,time
from zoneinfo import ZoneInfo
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db import transaction
transaction.set_autocommit(False)
from core.models import Unit
from checkin.models import Configuration,CheckIn
from checkin.programming import calculate_schedule
from rest_framework.test import APIClient

zone=ZoneInfo('America/Sao_Paulo')
u=Unit.objects.create(slug='sansaude',name='QA',checkin_enabled=True)
c=Configuration.objects.create(unit=u,enabled=True,appointment_enabled=True,lead_value=3,business_start=time(7),business_end=time(18),weekdays=list(range(7)))
now=datetime(2026,11,1,6,tzinfo=zone)
for hour,minute,expected in [(8,0,'2026-11-02T18:00:00-03:00'),(9,30,'2026-11-02T18:00:00-03:00'),(10,0,'2026-11-03T07:00:00-03:00'),(15,0,'2026-11-03T12:00:00-03:00')]:
 plan=calculate_schedule(datetime(2026,11,3,hour,minute,tzinfo=zone),c,now)
 assert plan.planned_send_at.astimezone(zone).isoformat()==expected
print('PASS scheduling 3h, opening, inclusive closing and previous day')
c.holidays=['2026-11-02'];plan=calculate_schedule(datetime(2026,11,3,8,tzinfo=zone),c,now)
assert plan.planned_send_at.astimezone(zone).date().isoformat()=='2026-11-01'
c.enabled=False;c.oracle_enabled=True;c.save()
client=APIClient(HTTP_HOST='localhost');user=get_user_model().objects.create_superuser('qa',password='qa-only');client.force_authenticate(user)
result=client.get('/api/v1/checkin-configuration/?unit=sansaude');assert result.status_code==200,str(result.data)
result=client.patch('/api/v1/checkin-configuration/?unit=sansaude',{'lead_value':3,'business_start':'07:00','business_end':'18:00'},format='json');assert result.status_code==200,str(result.data)
from scheduling.models import Appointment
from checkin.intents import create_intent
a=Appointment.objects.create(unit=u,external_id='123',kind='consultation',patient='Paciente fictício',phone='5517992714448',scheduled_at=timezone.now(),professional='Profissional fictício')
record=create_intent(source=a,unit=u)
result=client.get('/api/v1/checkins/?unit=sansaude');assert result.status_code==200,str(result.data);assert result.data['count']==1
assert result.data['results'][0]['summary']['external_id']=='123'
result=client.patch('/api/v1/checkin-configuration/?unit=sansaude',{'enabled':True},format='json');assert result.status_code==400
from checkin.oracle_reconciliation import reconcile_batch
class Source:
 def lookup(self,rows):return {r.pk:[True] for r in rows}
result=reconcile_batch(unit=u,source=Source());assert result.changed==1,str(result)
a.refresh_from_db();assert a.status=='completed'
print('PASS configuration, list, template guard and Oracle completion')
other=Unit.objects.create(slug='other',name='Other',checkin_enabled=True)
from core.models import Membership
operator=get_user_model().objects.create_user('limited',password='qa-only');Membership.objects.create(user=operator,unit=other,role='operator',permissions={'checkin':'write'})
client.force_authenticate(operator);assert client.get('/api/v1/checkins/?unit=sansaude').status_code==403
print('PASS cross-unit isolation')
from messaging.models import Template,ProviderEvent
from checkin.deliveries import create_message
from checkin.replies import apply_checkin_reply
from checkin.services import transition
from datetime import timedelta
t=Template.objects.create(unit=u,name='checkin_qa',language='pt_BR',purpose='checkin',approved_for_test=True,fields=['day','time'],body='Lembrete {{1}} às {{2}}',components=[{'type':'BUTTONS','buttons':[{'type':'QUICK_REPLY','text':x} for x in ['SIM','NÃO','REMARCAR']]}])
c.enabled=True;c.template=t;c.parameter_map=['relative_day','time'];c.holidays=[];c.weekdays=list(range(7));c.save()
for text,outcome in [('SIM','confirmed'),('NÃO','cancelled'),('REMARCAR','reschedule')]:
 a=Appointment.objects.create(unit=u,external_id='qa-'+outcome,kind='consultation',patient='Fictício',phone='5517992714448',scheduled_at=timezone.now()+timedelta(days=2),professional='Teste')
 rec=create_intent(source=a,unit=u)
 msg=create_message(rec.pk);assert msg is not None
 msg.provider_id='qa-provider-'+outcome;msg.channel_id='qa';msg.state='sent';msg.save()
 rec.refresh_from_db();rec.provider_message_id=msg.provider_id;rec.save()
 transition(unit=u,checkin_id=rec.pk,version=rec.version,idempotency_key='qa-sent',origin='automatic',response='sent')
 ev=ProviderEvent.objects.create(key='qa-'+outcome,channel_id='qa',provider_id='reply-'+outcome,event_type='reply',occurred_at=timezone.now(),data={'sender':msg.recipient,'text':text,'context_id':msg.provider_id})
 apply_checkin_reply(ev,u,msg);rec.refresh_from_db()
 if rec.response!=outcome:
  from responses.models import Issue
  print(list(Issue.objects.filter(message=msg).values('description')))
 assert rec.response==outcome,rec.response
print('PASS mapped template and contextual SIM/NAO/REMARCAR replies')
transaction.rollback()
