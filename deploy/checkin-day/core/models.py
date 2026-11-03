import uuid

from django.conf import settings
from django.db import models


class Unit(models.Model):
    checkin_enabled = models.BooleanField(default=False)
    autoagenda_enabled = models.BooleanField(default=False)
    surveys_enabled = models.BooleanField(default=False)
    version = models.PositiveIntegerField(default=1)
    authorized_recipients = models.JSONField(null=True, default=None, blank=True)
    slug = models.SlugField(unique=True)
    name = models.CharField(max_length=150)
    timezone = models.CharField(max_length=50, default="America/Sao_Paulo")
    paused = models.BooleanField(default=True)
    response_hours = models.PositiveIntegerField(default=24)
    logo = models.TextField(blank=True, default="")


class Membership(models.Model):
    class Role(models.TextChoices):
        ADMIN = "admin", "Administrador"
        OPERATOR = "operator", "Operador"
        VIEWER = "viewer", "Consulta"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE)
    role = models.CharField(max_length=12, choices=Role.choices, default=Role.VIEWER)
    permissions = models.JSONField(default=dict)
    permission_role = models.ForeignKey("PermissionRole", null=True, blank=True, on_delete=models.SET_NULL)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "unit"], name="membership_unique")]


class Audit(models.Model):
    unit = models.ForeignKey(Unit, on_delete=models.PROTECT)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=80)
    object_id = models.CharField(max_length=80, blank=True)
    details = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        from core.federation_auth import access_context

        context = access_context.get()
        if context:
            self.details = {**self.details, "instance_access_key": context}
        return super().save(*args, **kwargs)


class InstanceAccessKey(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    unit = models.ForeignKey(Unit, on_delete=models.PROTECT)
    issuer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    name = models.CharField(max_length=120)
    role = models.CharField(max_length=12, choices=Membership.Role.choices)
    export_user_identities = models.BooleanField(default=False)
    secret_hash = models.CharField(max_length=64, editable=False)
    issuance_key = models.CharField(max_length=100, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True)
    last_used_at = models.DateTimeField(null=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["unit", "issuer", "issuance_key"], name="instance_key_issuance")
        ]


class RemoteInstance(models.Model):
    """Connection metadata only. No local Unit, patients, messages or tasks are created."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    local_unit = models.ForeignKey(Unit, on_delete=models.PROTECT)
    name = models.CharField(max_length=120)
    base_url = models.URLField(max_length=500)
    key_ciphertext = models.TextField(editable=False)
    remote_instance_id = models.UUIDField()
    remote_unit_slug = models.CharField(max_length=50)
    remote_unit = models.JSONField(default=dict)
    remote_role = models.CharField(max_length=12, choices=Membership.Role.choices)
    remote_permissions = models.JSONField(default=dict)
    enabled = models.BooleanField(default=True)
    version = models.PositiveIntegerField(default=1)
    checked_at = models.DateTimeField(null=True)
    state = models.CharField(max_length=20, default="connected")
    error_code = models.CharField(max_length=40, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["local_unit", "remote_instance_id", "remote_unit_slug"],
                name="remote_instance_identity",
            )
        ]


class UserAccessProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    version = models.PositiveIntegerField(default=1)
    explicit_units = models.BooleanField(default=True)
    managing_unit = models.ForeignKey(Unit, null=True, on_delete=models.PROTECT)


class RemoteMembership(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    connection = models.ForeignKey(RemoteInstance, on_delete=models.CASCADE)
    role = models.CharField(max_length=12, choices=Membership.Role.choices, default="viewer")
    permissions = models.JSONField(default=dict)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "connection"], name="remote_membership_unique")
        ]


class OracleConfiguration(models.Model):
    unit = models.OneToOneField(Unit, on_delete=models.PROTECT)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    salt = models.CharField(max_length=64, editable=False)
    ciphertext = models.TextField(editable=False)
    service_key_ciphertext = models.TextField(blank=True, editable=False)
    operational_enabled = models.BooleanField(default=True)
    version = models.PositiveIntegerField(default=1)
    updated_at = models.DateTimeField(auto_now=True)
    checked_at = models.DateTimeField(null=True)
    validation_state = models.CharField(max_length=24, default="not_checked")


class PermissionMigration35Backup(models.Model):
    model_name = models.CharField(max_length=40)
    object_id = models.CharField(max_length=40)
    migrated_value = models.CharField(max_length=5)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["model_name", "object_id"], name="permission35_backup_unique")]


class PermissionMigration35TypesBackup(models.Model):
    model_name = models.CharField(max_length=40)
    object_id = models.CharField(max_length=40)
    previous = models.JSONField()
    migrated = models.JSONField()


class PermissionMigration35SettingsBackup(models.Model):
    model_name = models.CharField(max_length=40)
    object_id = models.CharField(max_length=40)
    previous = models.JSONField()
    migrated = models.JSONField()


class PermissionRole(models.Model):
    """Modelo reutilizável; os acessos efetivos continuam no vínculo."""
    unit = models.ForeignKey(Unit, on_delete=models.CASCADE)
    name = models.CharField(max_length=120)
    permissions = models.JSONField(default=dict)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["unit", "name"], name="permission_role_unit_name")]


class SyncedUserIdentity(models.Model):
    """Identification from one remote unit; never evidence for linking a local account."""

    class State(models.TextChoices):
        PENDING = "pending", "Pendente de liberação"
        CONFLICT = "conflict", "Conflito de login"
        RELEASED = "released", "Liberado"

    connection = models.ForeignKey(RemoteInstance, on_delete=models.PROTECT, related_name="synced_users")
    remote_user_id = models.CharField(max_length=150)
    login = models.CharField(max_length=150)
    name = models.CharField(max_length=150, blank=True)
    email = models.EmailField(blank=True)
    last_synced_at = models.DateTimeField()
    removed_at_origin = models.BooleanField(default=False)
    state = models.CharField(max_length=12, choices=State.choices, default=State.PENDING)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT, related_name="synced_identity")

    class Meta:
        constraints = [models.UniqueConstraint(fields=["connection", "remote_user_id"], name="synced_identity_origin_unique")]
