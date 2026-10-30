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
    if not config or not config.enabled or not config.oracle_enabled:
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
                evidence={"cd_atendimento_present": True})
            changed += 1
        except (Conflict, ValidationError, CheckIn.DoesNotExist):
            reviews.append((record.pk, "conflict"))
    return BatchResult("ok", next_cursor=records[-1].pk, reviewed=tuple(reviews), changed=changed)


class OracleAttendanceSource:
    """Read a validated view keyed by Appointment.external_id.

    Bookings have no homologated external key and never produce a match.
    """
    def __init__(self, unit):
        import re
        from django.conf import settings
        from scheduling.connectors import OracleSource

        identifier = r"[A-Za-z][A-Za-z0-9_$#]*"
        view = settings.CHECKIN_ORACLE_VIEW
        key = settings.CHECKIN_ORACLE_KEY_COLUMN
        if not unit_feature_enabled(unit, "checkin") or not re.fullmatch(identifier + r"(?:\." + identifier + r")?", view) or not re.fullmatch(identifier, key):
            raise ValueError("oracle_view_not_configured")
        self.source = OracleSource(unit)
        self.view, self.key = view, key

    def lookup(self, records):
        result = {}
        with self.source.connect() as connection:
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SET TRANSACTION READ ONLY")
                    for record in records:
                        if not record.appointment_id or not record.appointment.external_id:
                            continue
                        cursor.execute(
                            f"SELECT CD_ATENDIMENTO FROM {self.view} WHERE {self.key} = :source_id FETCH FIRST 2 ROWS ONLY",
                            {"source_id": record.appointment.external_id},
                        )
                        result[record.pk] = [row[0] is not None for row in cursor.fetchmany(2)]
            finally:
                connection.rollback()
        return result
