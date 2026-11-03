"""Section permissions are enforced on every API request, not only navigation."""

from core.features import unit_feature_enabled

from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated

from core.models import Membership, RemoteMembership, UserAccessProfile

SECTIONS = {
    "checkin": "Check-in",
    "autoagenda": "Autoagendamento",
    "surveys": "Pesquisas",
    "overview": "Visão geral",
    "costs": "Custos Meta",
    "appointments": "Agendamentos",
    "groups": "Grupos",
    "messages": "Mensagens",
    "issues": "Pendências",
    "campaigns": "Importa CROSS",
    "reports": "Relatórios",
    "reportWhatsApp": "WhatsApp dos relatórios",
    "operationsAdmin": "Administração",
    "settings": "Configurações",
    "users": "Usuários",
}
LEVELS = {"none": 0, "read": 1, "write": 2}
PRIVILEGED = {"operationsAdmin", "settings", "users"}
RESOURCES = {
    "checkins": ["checkin"],
    "checkin-configuration": ["checkin"],
    "autoagenda": ["autoagenda"],
    "surveys": ["surveys"],
    "indicators": ["overview"],
    "meta-costs": ["costs"],
    "appointments": ["appointments"],
    "agenda-items": ["appointments"],
    "appointment-groups": ["groups"],
    "messages": ["messages"],
    "replies": ["messages"],
    "issues": ["issues"],
    "cases": ["messages", "appointments", "issues", "campaigns"],
    "contacts": ["messages", "appointments", "issues", "campaigns"],
    "movements": ["messages", "appointments", "issues"],
    "campaigns": ["campaigns"],
    "sheet-imports": ["campaigns"],
    "reports": ["reports"],
    "letterheads": ["reports"],
    "report-requests": ["reports"],
    "report-access": ["reports"],
    "report-connections": ["reports"],
    "report-app-connections": ["reports"],
    "report-recipients": ["reports"],
    "report-grants": ["reports"],
    "report-automations": ["reports"],
    "report-executions": ["reports"],
    "report-snapshots": ["reports"],
    "report-snapshot-runs": ["reports"],
    "report-whatsapp": ["reportWhatsApp"],
    "report-schedules": ["reports"],
    "preparations": ["settings", "operationsAdmin"],
    "layouts": ["settings", "operationsAdmin", "campaigns"],
    "policies": ["settings", "operationsAdmin"],
    "sources": ["settings", "operationsAdmin"],
    "flow-rules": ["settings", "operationsAdmin"],
    "flow-runs": ["settings", "operationsAdmin"],
    "rules": ["settings"],
    "templates": ["settings", "operationsAdmin", "campaigns"],
    "imports": ["settings"],
    "audit": ["settings"],
    "logs": ["settings"],
    "control": ["settings"],
    "meta-configuration": ["settings"],
    "oracle-agendas": ["settings"],
    "oracle-configuration": ["settings"],
    "instance-keys": ["settings"],
    "remote-instances": ["settings"],
    "members": ["settings"],
    "units": ["settings"],
    "users": ["settings"],
    "permission-roles": ["settings"],
    "tests": ["appointments", "overview"],
}


def validate_permissions(value):
    if not isinstance(value, dict) or any(
        k not in SECTIONS or v not in LEVELS for k, v in value.items()
    ):
        raise ValidationError(
            "Permissões devem conter somente seções válidas com none, read ou write."
        )
    return value


def role_permissions(role, overrides=None):
    value = {
        key: "write"
        if role == "admin" or (role == "operator" and key not in PRIVILEGED)
        else "read"
        for key in SECTIONS
    }
    if role != "admin":
        value["users"] = "none"
    if role != "admin" or (overrides and "costs" not in overrides):
        value["costs"] = "none"
    if role != "admin" or (overrides and "autoagenda" not in overrides):
        value["autoagenda"] = "none"
    value.update(
        {k: v for k, v in (overrides or {}).items() if k in SECTIONS and v in LEVELS}
    )
    if not overrides or "reportWhatsApp" not in overrides:
        value["reportWhatsApp"] = "none"
    for key in value:
        if role == "viewer" and value[key] == "write":
            value[key] = "read"
        if role != "admin" and key in PRIVILEGED and value[key] == "write":
            value[key] = "read"
    return value


def intersect_permissions(*policies):
    return {
        key: min((p.get(key, "none") for p in policies), key=lambda v: LEVELS.get(v, 0))
        for key in SECTIONS
    }


def local_permissions(user, unit):
    if user.is_superuser:
        return role_permissions("admin", {"reportWhatsApp": "write", "autoagenda": "write"})
    member = Membership.objects.filter(user=user, unit=unit).first()
    return (
        role_permissions(member.role, member.permissions)
        if member
        else {k: "none" for k in SECTIONS}
    )


def remote_access(user, connection):
    from core.federation_auth import limited_role

    if not user.is_active:
        return None, {k: "none" for k in SECTIONS}
    explicit = UserAccessProfile.objects.filter(user=user, explicit_units=True).exists()
    grant = RemoteMembership.objects.filter(user=user, connection=connection).first()
    if grant:
        role, policy = grant.role, role_permissions(grant.role, grant.permissions)
    elif user.is_superuser:
        role, policy = "admin", role_permissions("admin", {"reportWhatsApp": "write", "autoagenda": "write"})
    elif not explicit:
        member = Membership.objects.filter(
            user=user, unit=connection.local_unit
        ).first()
        if not member:
            return None, {k: "none" for k in SECTIONS}
        role, policy = member.role, role_permissions(member.role, member.permissions)
    else:
        return None, {k: "none" for k in SECTIONS}
    role = limited_role(role, connection.remote_role)
    policy = intersect_permissions(
        policy,
        role_permissions(role, {"reportWhatsApp": "write", "checkin": "write"}),
        role_permissions(connection.remote_role, connection.remote_permissions),
    )
    policy["users"] = (
        "none"  # User administration cannot be delegated by an instance key.
    )
    policy["operationsAdmin"] = "none"
    return role, policy


def effective_permissions(request, unit):
    policy = local_permissions(request.user, unit)
    auth = request.auth
    if getattr(auth, "effective_role", None):
        policy = intersect_permissions(
            policy, role_permissions(auth.effective_role, {"reportWhatsApp": "write", "checkin": "write"})
        )
        if getattr(auth, "section_limit", None) is not None:
            policy = intersect_permissions(policy, auth.section_limit)
    return policy


def required_sections(resource, method, params):
    root = resource.split("/")[0]
    sections = list(RESOURCES.get(root, []))
    if method in {"GET", "HEAD", "OPTIONS"}:
        if root == "sheet-imports" and resource.rstrip("/") == "sheet-imports/schema":
            sections.append("operationsAdmin")
        # filter_options queries the whole unit, not the filtered queryset.
        if (
            root in {"appointments", "agenda-items"}
            and resource.strip("/") != "agenda-items/filter_options"
        ):
            if params.get("group"):
                sections.append("groups")
            if params.get("operational_pending") == "true":
                sections.append("issues")
        if root in {"cases", "contacts"}:
            sections.append("messages")
    return sections


def check_resource(policy, resource, method, params):
    root = resource.split("/")[0]
    if root == "workspace":
        if any(v != "none" for v in policy.values()):
            return
    required = 1 if method in {"GET", "HEAD", "OPTIONS"} else 2
    if root in {"cases", "contacts", "movements", "appointments", "agenda-items"} and params.get("group"):
        if LEVELS[policy.get("groups", "none")] < required:
            raise PermissionDenied("Sem permissão para a subárea de Grupos.")
        # These actions query the entire unit and cannot be authorized by a group.
        if resource.strip("/") not in {"cases/health", "cases/operators", "agenda-items/filter_options"}:
            if root in {"cases", "contacts", "movements"} or method in {"GET", "HEAD", "OPTIONS"}:
                return
    if resource.strip("/") == "cases/health":
        # The unit-wide aggregate includes messages, issues, imports and reports.
        if all(LEVELS[policy.get(s, "none")] >= required for s in ("messages", "issues", "reports")) and any(
            LEVELS[policy.get(s, "none")] >= required for s in ("settings", "operationsAdmin")
        ):
            return
        raise PermissionDenied("Sem permissão para consultar a saúde operacional da unidade.")
    if any(
        LEVELS[policy.get(section, "none")] >= required
        for section in required_sections(resource, method, params)
    ):
        return
    raise PermissionDenied(
        "Sem permissão para consultar ou editar esta seção na unidade."
    )


class SectionPermission(IsAuthenticated):
    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        path = request.path_info.removeprefix("/api/v1/")
        root = path.split("/")[0]
        if root in {"auth", "schema", "docs", "remote", "federation"}:
            return True
        if root not in RESOURCES and root != "workspace":
            raise PermissionDenied("Recurso não autorizado.")
        from core.permissions import get_unit

        unit = get_unit(request)
        if root in {"checkins", "checkin-configuration"} and not unit_feature_enabled(unit, "checkin"):
            raise PermissionDenied("Check-in desabilitado para esta unidade.")
        policy = effective_permissions(request, unit)
        check_resource(policy, path, request.method, request.query_params)
        return True
