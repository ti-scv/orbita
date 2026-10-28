"""Compatibilidade enquanto a migração de remoção não foi autorizada."""
from django.conf import settings
from rest_framework.exceptions import APIException


def active_conditions():
    return {"removed_at__isnull": True} if settings.REPORT_REMOVAL_ENABLED else {}


class RemovalUnavailable(APIException):
    status_code = 503
    default_detail = "A remoção ainda não foi liberada neste ambiente."
    default_code = "removal_unavailable"


def require_removal():
    if not settings.REPORT_REMOVAL_ENABLED:
        raise RemovalUnavailable()
