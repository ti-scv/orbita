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


STATUS_LABELS = {
    "pending": "Pendente", "open": "Aberto", "closed": "Concluído", "assigned": "Em atendimento", "waiting_external": "Aguardando ação externa",
    "confirmed": "Confirmado", "declined": "Recusado", "no_response": "Sem resposta",
    "not_confirmed": "Não confirmado", "not_sent": "Não enviado",
    "answered": "Respondido", "received": "Recebido", "sent": "Enviado",
    "failed": "Falhou", "cancelled": "Cancelado", "resolved": "Resolvido",
}


def display_cell(value, column):
    """Format known semantic columns without changing arbitrary identifiers."""
    if value is not None and re.search(r"telefone|whatsapp|celular|phone", str(column), re.I):
        digits = re.sub(r"\D", "", str(value))
        local = digits[2:] if digits.startswith("55") and len(digits) in (12, 13) else digits
        if len(local) in (10, 11):
            return f"+55 ({local[:2]}) {local[2:-4]}-{local[-4:]}"
    if re.search(r"resposta|atendimento|resultado|situação|situacao|status|state|outcome", str(column), re.I):
        return STATUS_LABELS.get(str(value), display(value))
    return display(value)


def export_cell(value, column):
    # Spreadsheet dates and numbers retain their native values and styles.
    if re.search(r"telefone|whatsapp|celular|phone|resposta|atendimento|resultado|situação|situacao|status|state|outcome", str(column), re.I):
        return display_cell(value, column)
    return value
