import logging
import uuid
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)

def api_exception_handler(exc, context):
    if isinstance(exc, DjangoValidationError):
        exc = ValidationError("Identificador ou parâmetro inválido.")
    response = exception_handler(exc, context)
    if response is not None:
        return response
    reference = uuid.uuid4().hex[:12]
    logger.error("Erro inesperado na API. Referência %s", reference, exc_info=(type(exc), exc, exc.__traceback__))
    return Response({"detail": f"Não foi possível concluir a operação. Referência: {reference}."}, status=500)
