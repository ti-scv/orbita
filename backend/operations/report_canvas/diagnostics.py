"""Detalhes de banco para prévias, sem credenciais ou DSN."""
import re
from rest_framework.exceptions import ValidationError

def safe_error(exc, connection=None):
    import logging
    import uuid
    reference = uuid.uuid4().hex[:12]
    logging.getLogger(__name__).error("Falha na origem. Referência %s", reference, exc_info=(type(exc), exc, exc.__traceback__))
    return f"Não foi possível consultar a origem. Referência: {reference}."

def source_failure(exc, source, connection=None):
    from .schema import source_label
    return ValidationError({"detail": f'Fonte "{source_label(source)}": {safe_error(exc, connection)}', "source_id": source.get("id", ""), "code": "source_query_failed"})
