import base64
import io

import pytest
from PIL import Image
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from core.models import Membership, Unit
from operations.models import Letterhead


def payload(name="Timbrado"):
    image = io.BytesIO()
    Image.new("RGB", (100, 142), "white").save(image, format="PNG")
    return {"name": name, "background": base64.b64encode(image.getvalue()).decode(), "margins": {"top": 20, "bottom": 20, "left": 15, "right": 15}, "fields": []}


@pytest.mark.django_db
def test_crud_and_default_are_scoped(setup):
    client = setup["client"]
    data = {**payload(), "is_default": True}
    first = client.post("/api/v1/letterheads/", data, format="json")
    assert first.status_code == 201
    second = client.post("/api/v1/letterheads/", {**data, "name": "Outro"}, format="json")
    assert second.status_code == 201
    assert not Letterhead.objects.get(pk=first.data["id"]).is_default
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
