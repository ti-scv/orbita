import uuid
from django.db import models
from django.conf import settings


class Configuration(models.Model):
    unit = models.OneToOneField("core.Unit", on_delete=models.PROTECT)
    version = models.PositiveIntegerField(default=1)
    enabled = models.BooleanField(default=False)
    booking_enabled = models.BooleanField(default=False)
    environment = models.CharField(max_length=20, default="homologation")
    oracle_host = models.CharField(max_length=200, default="172.16.2.254")
    oracle_port = models.PositiveIntegerField(default=1521)
    oracle_sid = models.CharField(max_length=100, default="tstvotu")
    oracle_user = models.CharField(max_length=100, default="MEGA_ROBO")
    password_ciphertext = models.TextField(blank=True)
    validated = models.BooleanField(default=False)
    validated_identity = models.JSONField(default=dict)
    public_base_url = models.URLField(default="http://172.16.0.59:8081")
    redirect_phone = models.CharField(max_length=20, blank=True)
    agreement = models.PositiveIntegerField(default=37)
    booking_user = models.CharField(max_length=100, default="AGENDASAN")
    session_minutes = models.PositiveIntegerField(default=30)
    max_cpfs = models.PositiveIntegerField(default=10)
    options = models.JSONField(default=dict)
    texts = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)


class Conversation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    unit = models.ForeignKey("core.Unit", on_delete=models.PROTECT)
    configuration = models.ForeignKey(Configuration, on_delete=models.PROTECT)
    token_hash = models.CharField(max_length=64, unique=True)
    redeemed = models.BooleanField(default=False)
    expires_at = models.DateTimeField()
    last_activity = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)
    version = models.PositiveIntegerField(default=1)
    state = models.CharField(max_length=30, default="new", db_index=True)
    step = models.CharField(max_length=30, default="cpf")
    patient = models.CharField(max_length=200, blank=True)
    cpf_masked = models.CharField(max_length=20, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    payload_ciphertext = models.TextField(blank=True)
    view = models.JSONField(default=dict)
    reason = models.CharField(max_length=250, blank=True)
    attended_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    class Meta:
        indexes = [models.Index(fields=["unit", "state", "created_at"])]


class Event(models.Model):
    conversation = models.ForeignKey(Conversation, related_name="events", on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    actor = models.CharField(max_length=20)
    text = models.TextField()
    step = models.CharField(max_length=30, blank=True)
    data = models.JSONField(default=dict)


class Booking(models.Model):
    conversation = models.OneToOneField(Conversation, on_delete=models.PROTECT)
    unit = models.ForeignKey("core.Unit", on_delete=models.PROTECT)
    state = models.CharField(max_length=20, default="pending")
    slot_id = models.CharField(max_length=100)
    specialty = models.CharField(max_length=200)
    professional = models.CharField(max_length=200)
    scheduled_for = models.CharField(max_length=30)
    created_at = models.DateTimeField(auto_now_add=True)
    confirmed_at = models.DateTimeField(null=True)
    error_code = models.CharField(max_length=50, blank=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['unit','slot_id','scheduled_for'], condition=models.Q(state__in=['pending','confirmed','uncertain']), name='autoagenda_unique_active_slot')]
