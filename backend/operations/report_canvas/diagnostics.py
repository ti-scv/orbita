"""Detalhes de banco para prévias, sem credenciais ou DSN."""
import re
from rest_framework.exceptions import ValidationError

def safe_error(exc, connection=None):
    detail = getattr(exc, "detail", None)
    if isinstance(detail, dict): detail = detail.get("detail", detail)
    if isinstance(detail, list): detail = "; ".join(map(str, detail))
    primary = getattr(getattr(exc, "diag", None), "message_primary", None)
    message = str(primary or detail or exc).split("\nCONTEXT:")[0].split("\nLINE ")[0]
    # Remove complete URLs and keyword connection strings before truncation.
    message = re.sub(r"[a-zA-Z][a-zA-Z0-9+.-]*://[^\s]+", "[conexão omitida]", message)
    message = re.sub(r"(?i)\b(?:host|dbname|database|user|username|password|passwd|pwd|dsn)\s*=\s*(?:'[^']*'|\"[^\"]*\"|[^\s;,]+)", "[credencial omitida]", message)
    message = re.sub(r"(?i)(password|passwd|pwd|senha)\s*[: ]\s*[^\s,;]+", "credencial omitida", message)
    if connection:
        from operations.report_engine import secret
        try: password = secret(connection)
        except Exception: password = ""
        for value in (password, connection.ciphertext, connection.username):
            if value: message = message.replace(str(value), "[credencial omitida]")
    code = getattr(exc, "sqlstate", None) or getattr(exc, "pgcode", None)
    if code: message = f"{message} (SQLSTATE {code})"
    return message[:1800] or "A fonte não informou uma mensagem de erro."

def source_failure(exc, source, connection=None):
    from .schema import source_label
    return ValidationError({"detail": f'Fonte "{source_label(source)}": {safe_error(exc, connection)}', "source_id": source.get("id", ""), "code": "source_query_failed"})
