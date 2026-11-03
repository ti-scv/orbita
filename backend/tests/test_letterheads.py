import base64
import io

import pytest
from core.models import Membership, Unit
from django.contrib.auth import get_user_model
from operations.models import Letterhead
from PIL import Image
from rest_framework.test import APIClient


def payload(name="Timbrado"):
    image = io.BytesIO()
    Image.new("RGB", (100, 142), "white").save(image, format="PNG")
    return {"name": name, "background": base64.b64encode(image.getvalue()).decode(), "margins": {"top": 20, "bottom": 20, "left": 15, "right": 15}, "fields": []}


@pytest.mark.django_db
def test_crud_is_scoped(setup):
    client = setup["client"]
    data = payload()
    first = client.post("/api/v1/letterheads/", data, format="json")
    assert first.status_code == 201
    second = client.post("/api/v1/letterheads/", {**data, "name": "Outro"}, format="json")
    assert second.status_code == 201
    assert Letterhead.objects.filter(unit=setup["unit"]).count() == 2
    assert client.patch(f'/api/v1/letterheads/{second.data["id"]}/', {"name": "Alterado"}, format="json").status_code == 200
    other = Unit.objects.create(slug="other-letterhead", name="Outra")
    foreign = Letterhead.objects.create(unit=other, name="Externo")
    assert client.get(f"/api/v1/letterheads/{foreign.pk}/").status_code == 404
    assert client.delete(f'/api/v1/letterheads/{second.data["id"]}/').status_code == 204


@pytest.mark.django_db
def test_permissions_and_validation(setup):
    user = get_user_model().objects.create_user("operator-letterhead")
    Membership.objects.create(user=user, unit=setup["unit"], role="operator")
    client = APIClient()
    client.force_authenticate(user)
    assert client.post("/api/v1/letterheads/", payload(), format="json").status_code == 403
    client = setup["client"]
    assert client.post("/api/v1/letterheads/", {**payload(), "background": "not-base64"}, format="json").status_code == 400
    assert client.post("/api/v1/letterheads/", {**payload(), "margins": {"top": 300, "bottom": 0, "left": 0, "right": 0}}, format="json").status_code == 400


@pytest.mark.django_db
def test_execution_freezes_choice_and_rejects_foreign_unit(setup):
    from unittest.mock import patch

    from operations.models import ReportConnection, ReportDefinition
    from operations.reporting import make_execution
    from rest_framework.exceptions import ValidationError
    paper = Letterhead.objects.create(unit=setup["unit"], name="Papel", background=b"original", margins=payload()["margins"])
    connection = ReportConnection.objects.create(unit=setup["unit"], name="Conexão", engine="sqlite", letterhead=paper)
    report = ReportDefinition.objects.create(unit=setup["unit"], code="letterhead-test", name="Teste", source="local", connection=connection)
    foreign_unit = Unit.objects.create(slug="foreign-letterhead", name="Outra")
    foreign = Letterhead.objects.create(unit=foreign_unit, name="Outro")
    with patch("operations.reporting.execution_access"):
        job = make_execution(report, {}, user=setup["user"])
        plain = make_execution(report, {}, user=setup["user"], letterhead_id=None)
        with pytest.raises(ValidationError):
            make_execution(report, {}, user=setup["user"], letterhead_id=foreign.pk)
    paper.background = b"changed"
    paper.save()
    assert base64.b64decode(job.snapshot["letterhead"]["background"]) == b"original"
    assert "letterhead" not in plain.snapshot

@pytest.mark.django_db
def test_connection_letterhead_must_be_active_and_in_unit(setup):
    from types import SimpleNamespace

    from operations.report_api import ConnectionSerializer

    unit = setup["unit"]
    paper = Letterhead.objects.create(unit=unit, name="Um")
    foreign_unit = Unit.objects.create(slug="other-paper-unit", name="Outra")
    foreign = Letterhead.objects.create(unit=foreign_unit, name="Outro")
    context = {"unit": unit, "request": SimpleNamespace(user=setup["user"])}
    from secrets import token_urlsafe

    password = token_urlsafe(24)
    setup["user"].set_password(password)
    setup["user"].save()
    base = {"name": "Conexão", "engine": "sqlite", "admin_password": password}
    for value, valid in [(paper.pk, True), (foreign.pk, False)]:
        serializer = ConnectionSerializer(data={**base, "letterhead": value}, context=context)
        assert serializer.is_valid() is valid
    paper.active = False
    paper.save()
    serializer = ConnectionSerializer(data={**base, "letterhead": paper.pk}, context=context)
    assert not serializer.is_valid()
    from operations.models import ReportConnection

    connection = ReportConnection.objects.create(unit=unit, name="Existente", engine="sqlite", letterhead=paper)
    serializer = ConnectionSerializer(connection, data={"admin_password": base["admin_password"], "letterhead": paper.pk}, partial=True, context=context)
    assert serializer.is_valid(), serializer.errors

@pytest.mark.django_db
def test_svg_and_single_page_pdf_are_flattened_and_unsafe_inputs_rejected(setup):
    from reportlab.pdfgen import canvas

    client = setup["client"]
    svg = b'<svg xmlns="http://www.w3.org/2000/svg" width="210" height="297"><rect width="210" height="297" fill="white"/></svg>'
    pdf = io.BytesIO()
    c = canvas.Canvas(pdf)
    c.drawString(30, 30, "Fundo")
    c.save()
    for content in (svg, pdf.getvalue()):
        result = client.post("/api/v1/letterheads/", {**payload(), "background": base64.b64encode(content).decode()}, format="json")
        assert result.status_code == 201
        assert base64.b64decode(result.data["background"]).startswith(b"\x89PNG")
    unsafe = b'<svg xmlns="http://www.w3.org/2000/svg" width="210" height="297"><script>alert(1)</script></svg>'
    multi = io.BytesIO()
    c = canvas.Canvas(multi)
    c.showPage()
    c.showPage()
    c.save()
    external = b'<svg xmlns="http://www.w3.org/2000/svg" width="210" height="297"><image href="https://example.invalid/a.png"/></svg>'
    handler = b'<svg xmlns="http://www.w3.org/2000/svg" width="210" height="297" onload="alert(1)"/>'
    for content in (unsafe, external, handler, multi.getvalue()):
        result = client.post("/api/v1/letterheads/", {**payload(), "background": base64.b64encode(content).decode()}, format="json")
        assert result.status_code == 400


@pytest.mark.django_db
def test_unit_directory_remains_available_with_letterhead_permissions(setup):
    response = setup["client"].get("/api/v1/units/")
    assert response.status_code == 200
    assert any(row["slug"] == setup["unit"].slug for row in response.data["results"])
