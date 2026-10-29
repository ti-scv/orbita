"""Conservative reconciliation boundary; no Oracle query or connector is installed.

A future homologated source must implement lookup(records) and return a mapping
from local check-in id to a list of booleans indicating CD_ATENDIMENTO presence.
The source is responsible for a validated, source-specific unique join and for
bounded read-only access. Until then this boundary is exercised with mocks only.
"""
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
    if unit.slug != "sansaude":
        raise ValidationError("Check-in disponível apenas para Sansaúde.")
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
