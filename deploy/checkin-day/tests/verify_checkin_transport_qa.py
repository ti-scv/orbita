from datetime import time,timedelta
from django.db import transaction
from django.test import override_settings
from django.utils import timezone
from core.models import Unit
from scheduling.models import Appointment
from checkin.models import Configuration,CheckIn,Event
from checkin.intents import create_intent
from checkin.deliveries import create_message
from messaging.models import Template,Message,ProviderEvent,Attempt
from messaging.services import dispatch
from messaging.transports import SimulatedTransport
from responses.services import apply_reply
from responses.models import Reply
transaction.set_autocommit(False)
with override_settings(SEND_MODE='simulated',META_REAL_ENABLED=False,CHECKIN_SCHEDULER_ENABLED=True):
 u=Unit.objects.create(slug='qa-transport',name='QA transporte',checkin_enabled=True,paused=False)
 t=Template.objects.create(unit=u,name='qa_checkin',language='pt_BR',purpose='checkin',approved_for_test=True,fields=['day','time'],body='Confirma {{1}} às {{2}}?',components=[{'type':'BUTTONS','buttons':[{'type':'QUICK_REPLY','text':x} for x in ['SIM','NÃO','REMARCAR']]}])
 config=Configuration.objects.create(unit=u,enabled=True,appointment_enabled=True,template=t,parameter_map=['relative_day','time'],timezone='UTC',business_start=time(0),business_end=time(23,59),weekdays=list(range(7)))
 now=timezone.now()
 a=Appointment.objects.create(unit=u,external_id='qa-transport',kind='consultation',patient='Fictício',phone='5517992714448',scheduled_at=now+timedelta(days=1),synthetic=True,source='synthetic')
 row=create_intent(source=a,unit=u);row.planned_send_at=now-timedelta(seconds=1);row.save()
 msg=create_message(row.pk);assert msg.parameters[0]=='amanhã',msg.parameters
 msg.state='queued';msg.save()
 dispatch(msg.pk,transport=SimulatedTransport(),now=now)
 msg.refresh_from_db();row.refresh_from_db()
 assert msg.state=='accepted',msg.error_code
 assert msg.provider_id.startswith('sim.') and row.response=='sent'
 assert Attempt.objects.filter(message=msg,outcome='accepted').count()==1
 dispatch(msg.pk,transport=SimulatedTransport(),now=now)
 assert Attempt.objects.filter(message=msg).count()==1
 print('PASS simulated queue, provider acceptance, no duplicate send and relative day')
 event=ProviderEvent.objects.create(key='qa-ingress',channel_id=msg.channel_id,provider_id='qa-ingress',event_type='reply',occurred_at=timezone.now(),data={'sender':msg.recipient,'text':'SIM','context_id':msg.provider_id})
 apply_reply(event,u);row.refresh_from_db();msg.refresh_from_db()
 assert row.response=='confirmed' and msg.response_state=='answered'
 apply_reply(event,u)
 assert Reply.objects.filter(event=event).count()==1
 print('PASS complete incoming reply route and duplicate webhook')
 count=Event.objects.filter(checkin=row).count()
 event2=ProviderEvent.objects.create(key='qa-unknown',channel_id=msg.channel_id,provider_id='qa-unknown',event_type='reply',occurred_at=timezone.now(),data={'sender':msg.recipient,'text':'NÃO','context_id':'unknown-context'})
 apply_reply(event2,u);row.refresh_from_db()
 assert row.response=='confirmed' and Event.objects.filter(checkin=row).count()==count
 print('PASS unknown context preserves previous decision')
transaction.rollback()
