from zoneinfo import ZoneInfo
from rest_framework.exceptions import ValidationError
from messaging.models import Message,Template
from responses.models import Reply

FIELDS={"patient","relative_day","date","time","procedure","professional"}
def validate_template(data, instance):
    template=data.get("template",getattr(instance,"template",None))
    mapping=data.get("parameter_map",getattr(instance,"parameter_map",[]))
    if template and instance and template.unit_id != instance.unit_id:
        raise ValidationError("Template pertence a outra unidade.")
    if not isinstance(mapping,list) or any(v not in FIELDS for v in mapping):
        raise ValidationError("Mapeamento de parâmetros inválido.")
    if template and len(mapping)!=len(template.fields):
        raise ValidationError("Mapeie todos os parâmetros do template.")
    if data.get("enabled",getattr(instance,"enabled",False)):
        if not template or not template.approved_for_test:
            raise ValidationError("Selecione um template validado antes de ativar os envios.")
        titles={b.get("text", "").casefold() for c in template.components for b in c.get("buttons",[]) if b.get("type")=="QUICK_REPLY"}
        if not {"sim","não","remarcar"}.issubset(titles):
            raise ValidationError("O template deve conter os botões SIM, NÃO e REMARCAR.")

def content(record,config,at):
    validate_template({},config)
    t=config.template
    if not t:raise ValidationError("Template não selecionado.")
    z=ZoneInfo(config.timezone);local=record.scheduled_at.astimezone(z)
    delta=(local.date()-at.astimezone(z).date()).days
    source=record.appointment if record.appointment_id else record.booking
    values={"patient":source.patient if record.appointment_id else source.conversation.patient,
        "relative_day":"hoje" if delta==0 else "amanhã" if delta==1 else local.strftime("%d/%m/%Y"),
        "date":local.strftime("%d/%m/%Y"),"time":local.strftime("%H:%M"),
        "procedure":source.procedure if record.appointment_id else source.specialty,"professional":source.professional}
    params=[str(values[k]) for k in config.parameter_map]
    body=t.body
    for i,v in enumerate(params,1):body=body.replace("{{"+str(i)+"}}",v)
    return t,params,body

def summary(record):
    source=record.appointment if record.appointment_id else record.booking
    messages=Message.objects.filter(unit=record.unit)
    if record.appointment_id:messages=messages.filter(appointment_id=record.appointment_id,appointment_revision=record.source_revision)
    else:messages=messages.filter(pk=record.message_id) if record.message_id else messages.none()
    messages=messages.filter(state__in=["accepted","sent","delivered","read"])
    last=messages.order_by("-scheduled_for","-created_at").first()
    reply=Reply.objects.filter(message=last).select_related("event").order_by("-event__occurred_at","-pk").first() if last else None
    return {"patient":source.patient if record.appointment_id else source.conversation.patient,
        "procedure":source.procedure if record.appointment_id else source.specialty,"professional":source.professional,
        "external_id":source.external_id if record.appointment_id else source.slot_id,
        "completed":record.attendance=="attended", "message":last.body if last else "",
        "last_reply": {"text":reply.text,"at":reply.event.occurred_at,"phone":reply.sender} if reply else None,
        "attendance_evidence":record.events.filter(origin="oracle").order_by("-version").values_list("evidence",flat=True).first()}


def transport_guard(message):
    from django.conf import settings
    from django.utils import timezone
    from datetime import timedelta
    from messaging.pilot import configuration,authorized_recipients
    from messaging.models import Attempt
    if message.recipient not in authorized_recipients(message.unit):return "recipient_not_allowed"
    try:meta=configuration(message.unit)
    except ValueError as e:return str(e)
    remote=next((t for t in meta.templates if t.get("name")==message.template_name and t.get("language")==message.template_language and t.get("status")=="APPROVED"),None)
    if not remote:return "checkin_template_not_approved"
    body=next((c.get("text","") for c in remote.get("components",[]) if c.get("type")=="BODY"),"")
    if body!=message.template.body or remote.get("components",[])!=message.template.components:return "checkin_catalog_changed"
    start=timezone.now().astimezone(ZoneInfo(message.unit.timezone)).replace(hour=0,minute=0,second=0,microsecond=0)
    if Attempt.objects.filter(message__unit=message.unit,started_at__gte=start).count()>=settings.META_PILOT_DAILY_LIMIT:return "daily_limit"
    return ""
