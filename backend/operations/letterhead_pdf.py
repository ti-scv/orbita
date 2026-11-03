"""Render a frozen letterhead around each generated PDF page."""
import base64
import io

from django.utils import timezone
from pypdf import PdfReader, PdfWriter, Transformation
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


def snapshot(letterhead):
    return {"id": letterhead.pk, "name": letterhead.name,
            "background": base64.b64encode(bytes(letterhead.background)).decode("ascii"),
            "background_landscape": base64.b64encode(bytes(letterhead.background_landscape)).decode("ascii"),
            "margins": letterhead.margins, "fields": letterhead.fields}


def apply(content, design, *, title, unit, user, parameters, generated_at=None, already_laid_out=False):
    """Keep page size and place existing content inside the configured work area."""
    reader = PdfReader(io.BytesIO(content))
    writer = PdfWriter()
    total = len(reader.pages)
    mm = 72 / 25.4
    today = timezone.localtime(generated_at or timezone.now()).strftime("%d/%m/%Y")
    start = next((parameters.get(k) for k in ("start", "start_date", "data_inicial") if parameters.get(k)), "")
    end = next((parameters.get(k) for k in ("end", "end_date", "data_final") if parameters.get(k)), "")
    period = " — ".join(str(v) for v in (start, end) if v)
    for index, page in enumerate(reader.pages, 1):
        width, height = float(page.mediabox.width), float(page.mediabox.height)
        margins = design["margins"]
        left, right, top, bottom = (margins[k] * mm for k in ("left", "right", "top", "bottom"))
        available_w, available_h = width-left-right, height-top-bottom
        if available_w <= 0 or available_h <= 0:
            raise ValueError("Margens excedem o tamanho da página.")
        overlay = io.BytesIO()
        c = canvas.Canvas(overlay, pagesize=(width, height))
        image = design.get("background_landscape", "") if width > height else design.get("background", "")
        if image:
            c.drawImage(ImageReader(io.BytesIO(base64.b64decode(image))), 0, 0, width=width, height=height, mask="auto")
        c.showPage()
        c.save()
        background = PdfReader(io.BytesIO(overlay.getvalue())).pages[0]
        overlay = io.BytesIO()
        c = canvas.Canvas(overlay, pagesize=(width, height))
        values = {"title": title, "date": today, "period": period, "unit": unit, "user": user, "page": f"Página {index} de {total}"}
        for field in design["fields"]:
            text = field["text"] if field["type"] == "text" else values[field["type"]]
            c.setFont(field.get("font", "Helvetica"), field["font_size"])
            x, y = field["x"] / 210 * width, height - field["y"] / 297 * height
            {"left": c.drawString, "center": c.drawCentredString, "right": c.drawRightString}[field["align"]](x, y, str(text))
        c.showPage()
        c.save()
        foreground = PdfReader(io.BytesIO(overlay.getvalue())).pages[0]
        scale = 1 if already_laid_out else min(available_w / width, available_h / height)
        tx = 0 if already_laid_out else left + (available_w-width*scale)/2
        ty = 0 if already_laid_out else bottom + (available_h-height*scale)/2
        writer.add_page(background)
        target = writer.pages[-1]
        target.merge_transformed_page(page, Transformation().scale(scale).translate(tx, ty))
        target.merge_page(foreground)
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()
