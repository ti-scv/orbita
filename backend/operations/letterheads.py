"""Unit-scoped letterhead configuration."""
import base64
import binascii
import io
import math

from django.db import transaction
from PIL import Image, UnidentifiedImageError
from rest_framework import serializers, viewsets
from rest_framework.exceptions import ValidationError

from core.models import Audit, Unit
from core.permissions import get_unit
from operations.models import Letterhead


class LetterheadSerializer(serializers.ModelSerializer):
    background = serializers.CharField(required=False, allow_blank=True)
    margins = serializers.JSONField(required=True)

    class Meta:
        model = Letterhead
        fields = ("id", "name", "active", "is_default", "background", "margins", "fields", "created_by", "created_at", "updated_at")
        read_only_fields = ("id", "created_by", "created_at", "updated_at")

    def to_representation(self, instance):
        result = super().to_representation(instance)
        result["background"] = base64.b64encode(bytes(instance.background)).decode("ascii")
        return result

    def validate_background(self, value):
        if not value:
            return b""
        if len(value) > 2_800_000:
            raise ValidationError("Imagem deve ter até 2 MB.")
        try:
            raw = base64.b64decode(value, validate=True)
            if len(raw) > 2 * 1024 * 1024:
                raise ValueError()
            with Image.open(io.BytesIO(raw)) as image:
                if image.format not in {"PNG", "JPEG"} or image.width * image.height > 16_000_000:
                    raise ValueError()
                image.load()
                if image.width < 100 or image.height < 100:
                    raise ValueError()
        except (ValueError, binascii.Error, OSError, UnidentifiedImageError, Image.DecompressionBombError):
            raise ValidationError("Use PNG ou JPEG válido, de até 2 MB e 16 megapixels.") from None
        return raw

    def validate_margins(self, value):
        if not isinstance(value, dict) or set(value) != {"top", "bottom", "left", "right"}:
            raise ValidationError("Informe as quatro margens em milímetros.")
        if any(type(v) not in (int, float) or not math.isfinite(v) or v < 0 for v in value.values()):
            raise ValidationError("Margens inválidas.")
        if value["top"] + value["bottom"] >= 297 or value["left"] + value["right"] >= 210:
            raise ValidationError("As margens devem deixar uma área de trabalho.")
        return value

    def validate_fields(self, value):
        if not isinstance(value, list) or len(value) > 30:
            raise ValidationError("Informe até 30 campos.")
        for item in value:
            if not isinstance(item, dict) or set(item) != {"type", "text", "x", "y", "font_size", "align"}:
                raise ValidationError("Campo inválido.")
            if item["type"] not in {"title", "date", "period", "unit", "user", "page", "text"} or item["align"] not in {"left", "center", "right"}:
                raise ValidationError("Tipo ou alinhamento inválido.")
            if not isinstance(item["text"], str) or len(item["text"]) > 500:
                raise ValidationError("Texto inválido.")
            for key, low, high in (("x", 0, 210), ("y", 0, 297), ("font_size", 4, 72)):
                v = item[key]
                if type(v) not in (int, float) or not math.isfinite(v) or not low <= v <= high:
                    raise ValidationError("Posição ou tamanho inválido.")
        return value

    def validate(self, attrs):
        active = attrs.get("active", self.instance.active if self.instance else True)
        default = attrs.get("is_default", self.instance.is_default if self.instance else False)
        if default and not active:
            raise ValidationError("O timbrado padrão deve estar ativo.")
        return attrs


class LetterheadViewSet(viewsets.ModelViewSet):
    serializer_class = LetterheadSerializer
    queryset = Letterhead.objects.order_by("name", "id")

    def get_queryset(self):
        return self.queryset.filter(unit=get_unit(self.request))

    def _save(self, serializer, create=False):
        unit = get_unit(self.request, ["admin"])
        with transaction.atomic():
            Unit.objects.select_for_update().get(pk=unit.pk)
            if serializer.validated_data.get("is_default"):
                Letterhead.objects.filter(unit=unit, is_default=True).exclude(pk=getattr(serializer.instance, "pk", None)).update(is_default=False)
            obj = serializer.save(**({"unit": unit, "created_by": self.request.user} if create else {}))
            Audit.objects.create(unit=unit, actor=self.request.user, action="letterhead.created" if create else "letterhead.updated", object_id=str(obj.pk))

    def perform_create(self, serializer):
        self._save(serializer, create=True)

    def perform_update(self, serializer):
        self._save(serializer)

    def perform_destroy(self, instance):
        unit = get_unit(self.request, ["admin"])
        with transaction.atomic():
            Audit.objects.create(unit=unit, actor=self.request.user, action="letterhead.deleted", object_id=str(instance.pk))
            instance.delete()
