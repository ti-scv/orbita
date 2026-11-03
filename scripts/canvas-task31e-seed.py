# Execute somente em banco descartável criado para este QA.
import os
if os.environ.get("CANVAS_QA_ISOLATED") != "1" or os.environ.get("DATABASE_HOST") != "orbita-t31e-test-db":
    raise RuntimeError("Banco de QA isolado obrigatório")
from django.contrib.auth import get_user_model
from django.contrib.sessions.backends.db import SessionStore
from core.models import Unit, Membership
from operations.models import ReportDefinition
from operations.report_canvas.schema import default_layout
u = Unit.objects.create(slug="qa31e", name="QA isolado", paused=False)
user = get_user_model().objects.create_user(username="qa31e", password="test-only", is_staff=True, is_superuser=True)
Membership.objects.create(user=user, unit=u, role="admin")
layout = default_layout()
layout["pages"][0]["blocks"] = [
 {"id":"a","type":"text","title":"Primeiro","text":"Um","x":30,"y":30,"width":200,"height":100,"options":{}},
 {"id":"b","type":"text","title":"Segundo","text":"Dois","x":300,"y":30,"width":200,"height":100,"options":{}},
]
for enabled in (False, True):
 r=ReportDefinition.objects.create(unit=u, code="ativo" if enabled else "rascunho", name="Ativo QA" if enabled else "Rascunho QA", source="local", enabled=enabled, reviewed=True, canvas_enabled=True, canvas_layout=layout)
 print("REPORT",enabled,r.id)
s=SessionStore()
s["_auth_user_id"]=str(user.pk)
s["_auth_user_backend"]="django.contrib.auth.backends.ModelBackend"
s["_auth_user_hash"]=user.get_session_auth_hash()
s.save()
open("/out/t31e-e2e-session","w").write(s.session_key)
