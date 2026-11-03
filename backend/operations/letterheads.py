"""Unit-scoped letterhead configuration."""
import base64
import binascii
import io
import math

from core.models import Audit, Unit
from core.permissions import get_unit
from django.db import transaction
from PIL import Image, UnidentifiedImageError
from rest_framework import serializers, viewsets
from rest_framework.exceptions import ValidationError

from operations.models import Letterhead


def _validate_svg(raw):
    """Accept only static SVG shapes; reject active content and references."""
    from defusedxml import ElementTree

    allowed = {"svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "text", "tspan", "defs", "linearGradient", "radialGradient", "stop", "clipPath"}
    try:
        root = ElementTree.fromstring(raw, forbid_dtd=True, forbid_entities=True, forbid_external=True)
        if root.tag != "{http://www.w3.org/2000/svg}svg":
            raise ValueError()
        for node in root.iter():
            if not node.tag.startswith("{http://www.w3.org/2000/svg}") or node.tag.split("}", 1)[-1] not in allowed:
                raise ValueError()
            for key, value in node.attrib.items():
                name = key.split("}")[-1].lower()
                if name.startswith("on") or name in {"href", "src", "style"} or "url(" in value.lower() or "@import" in value.lower():
                    raise ValueError()
    except Exception as exc:
        raise ValueError("SVG inválido ou inseguro") from exc


def _flatten_document(raw, kind):
    """Rasterize a single bounded page, removing PDF actions and SVG markup."""
    import pymupdf

    try:
        with pymupdf.open(stream=raw, filetype=kind) as doc:
            if doc.is_encrypted or len(doc) != 1:
                raise ValueError()
            page = doc[0]
            width, height = page.rect.width, page.rect.height
            if not (72 <= width <= 3000 and 72 <= height <= 3000):
                raise ValueError()
            scale = min(2, (16_000_000 / (width * height)) ** 0.5)
            pix = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), alpha=False)
            return pix.tobytes("png")
    except Exception as exc:
        raise ValueError("Documento inválido") from exc


class LetterheadSerializer(serializers.ModelSerializer):
    background = serializers.CharField(required=False, allow_blank=True)
    background_landscape = serializers.CharField(required=False, allow_blank=True)
    margins = serializers.JSONField(required=True)

    class Meta:
        model = Letterhead
        fields = ("id", "name", "active", "background", "background_landscape", "margins", "fields", "created_by", "created_at", "updated_at")
        read_only_fields = ("id", "created_by", "created_at", "updated_at")

    def to_representation(self, instance):
        result = super().to_representation(instance)
        result["background"] = base64.b64encode(bytes(instance.background)).decode("ascii")
        result["background_landscape"] = base64.b64encode(bytes(instance.background_landscape)).decode("ascii")
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
            if raw.startswith(b"%PDF-"):
                raw = _flatten_document(raw, "pdf")
            elif raw.lstrip().startswith(b"<"):
                _validate_svg(raw)
                raw = _flatten_document(raw, "svg")
            else:
                with Image.open(io.BytesIO(raw)) as image:
                    if image.format not in {"PNG", "JPEG"} or image.width * image.height > 16_000_000:
                        raise ValueError()
                    image.load()
                    if image.width < 100 or image.height < 100:
                        raise ValueError()
        except (ValueError, binascii.Error, OSError, UnidentifiedImageError, Image.DecompressionBombError):
            raise ValidationError("Use PNG, JPEG, SVG seguro ou PDF de uma página válido, de até 2 MB.") from None
        if len(raw) > 2 * 1024 * 1024:
            raise ValidationError("O fundo convertido deve ter até 2 MB.")
        return raw

    def validate_background_landscape(self, value):
        return self.validate_background(value)

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
            if not isinstance(item, dict) or not {"type", "text", "x", "y", "font_size", "align"} <= set(item) or set(item) - {"type", "text", "x", "y", "font_size", "align", "font"}:
                raise ValidationError("Campo inválido.")
            if item["type"] not in {"title", "date", "period", "unit", "user", "page", "text"} or item["align"] not in {"left", "center", "right"}:
                raise ValidationError("Tipo ou alinhamento inválido.")
            if item.get("font", "Helvetica") not in {"Helvetica", "Helvetica-Bold", "Times-Roman", "Courier"}:
                raise ValidationError("Fonte inválida.")
            if not isinstance(item["text"], str) or len(item["text"]) > 500:
                raise ValidationError("Texto inválido.")
            for key, low, high in (("x", 0, 210), ("y", 0, 297), ("font_size", 4, 72)):
                v = item[key]
                if type(v) not in (int, float) or not math.isfinite(v) or not low <= v <= high:
                    raise ValidationError("Posição ou tamanho inválido.")
        return value



class LetterheadViewSet(viewsets.ModelViewSet):
    serializer_class = LetterheadSerializer
    queryset = Letterhead.objects.order_by("name", "id")

    def get_queryset(self):
        return self.queryset.filter(unit=get_unit(self.request))

    def _save(self, serializer, create=False):
        unit = get_unit(self.request, ["admin"])
        with transaction.atomic():
            Unit.objects.select_for_update().get(pk=unit.pk)
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
