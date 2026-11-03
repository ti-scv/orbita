"""Server-side conversation state machine. Options carry indices, never trusted Oracle IDs."""
import re
from django.utils import timezone
from .models import Booking, Event
from .security import cpf_valid, phone
from .oracle import SourceError

LABEL_DEFAULTS = {"new":"Agendar uma consulta","future":"Meus agendamentos","cancel":"Solicitar cancelamento","human":"Falar com atendimento humanizado"}

TEXTS = {
 'cpf':'Para começar, digite o **CPF do paciente** (somente números).',
 'invalid_cpf':'Hmm, esse CPF não parece válido. Confira os números e digite novamente.',
 'menu':'O que você deseja fazer?',
 'specialties':'Para qual **especialidade** você deseja agendar?',
 'providers':'Com qual **profissional** você deseja consultar?',
 'dates':'Estas são as datas disponíveis. Escolha a melhor para você:',
 'slots':'Escolha o horário:',
 'confirm':'Confira os dados e confirme o agendamento.',
 'human':'Encaminhamos sua solicitação para a equipe de agendamento.',
 'error':'Não foi possível consultar os dados. Tente novamente.',
 'success':'Consulta agendada com sucesso!',
 'disabled_booking':'A gravação de agendamentos está desativada. Nenhuma reserva foi realizada.',
 'closed':'Atendimento encerrado.',
}
TEXTS.update({'option_'+k:v for k,v in LABEL_DEFAULTS.items()})

OPTIONS = {'new':True, 'future':True, 'cancel':True, 'human':True}
LABELS = {'new':'Agendar uma consulta','future':'Meus agendamentos','cancel':'Solicitar cancelamento','human':'Falar com atendimento humanizado'}


class Flow:
    def __init__(self, conversation, state, repo):
        self.c = conversation; self.s = state; self.repo = repo; self.cfg = conversation.configuration
    def text(self,key): return self.cfg.texts.get(key,TEXTS.get(key,key))
    def say(self,message):
        Event.objects.create(conversation=self.c,actor='bot',text=message,step=self.c.step)
        return message
    def show(self,step,message,choices=None,input_kind=None,grid=False):
        self.c.step=step
        values=[];options=[]
        for label,value,*extra in choices or []:
            values.append(value);options.append({'label':label,'value':str(len(values)-1), **(extra[0] if extra else {})})
        self.s['choices']=values
        self.c.view={'message':self.say(message),'options':options,'input':input_kind,'grid':grid,'done':False}
        return self.c.view
    def menu(self):
        allowed={**OPTIONS,**self.cfg.options}
        return self.show('menu',self.text('menu'),[(self.cfg.texts.get('option_'+k,v),k) for k,v in LABELS.items() if allowed.get(k,True)])
    def human(self,reason):
        if not self.c.phone:
            self.s['pending_human']=reason
            return self.show('phone','Informe seu celular com WhatsApp e DDD para o atendimento.',input_kind='phone')
        self.c.state='human';self.c.reason=reason[:250]
        self.show('human',self.text('human'));self.c.view['done']=True
        return self.c.view
    def specialty(self):
        rows=self.repo.specialties(self.s['benef']['IDADE'])
        return self.show('specialty',self.text('specialties'),[(r['DS_ESPECIALID'],r) for r in rows]+[('Nenhuma das especialidades',None)])
    def dates(self):
        b=self.s['benef'];sp=self.s['specialty'];pr=self.s['provider']
        dt=self.repo.next_consultation(b['CD_MATRICULA'],sp['CD_ESPECIALID'],pr['CD_PRESTADOR'],b['CD_PACIENTE_MV'])
        rows=self.repo.dates(sp['CD_ESPECIALID'],pr['CD_PRESTADOR'],dt)
        if not rows:return self.human('Sem datas disponíveis para a especialidade/profissional.')
        return self.show('date',self.text('dates'),[(r['DT_AGENDA'],r,{'kind':'retorno' if int(r['CD_TIP_MAR'])==2 else 'consulta'}) for r in rows],grid=True)
    def slots(self):
        rows=self.repo.slots(self.s['specialty']['CD_ESPECIALID'],self.s['provider']['CD_PRESTADOR'],self.s['date']['CD_TIP_MAR'],self.s['date']['DT_AGENDA'])
        if not rows:return self.dates()
        return self.show('slot',self.text('slots'),[(r['HR_AGENDA'],r) for r in rows],grid=True)
    def summary(self):
        h=self.s['slot'];b=self.s['benef']
        return f"**{b['NM_SEGURADO']}**\n{self.s['specialty']['DS_ESPECIALID']}\n{h['NM_PRESTADOR']}\n{h['DH_AGENDA']} · {'Retorno' if int(h['CD_TIP_MAR'])==2 else 'Consulta'}"
    def select_beneficiary(self,choice):
        b=self.repo.beneficiary(choice['CD_MATRICULA'])
        if not b:return self.human('Matrícula não localizada.')
        if str(b['ELEGIBILIDADE']).strip()!='#OK#':return self.human('Elegibilidade: '+str(b['ELEGIBILIDADE']))
        if b['CD_PACIENTE_MV'] in (None,''):return self.human('Beneficiário sem cadastro de paciente no MV.')
        self.s['benef']=b;self.c.patient=b['NM_SEGURADO'];self.say('Olá, **'+b['NM_SEGURADO'].split()[0]+'**!')
        return self.menu()
    def act(self,action,value):
        if action=='sair':
            self.c.state='closed';self.show('closed',self.text('closed'));self.c.view['done']=True;return
        if action=='humano':return self.human('Paciente solicitou atendimento humano.')
        if action=='voltar':
            back={'beneficiary':'cpf','menu':'cpf','specialty':'menu','provider':'specialty','date':'provider','slot':'date','confirm':'slot','blocked':'specialty','future':'menu'}
            step=back.get(self.c.step,'menu')
            if step=='cpf':return self.show('cpf',self.text('cpf'),input_kind='cpf')
            if step=='menu':return self.menu()
            if step=='specialty':return self.specialty()
            if step=='date':return self.dates()
            if step=='slot':return self.slots()
            return self.show('provider',self.text('providers'),[(r['NM_PRESTADOR'],r) for r in self.s.get('providers',[])])
        step=self.c.step
        if step in {'cpf','phone'}:
            if action!='texto':raise ValueError('Digite a informação solicitada.')
            if step=='phone':
                self.c.phone=phone(value);return self.human(self.s.pop('pending_human','Solicitação de atendimento humano.'))
            digits=re.sub(r'\D','',value)
            if not cpf_valid(digits):return self.show('cpf',self.text('invalid_cpf'),input_kind='cpf')
            seen=self.s.setdefault('cpfs',[])
            if digits not in seen:seen.append(digits)
            if len(seen)>self.cfg.max_cpfs:return self.human('Limite de CPFs distintos excedido.')
            self.c.cpf_masked=digits[:3]+'.***.***-'+digits[-2:]
            rows=self.repo.beneficiaries(digits)
            if not rows:return self.human('CPF não localizado entre os beneficiários ativos.')
            if len(rows)==1:return self.select_beneficiary(rows[0])
            return self.show('beneficiary','Selecione o plano do paciente.',[(str(r['DS_PLANO'])+' · '+str(r['NM_RESPONSAVEL_FINANCEIRO']),r) for r in rows])
        if action!='opcao' or not value.isdigit() or int(value)>=len(self.s.get('choices',[])):
            raise ValueError('Selecione uma opção exibida.')
        choice=self.s['choices'][int(value)]
        if step=='beneficiary':return self.select_beneficiary(choice)
        if step=='menu':
            if choice=='new':return self.specialty()
            if choice=='human':return self.human('Paciente solicitou atendimento humano.')
            if choice=='cancel':return self.human('Solicitação de cancelamento: alteração hospitalar pendente da equipe.')
            rows=self.repo.future(self.s['benef']['CD_PACIENTE_MV'])
            message='\n\n'.join(str(r.get('DS_ESPECIALID','Consulta'))+' · '+str(r.get('NM_PRESTADOR',''))+' · '+str(r['DH_AGENDA']) for r in rows) or 'Você não possui agendamentos futuros.'
            return self.show('future',message,[('Voltar ao menu','menu')])
        if step=='future':return self.menu()
        if step=='specialty':
            if choice is None:return self.human('Nenhuma das especialidades.')
            self.s['specialty']=choice
            existing=self.repo.existing(choice['CD_ESPECIALID'],self.s['benef']['CD_PACIENTE_MV'])
            if existing:
                return self.show('blocked','Você já possui agendamento nesta especialidade: '+existing['NM_PRESTADOR']+' · '+existing['DH_AGENDA'],[('Escolher outra especialidade','specialty'),('Falar com atendimento humanizado','human'),('Encerrar atendimento','close')])
            rows=self.repo.providers(choice['CD_ESPECIALID'],self.s['benef']['IDADE']);self.s['providers']=rows
            if not rows:return self.human('Sem profissionais disponíveis.')
            return self.show('provider',self.text('providers'),[(r['NM_PRESTADOR'],r) for r in rows])
        if step=='blocked':
            if choice=='specialty':return self.specialty()
            if choice=='human':return self.human('Paciente já possui agendamento na especialidade.')
            return self.act('sair','')
        if step=='provider':self.s['provider']=choice;return self.dates()
        if step=='date':self.s['date']=choice;return self.slots()
        if step=='slot':
            self.s['slot']=choice
            return self.show('confirm',self.text('confirm')+'\n\n'+self.summary(),[('Confirmar agendamento','confirm'),('Escolher outro horário','slot')])
        if step=='slot_conflict':
            return self.slots() if choice=='slot' else self.human('Conflito de reserva do horário entre sessões.')
        if step=='confirm':
            if choice=='human':return self.human('Paciente solicitou atendimento humano.')
            if choice=='slot':return self.slots()
            if not self.cfg.booking_enabled:
                return self.show('confirm',self.text('disabled_booking')+'\n\n'+self.summary(),[('Escolher outro horário','slot'),('Atendimento humano','human')])
            from django.db import transaction,IntegrityError
            try:
                with transaction.atomic():
                    Booking.objects.update_or_create(conversation=self.c,defaults={'unit':self.c.unit,'state':'pending','error_code':'','slot_id':str(self.s['slot']['CD_IT_AGENDA_CENTRAL']),'specialty':self.s['specialty']['DS_ESPECIALID'],'professional':self.s['provider']['NM_PRESTADOR'],'scheduled_for':self.s['slot']['DH_AGENDA']})
            except IntegrityError:
                return self.show('slot_conflict','Este horário está em confirmação em outra sessão. Escolha outro horário.', [('Escolher outro horário','slot'),('Atendimento humano','human')])
            self.c.state='booking'
            return self.show('booking','Estamos verificando a confirmação do agendamento.')
        raise ValueError('A conversa não aceita esta ação.')
