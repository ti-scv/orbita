import json
import secrets
import uuid
from datetime import timedelta
from urllib.parse import urlencode
from django.core import signing
from django.db import transaction
from django.db.models import Count
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import serializers, viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, PermissionDenied, NotFound
from rest_framework.permissions import AllowAny
from drf_spectacular.utils import extend_schema,extend_schema_view
from drf_spectacular.types import OpenApiTypes
from rest_framework.throttling import AnonRateThrottle
from core.permissions import get_unit
from core.models import Audit
from operations.services import Conflict
from .models import Configuration, Conversation, Event, Booking
from .security import seal, unseal, digest, phone, seal_credentials
from .flow import Flow, TEXTS, OPTIONS
from .oracle import Oracle, SourceError, error_code


def unit_for(request):
    unit=get_unit(request)
    if unit.slug!='sansaude':raise PermissionDenied('Autoagendamento disponível somente para Sansaúde.')
    return unit


def configuration_data(c):
    return {k:getattr(c,k) for k in ('version','enabled','booking_enabled','environment','oracle_host','oracle_port','oracle_sid','oracle_user','validated','validated_identity','public_base_url','redirect_phone','agreement','booking_user','session_minutes','max_cpfs')} | {'has_password':bool(c.password_ciphertext),'options':{**OPTIONS,**c.options},'texts':{**TEXTS,**c.texts}}


class ConfigInput(serializers.Serializer):
    version=serializers.IntegerField(min_value=1)
    enabled=serializers.BooleanField(required=False)
    booking_enabled=serializers.BooleanField(required=False)
    environment=serializers.ChoiceField(choices=['homologation','production'],required=False)
    oracle_host=serializers.CharField(max_length=200,required=False)
    oracle_port=serializers.IntegerField(min_value=1,max_value=65535,required=False)
    oracle_sid=serializers.CharField(max_length=100,required=False)
    oracle_user=serializers.CharField(max_length=100,required=False)
    oracle_password=serializers.CharField(max_length=500,required=False,write_only=True,allow_blank=True)
    admin_password=serializers.CharField(max_length=500,required=False,write_only=True)
    public_base_url=serializers.URLField(required=False,max_length=200)
    redirect_phone=serializers.CharField(max_length=20,required=False,allow_blank=True)
    agreement=serializers.IntegerField(min_value=1,required=False)
    booking_user=serializers.CharField(max_length=100,required=False)
    session_minutes=serializers.IntegerField(min_value=5,max_value=120,required=False)
    max_cpfs=serializers.IntegerField(min_value=1,max_value=10,required=False)
    options=serializers.DictField(child=serializers.BooleanField(),required=False)
    texts=serializers.DictField(child=serializers.CharField(max_length=2000),required=False)


@extend_schema_view(get=extend_schema(responses=OpenApiTypes.OBJECT, tags=['Autoagendamento']), put=extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT, tags=['Autoagendamento']))
class ConfigurationView(APIView):
    def get(self,request):
        c=Configuration.objects.filter(unit=unit_for(request)).first()
        return Response(configuration_data(c) if c else {'configured':False})
    def put(self,request):
        unit=unit_for(request);serializer=ConfigInput(data=request.data);serializer.is_valid(raise_exception=True);data=serializer.validated_data
        password=data.pop('oracle_password','');admin_password=data.pop('admin_password','')
        if password and not request.user.check_password(admin_password):raise ValidationError('Sua senha está incorreta.')
        if set(data.get('options',{}))-set(OPTIONS) or set(data.get('texts',{}))-set(TEXTS):raise ValidationError('Opções ou mensagens desconhecidas.')
        if data.get('public_base_url'):
            from urllib.parse import urlparse
            url=urlparse(data['public_base_url'])
            if url.port==8080 or url.path not in ['', '/'] or url.query or url.fragment:raise ValidationError('Informe a origem do serviço público, sem caminho e fora da porta 8080.')
        if data.get('redirect_phone'):data['redirect_phone']=phone(data['redirect_phone'])
        with transaction.atomic():
            c=Configuration.objects.select_for_update().filter(unit=unit).first()
            if not c:raise ValidationError('Inicialize a configuração da unidade.')
            if data.pop('version')!=c.version:raise Conflict('Configuração alterada. Recarregue a tela.')
            changed=any(k in data and data[k]!=getattr(c,k) for k in ['oracle_host','oracle_port','oracle_sid','oracle_user']) or bool(password)
            for k,v in data.items():setattr(c,k,v)
            if password:c.password_ciphertext=seal_credentials({'password':password},admin_password)
            if changed:c.validated=False;c.validated_identity={};c.booking_enabled=False
            if c.booking_enabled and (not c.enabled or not c.validated):raise ValidationError('Valide a conexão e ative o chat antes de liberar reservas.')
            if c.environment=='homologation' and c.oracle_sid.lower()!='tstvotu':raise ValidationError('Homologação requer o SID tstvotu.')
            c.version+=1;c.save()
            Audit.objects.create(unit=unit,actor=request.user,action='autoagenda.configuration_updated',object_id=str(c.pk),details={'version':c.version,'credentials_changed':bool(password),'booking_enabled':c.booking_enabled})
        return Response(configuration_data(c))


@extend_schema_view(post=extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT, tags=['Autoagendamento']))
class ConnectionCheck(APIView):
    def post(self,request):
        unit=unit_for(request);c=Configuration.objects.get(unit=unit);version=c.version
        try:identity=Oracle(c).check()
        except SourceError as exc:return Response({'ok':False,'code':exc.code},status=400)
        if c.environment=='homologation' and identity.get('DB_NAME','').lower()!='tstvotu':raise ValidationError('A identidade do banco não corresponde à homologação.')
        with transaction.atomic():
            c=Configuration.objects.select_for_update().get(pk=c.pk)
            if c.version!=version:raise Conflict('A conexão foi alterada durante o teste.')
            c.validated=True;c.validated_identity=identity;c.version+=1;c.save()
        return Response({'ok':True,'identity':identity,'version':c.version})


def conversation_data(c):
    last=Event.objects.filter(conversation=c).order_by('-id').first()
    return {'id':str(c.pk),'version':c.version,'state':c.state,'step':c.step,'patient':c.patient,'cpf':c.cpf_masked,'phone':c.phone,'created_at':c.created_at,'last_activity':c.last_activity,'expired':c.last_activity<timezone.now()-timedelta(minutes=c.configuration.session_minutes),'reason':c.reason,'last_event':last.text if last else '', 'attended_by':c.attended_by.username if c.attended_by_id else None}


@extend_schema_view(get=extend_schema(responses=OpenApiTypes.OBJECT, tags=['Autoagendamento']))
class ConsoleView(APIView):
    def get(self,request):
        unit=unit_for(request);qs=Conversation.objects.filter(unit=unit).select_related('configuration','attended_by').order_by('-created_at')
        state=request.query_params.get('state','')
        if state:qs=qs.filter(state=state)
        search=request.query_params.get('search','')[:100]
        if search:
            from django.db.models import Q
            qs=qs.filter(Q(patient__icontains=search)|Q(phone__icontains=search))
        start=request.query_params.get('start');end=request.query_params.get('end')
        from datetime import date
        try:
            if start:qs=qs.filter(created_at__date__gte=date.fromisoformat(start))
            if end:qs=qs.filter(created_at__date__lte=date.fromisoformat(end))
        except ValueError:raise ValidationError('Período inválido.') from None
        counts=dict(qs.values_list('state').annotate(n=Count('pk')))
        try:page=max(1,int(request.query_params.get('page','1')))
        except ValueError:raise ValidationError('Página inválida.') from None
        total=qs.count()
        bookings=Booking.objects.filter(unit=unit,conversation__in=qs)
        by_day=list(bookings.filter(state='confirmed').values('created_at__date').annotate(total=Count('id')).order_by('-created_at__date')[:14])
        by_specialty=list(bookings.filter(state='confirmed').values('specialty').annotate(total=Count('id')).order_by('-total')[:10])
        config=Configuration.objects.filter(unit=unit).first()
        active=qs.filter(state='active',last_activity__gte=timezone.now()-timedelta(minutes=config.session_minutes if config else 30)).count()
        return Response({'count':total,'page':page,'results':[conversation_data(c) for c in qs[(page-1)*25:page*25]],'summary':{'sessions':total,'active':active,'queue':counts.get('human',0),'confirmed':bookings.filter(state='confirmed').count(),'uncertain':bookings.filter(state__in=['pending','uncertain']).count(),'closed':counts.get('closed',0)},'by_day':by_day,'by_specialty':by_specialty})


@extend_schema_view(get=extend_schema(responses=OpenApiTypes.OBJECT, tags=['Autoagendamento']), post=extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT, tags=['Autoagendamento']))
class ConversationView(APIView):
    def get(self,request,pk):
        unit=unit_for(request);c=Conversation.objects.filter(unit=unit,pk=pk).select_related('configuration','attended_by').first()
        if not c:raise NotFound()
        return Response({**conversation_data(c),'view':c.view,'booking':Booking.objects.filter(conversation=c).values('state','slot_id','specialty','professional','scheduled_for','error_code').first(),'events':list(c.events.order_by('id').values('id','actor','text','step','created_at')[:500])})
    def post(self,request,pk):
        unit=unit_for(request)
        if request.data.get('action')=='reconcile':
            c=Conversation.objects.select_related('configuration').filter(unit=unit,pk=pk).first()
            if not c:raise NotFound()
            booking=Booking.objects.filter(conversation=c,state__in=['pending','uncertain']).first()
            if not booking:raise ValidationError('Não há reserva pendente de conferência.')
            state=unseal(c.payload_ciphertext)
            try:found=Oracle(c.configuration).confirmed(state['slot'],state['benef']['CD_PACIENTE_MV'])
            except SourceError as exc:raise ValidationError('Oracle indisponível: '+exc.code) from None
            if not found:return Response({'confirmed':False,'detail':'Reserva não localizada. A procedure não será repetida automaticamente.'})
            with transaction.atomic():
                c=Conversation.objects.select_for_update().get(pk=c.pk)
                booking=Booking.objects.select_for_update().get(pk=booking.pk)
                if booking.state not in ['pending','uncertain']:raise Conflict('Reserva já conferida.')
                booking.state='confirmed';booking.confirmed_at=timezone.now();booking.save()
                flow=Flow(c,state,Oracle(c.configuration));flow.show('scheduled',flow.text('success')+'\n\n'+flow.summary());c.view['done']=True;c.state='scheduled';save(c,state)
                Event.objects.create(conversation=c,actor='operator',text='Reserva confirmada por consulta à view 005.',step='scheduled')
            return Response({'confirmed':True})
        with transaction.atomic():
            c=Conversation.objects.select_for_update().filter(unit=unit,pk=pk).first()
            if not c:raise NotFound()
            if request.data.get('version')!=c.version:raise Conflict('Sessão alterada. Recarregue.')
            note=str(request.data.get('note','')).strip()[:4000]
            if not note:raise ValidationError('Registre a ação realizada.')
            if c.state not in ['human','closed']:raise ValidationError('Ação disponível apenas para encaminhamentos humanos.')
            c.state='closed' if request.data.get('close') else 'human';c.attended_by=request.user;c.version+=1;c.save()
            Event.objects.create(conversation=c,actor='operator',text=note,step=c.step)
        return Response(conversation_data(c))


@extend_schema_view(post=extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT, tags=['Autoagendamento']))
class LinkView(APIView):
    def post(self,request):
        unit=unit_for(request);c=Configuration.objects.get(unit=unit)
        if not c.enabled or not c.validated:raise ValidationError('Ative o chat e valide a conexão.')
        number=phone(request.data.get('phone',''));key=request.headers.get('Idempotency-Key','')
        if not key:raise ValidationError('Idempotency-Key obrigatório.')
        from operations.services import idempotent
        def create():
            token=secrets.token_urlsafe(40)
            row=Conversation.objects.create(unit=unit,configuration=c,token_hash=digest(token),expires_at=timezone.now()+timedelta(hours=2),phone=number)
            ticket=signing.dumps({'id':str(row.pk),'token':token},salt='autoagenda.link')
            return {'id':str(row.pk),'path':'/#ticket='+ticket,'url':c.public_base_url.rstrip('/')+'/#ticket='+ticket,'expires_at':row.expires_at.isoformat()}
        return Response(idempotent(unit,request.user,key,{'path':request.path,'phone':number},create))


class PublicThrottle(AnonRateThrottle):
    rate='120/min'
    scope='autoagenda_public'
    def get_cache_key(self,request,view):
        token=request.headers.get('X-Autoagenda-Session','')
        ident='session:'+digest(token) if 40<=len(token)<=150 else 'entry:'+self.get_ident(request)
        return 'autoagenda:throttle:'+digest(ident)


def public_view(c,session_token=None):
    data={**c.view,'events':list(c.events.order_by('-id').values('id','actor','text','step')[:200])[::-1],'version':c.version,'state':c.state,'step':c.step,'redirect_phone':c.configuration.redirect_phone,'environment':c.configuration.environment}
    if session_token:data['session_token']=session_token;data['conversation_id']=str(c.pk)
    return data


def save(c,state):
    c.payload_ciphertext=seal(state);c.last_activity=timezone.now();c.version+=1;c.save()


def finish_booking(pk):
    c=Conversation.objects.select_related('configuration').get(pk=pk);state=unseal(c.payload_ciphertext);booking=Booking.objects.get(conversation=c)
    repo=Oracle(c.configuration)
    try:
        repo.book(state['slot'],state['benef'],c.phone)
        outcome='confirmed';code=''
    except Exception as exc:
        code=exc.code if isinstance(exc,SourceError) else error_code(exc)
        # A connection/commit failure may follow an Oracle-side commit. Never retry it.
        outcome='failed' if code in ['slot_unavailable','eligibility_changed','booking_disabled','environment_mismatch'] else 'uncertain'
    with transaction.atomic():
        c=Conversation.objects.select_for_update().select_related('configuration').get(pk=pk)
        state=unseal(c.payload_ciphertext);flow=Flow(c,state,repo)
        booking=Booking.objects.select_for_update().get(conversation=c)
        booking.state=outcome;booking.error_code=code
        if outcome=='confirmed':
            booking.confirmed_at=timezone.now();c.state='scheduled';flow.show('scheduled',flow.text('success')+'\n\n'+flow.summary());c.view['done']=True
        elif outcome=='failed' and code=='slot_unavailable':
            c.state='active';flow.say('Esse horário não está mais disponível. Escolha outro.')
            try:flow.slots()
            except Exception:flow.human('Falha ao consultar novos horários.')
        else:
            flow.human('Resultado da reserva requer conferência. Código: '+code)
        booking.save();save(c,state)
    return c


@extend_schema_view(post=extend_schema(request=OpenApiTypes.OBJECT, responses=OpenApiTypes.OBJECT, tags=['Autoagendamento']))
class PublicView(APIView):
    authentication_classes=[]
    permission_classes=[AllowAny]
    throttle_classes=[PublicThrottle]
    def finalize_response(self,request,response,*args,**kwargs):
        response=super().finalize_response(request,response,*args,**kwargs)
        response['Cache-Control']='no-store';response['Referrer-Policy']='no-referrer';response['X-Content-Type-Options']='nosniff'
        return response
    def post(self,request):
        action=request.data.get('action','');token=request.headers.get('X-Autoagenda-Session','')
        if action=='start':
            try:data=signing.loads(str(request.data.get('ticket','')),salt='autoagenda.link',max_age=7200)
            except signing.BadSignature:raise PermissionDenied('Link inválido ou expirado.') from None
            with transaction.atomic():
                c=Conversation.objects.select_for_update().filter(pk=data.get('id'),token_hash=digest(data.get('token','')),redeemed=False).select_related('configuration').first()
                if not c or c.expires_at<timezone.now() or not c.configuration.enabled or c.unit.slug!='sansaude':raise PermissionDenied('Link indisponível.')
                token=secrets.token_urlsafe(40);c.token_hash=digest(token);c.redeemed=True;c.state='active'
                flow=Flow(c,{},Oracle(c.configuration));flow.show('cpf',flow.text('cpf'),input_kind='cpf');save(c,flow.s)
                return Response(public_view(c,token))
        if not token or len(token)>150:raise PermissionDenied('Sessão não autorizada.')
        with transaction.atomic():
            c=Conversation.objects.select_for_update().filter(token_hash=digest(token),redeemed=True).select_related('configuration').first()
            if not c or c.unit.slug!='sansaude':raise PermissionDenied('Sessão não autorizada.')
            if not c.configuration.enabled:raise PermissionDenied('Agendamento temporariamente desativado.')
            if not c.configuration.validated:raise PermissionDenied('Conexão pendente de validação.')
            if c.last_activity<timezone.now()-timedelta(minutes=c.configuration.session_minutes):raise PermissionDenied('Sessão expirada. Solicite um novo link.')
            if c.state=='booking' and c.last_activity<timezone.now()-timedelta(minutes=2):
                state=unseal(c.payload_ciphertext)
                Booking.objects.filter(conversation=c,state='pending').update(state='uncertain',error_code='interrupted_attempt')
                Flow(c,state,Oracle(c.configuration)).human('Tentativa interrompida. Conferir reserva no Oracle antes de qualquer nova tentativa.')
                save(c,state)
            if action=='resume':return Response(public_view(c))
            state=unseal(c.payload_ciphertext)
            key=str(request.data.get('request_id',''))
            try:uuid.UUID(key)
            except ValueError:raise ValidationError('request_id inválido.') from None
            receipts=state.setdefault('receipts',{})
            if key in receipts:return Response(public_view(c))
            if request.data.get('version')!=c.version:raise Conflict('Conversa atualizada. Recarregue antes de continuar.')
            if c.state not in ['active']:return Response(public_view(c))
            now=timezone.now().timestamp();attempts=[t for t in state.get('attempts',[]) if now-t<60]
            if len(attempts)>=20:raise ValidationError('Aguarde um minuto antes de tentar novamente.')
            state['attempts']=[*attempts,now]
            if action not in ['texto','opcao','voltar','sair','humano']:raise ValidationError('Ação inválida.')
            value=str(request.data.get('value',''))[:100]
            if action=='texto':
                import re
                digits=re.sub(r'\D','',value)
                shown=(digits[:3]+'.***.***-'+digits[-2:] if len(digits)==11 else 'CPF informado') if c.step=='cpf' else 'Celular informado'
            elif action=='opcao':
                options=c.view.get('options',[]);shown=next((v['label'] for v in options if v['value']==value),'Opção inválida')
            else:shown={'voltar':'Voltar','sair':'Encerrar','humano':'Solicitar atendimento humano'}[action]
            Event.objects.create(conversation=c,actor='patient',text=shown or 'CPF informado',step=c.step)
            before=json.loads(json.dumps(state,default=str));flow=Flow(c,state,Oracle(c.configuration))
            try:flow.act(action,value);state['failures']=0
            except SourceError as exc:
                state=before;flow=Flow(c,state,Oracle(c.configuration));state['failures']=state.get('failures',0)+1
                if state['failures']>=2:flow.human('Falha técnica na consulta. Código: '+exc.code)
                else:flow.say(flow.text('error'));c.view={**c.view,'message':flow.text('error'),'retry':True}
            except ValueError as exc:raise ValidationError(str(exc)) from None
            state.setdefault('receipts',{})[key]=True
            state['receipts']=dict(list(state['receipts'].items())[-30:]);save(c,state)
            perform=c.state=='booking'
        if perform:c=finish_booking(c.pk)
        return Response(public_view(c))
