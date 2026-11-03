"""Check-in copy for the approved Meta template integration."""
from zoneinfo import ZoneInfo


def message_text(scheduled_at, zone_name):
    if scheduled_at is None or scheduled_at.tzinfo is None or scheduled_at.utcoffset() is None:
        raise ValueError("Horário do agendamento inválido.")
    local = scheduled_at.astimezone(ZoneInfo(zone_name))
    return (
        f"Seu agendamento é em {local:%d/%m/%Y} às {local:%H:%M}. "
        "Responda: Confirmar ou Solicitar cancelamento."
    )
