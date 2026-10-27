import re
from datetime import date, datetime

ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$")


def display(value):
    """Canvas table values, preserving the source timezone and date-only midnight."""
    if value is None or (isinstance(value, str) and not value.strip()):
        return "—"
    if isinstance(value, str) and ISO_DATE.fullmatch(value):
        try:
            value = datetime.fromisoformat(value)
        except ValueError:
            pass
    if isinstance(value, datetime):
        has_time = any((value.hour, value.minute, value.second, value.microsecond))
        return value.strftime("%d/%m/%Y %H:%M:%S" if has_time else "%d/%m/%Y")
    if isinstance(value, date):
        return value.strftime("%d/%m/%Y")
    return str(value)
