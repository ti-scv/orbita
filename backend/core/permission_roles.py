from rest_framework import serializers, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.authentication import SessionAuthentication

from core.access import LEVELS, local_permissions
from core.models import PermissionRole
from core.permissions import get_unit


ROLE_TYPES = ("messages", "settings", "reports", "reportWhatsApp")


class PermissionRoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = PermissionRole
        fields = ("id", "name", "permissions")

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Informe um nome.")
        unit = get_unit(self.context["request"])
        existing = PermissionRole.objects.filter(unit=unit, name=value)
        if self.instance:
            existing = existing.exclude(pk=self.instance.pk)
        if existing.exists():
            raise serializers.ValidationError("Já existe um tipo com este nome nesta unidade.")
        return value

    def validate_permissions(self, value):
        if not isinstance(value, dict) or set(value) != set(ROLE_TYPES) or any(
            not isinstance(level, str) or level not in LEVELS for level in value.values()
        ):
            raise serializers.ValidationError("Informe os quatro tipos com none, read ou write.")
        return value


class PermissionRoleViewSet(viewsets.ModelViewSet):
    authentication_classes = [SessionAuthentication]
    serializer_class = PermissionRoleSerializer
    http_method_names = ["get", "post", "put", "patch", "head", "options"]

    def get_queryset(self):
        return PermissionRole.objects.filter(unit=get_unit(self.request)).order_by("name", "id")

    def perform_create(self, serializer):
        unit = get_unit(self.request, ["admin"])
        if local_permissions(self.request.user, unit)["settings"] != "write":
            raise PermissionDenied("Sem permissão para alterar tipos de acesso.")
        serializer.save(unit=unit)

    def perform_update(self, serializer):
        unit = get_unit(self.request, ["admin"])
        if local_permissions(self.request.user, unit)["settings"] != "write":
            raise PermissionDenied("Sem permissão para alterar tipos de acesso.")
        serializer.save()
