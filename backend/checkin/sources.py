"""Source snapshots for creation; no matching between source systems."""
from datetime import datetime, timezone as utc
from zoneinfo import ZoneInfo

from django.core.exceptions import ValidationError
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from autoagenda.models import Booking
from scheduling.models import Appointment


def normalize_booking_time(text, zone_name):
    """Return UTC for an unambiguous known format, or None for manual review."""
    try:
        value = parse_datetime(text)
        if value is None:
            value = datetime.strptime(text, "%d/%m/%Y %H:%M:%S")
        if timezone.is_aware(value):
            return value.astimezone(utc.utc)
        zone = ZoneInfo(zone_name)
        first, second = value.replace(tzinfo=zone, fold=0), value.replace(tzinfo=zone, fold=1)
        # Reject ambiguous and nonexistent local times rather than guessing.
        if first.utcoffset() != second.utcoffset():
            return None
        result = first.astimezone(utc.utc)
        return result if result.astimezone(zone).replace(tzinfo=None) == value else None
    except (TypeError, ValueError, KeyError):
        return None


def source_snapshot(source, unit, zone_name="America/Sao_Paulo"):
    if unit.slug != "sansaude" or source.unit_id != unit.pk:
        raise ValidationError("Origem ou unidade não autorizada.")
    if isinstance(source, Appointment):
        return {"unit": unit, "appointment": source, "source_revision": source.revision, "scheduled_at": source.scheduled_at}
    if isinstance(source, Booking):
        return {"unit": unit, "booking": source, "source_revision": 1, "scheduled_at": normalize_booking_time(source.scheduled_for, zone_name)}
    raise ValidationError("Origem não suportada.")
