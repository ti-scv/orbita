"""Conservative, read-only reconciliation of check-in attendance."""

from core.features import unit_feature_enabled
from dataclasses import dataclass

from django.core.exceptions import ValidationError

from .models import CheckIn, Configuration, Event
from .services import Conflict, transition

MAX_BATCH = 100


@dataclass(frozen=True)
class BatchResult:
    status: str
    next_cursor: int | None = None
    reviewed: tuple = ()
    changed: int = 0


def reconcile_batch(*, unit, source, cursor=0, limit=MAX_BATCH):
    """Process one bounded page; caller owns cursor persistence and retries.

    Review entries contain only local ids and generic reason codes, never source
    data or exceptions. A failure does not advance the cursor.
    """
    if not unit_feature_enabled(unit, "checkin"):
        raise ValidationError("Check-in desabilitado para esta unidade.")
    if type(cursor) is not int or cursor < 0 or type(limit) is not int or not 1 <= limit <= MAX_BATCH:
        raise ValidationError("Cursor ou limite inválido.")
    config = Configuration.objects.filter(unit=unit).first()
    if not config or not config.oracle_enabled:
        return BatchResult("disabled")
    records = list(CheckIn.objects.filter(unit=unit, pk__gt=cursor).select_related("appointment", "booking").order_by("pk")[:limit])
    if not records:
        return BatchResult("complete", next_cursor=cursor)
    eligible = [r for r in records if (r.appointment_id and config.appointment_enabled) or (r.booking_id and config.booking_enabled)]
    if not eligible:
        return BatchResult("ok", next_cursor=records[-1].pk)
    try:
        matches = source.lookup(eligible)
        if not isinstance(matches, dict) or any(k not in {r.pk for r in eligible} for k in matches):
            raise ValueError("invalid source result")
        if any(not isinstance(v, list) or len(v) > 2 or any(type(x) is not bool for x in v) for v in matches.values()):
            raise ValueError("invalid source result")
    except Exception:
        return BatchResult("unavailable", reviewed=tuple((r.pk, "source_unavailable") for r in eligible))
    reviews = []
    changed = 0
    for record in eligible:
        found = matches.get(record.pk, [])
        if len(found) != 1:
            reviews.append((record.pk, "ambiguous" if found else "no_match"))
            continue
        if not found[0]:
            if record.attendance != CheckIn.Attendance.UNKNOWN:
                reviews.append((record.pk, "divergence"))
            continue
        if record.attendance == CheckIn.Attendance.ATTENDED:
            continue
        if record.attendance != CheckIn.Attendance.UNKNOWN:
            reviews.append((record.pk, "divergence"))
            continue
        if Event.objects.filter(checkin=record, idempotency_key="oracle-attended").exists():
            reviews.append((record.pk, "divergence"))
            continue
        try:
            transition(unit=unit, checkin_id=record.pk, version=record.version,
                idempotency_key="oracle-attended", origin="oracle", attendance="attended",
                evidence={"cd_atendimento_present": True, **getattr(source,"evidence",{}).get(record.pk,{}), "agenda_item":record.appointment.external_id if record.appointment_id else record.booking.slot_id})
            if record.appointment_id:
                from scheduling.models import Appointment
                from messaging.models import Message
                Appointment.objects.filter(pk=record.appointment_id,unit=unit,revision=record.source_revision,status="scheduled").update(status="completed")
                Message.objects.filter(unit=unit,appointment_id=record.appointment_id,appointment_revision=record.source_revision,state__in=["preview","queued","blocked"]).update(state="cancelled")
            changed += 1
        except (Conflict, ValidationError, CheckIn.DoesNotExist):
            reviews.append((record.pk, "conflict"))
    return BatchResult("ok", next_cursor=records[-1].pk, reviewed=tuple(reviews), changed=changed)


class OracleAttendanceSource:
    def __init__(self, unit):
        self.unit=unit
        self.evidence={}

    def lookup(self, records):
        from autoagenda.models import Configuration as AutoConfig
        from autoagenda.oracle import Oracle
        from scheduling.connectors import OracleSource
        from contextlib import contextmanager
        config=AutoConfig.objects.filter(unit=self.unit,validated=True).first()
        result={}
        using_auto=not any(r.appointment_id for r in records)
        if using_auto and not config:raise ValueError("autoagenda_connection_not_validated")
        connection=Oracle(config).connection() if using_auto else OracleSource(self.unit).connect()
        with connection as con:
            con.call_timeout=20000
            with con.cursor() as cur:
                cur.execute("SET TRANSACTION READ ONLY") if not using_auto else None
                for r in records:
                    key=r.appointment.external_id if r.appointment_id else r.booking.slot_id
                    if not str(key).isdigit():continue
                    cur.execute("SELECT i.cd_atendimento, i.cd_paciente, a.cd_paciente, i.hr_agenda FROM dbamv.it_agenda_central i LEFT JOIN dbamv.atendime a ON a.cd_atendimento=i.cd_atendimento WHERE i.cd_it_agenda_central=:key", {"key":int(key)})
                    rows=cur.fetchmany(2)
                    if len(rows)==1 and rows[0][0] is not None:
                        self.evidence[r.pk]={"cd_atendimento":int(rows[0][0]),"agenda_item":str(key)}
                    expected=r.appointment.patient_external_id if r.appointment_id else ""
                    result[r.pk]=[x[0] is not None and x[1] is not None and x[1]==x[2] and (not expected or str(x[1])==str(expected)) and x[3] is not None and x[3].date()==r.scheduled_at.astimezone(__import__("zoneinfo").ZoneInfo("America/Sao_Paulo")).date() for x in rows]
            con.rollback()
        return result
