from datetime import time

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q


def weekdays():
    return [0, 1, 2, 3, 4]


class Configuration(models.Model):
    unit = models.OneToOneField("core.Unit", on_delete=models.PROTECT, related_name="checkin_configuration")
    enabled = models.BooleanField(default=False)
    booking_enabled = models.BooleanField(default=False)
    appointment_enabled = models.BooleanField(default=False)
    oracle_enabled = models.BooleanField(default=False)
    channel = models.CharField(max_length=16, default="meta", choices=[("meta", "Meta")])
    timezone = models.CharField(max_length=64, default="America/Sao_Paulo")
    weekdays = models.JSONField(default=weekdays)
    business_start = models.TimeField(default=time(8))
    business_end = models.TimeField(default=time(18))
    holidays = models.JSONField(default=list, blank=True)
    lead_value = models.PositiveIntegerField(default=24)
    lead_unit = models.CharField(max_length=8, choices=[("hours", "Horas"), ("days", "Dias")], default="hours")

    def clean(self):
        if self.unit_id and self.unit.slug != "sansaude":
            raise ValidationError("Check-in disponível apenas para Sansaúde.")
        if self.business_start >= self.business_end:
            raise ValidationError("Horário comercial inválido.")

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class CheckIn(models.Model):
    class Response(models.TextChoices):
        PENDING = "pending", "Pendente"
        SENT = "sent", "Enviado"
        CONFIRMED = "confirmed", "Confirmado"
        CANCELLED = "cancelled", "Cancelado solicitado"
        NO_RESPONSE = "no_response", "Sem resposta"

    class Attendance(models.TextChoices):
        UNKNOWN = "unknown", "Desconhecido"
        ATTENDED = "attended", "Compareceu"
        ABSENT = "absent", "Não compareceu"

    unit = models.ForeignKey("core.Unit", on_delete=models.PROTECT)
    appointment = models.ForeignKey("scheduling.Appointment", null=True, blank=True, on_delete=models.PROTECT)
    booking = models.ForeignKey("autoagenda.Booking", null=True, blank=True, on_delete=models.PROTECT)
    source_revision = models.PositiveIntegerField(default=1)
    cycle = models.PositiveIntegerField(default=1)
    scheduled_at = models.DateTimeField(null=True, blank=True)
    planned_send_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    response_deadline = models.DateTimeField(null=True, blank=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    attendance_checked_at = models.DateTimeField(null=True, blank=True)
    message_id = models.CharField(max_length=128, blank=True)
    provider_message_id = models.CharField(max_length=255, blank=True)
    response = models.CharField(max_length=16, choices=Response.choices, default=Response.PENDING)
    attendance = models.CharField(max_length=16, choices=Attendance.choices, default=Attendance.UNKNOWN)
    version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.CheckConstraint(condition=(Q(appointment__isnull=False, booking__isnull=True) | Q(appointment__isnull=True, booking__isnull=False)), name="checkin_one_source"),
            models.UniqueConstraint(fields=["appointment", "source_revision", "cycle"], condition=Q(appointment__isnull=False), name="checkin_appointment_cycle"),
            models.UniqueConstraint(fields=["booking", "source_revision", "cycle"], condition=Q(booking__isnull=False), name="checkin_booking_cycle"),
            models.CheckConstraint(condition=Q(response__in=["pending", "sent", "confirmed", "cancelled", "no_response"]), name="checkin_response_valid"),
            models.CheckConstraint(condition=Q(attendance__in=["unknown", "attended", "absent"]), name="checkin_attendance_valid"),
        ]
        indexes = [models.Index(fields=["unit", "scheduled_at"])]

    def clean(self):
        if not self.unit_id or self.unit.slug != "sansaude":
            raise ValidationError("Check-in disponível apenas para Sansaúde.")
        if bool(self.appointment_id) == bool(self.booking_id):
            raise ValidationError("Informe exatamente uma origem.")
        source = self.appointment if self.appointment_id else self.booking
        if source.unit_id != self.unit_id:
            raise ValidationError("Origem pertence a outra unidade.")

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class ImmutableEventQuerySet(models.QuerySet):
    def update(self, **kwargs):
        raise ValidationError("Eventos de check-in são imutáveis.")

    def delete(self):
        raise ValidationError("Eventos de check-in são imutáveis.")


class Event(models.Model):
    objects = ImmutableEventQuerySet.as_manager()
    checkin = models.ForeignKey(CheckIn, on_delete=models.PROTECT, related_name="events")
    idempotency_key = models.CharField(max_length=128)
    origin = models.CharField(max_length=16, choices=[("automatic", "Automático"), ("operator", "Operador"), ("oracle", "Oracle")])
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT)
    reason = models.CharField(max_length=500, blank=True)
    previous_response = models.CharField(max_length=16)
    response = models.CharField(max_length=16)
    previous_attendance = models.CharField(max_length=16)
    attendance = models.CharField(max_length=16)
    evidence = models.JSONField(default=dict)
    occurred_at = models.DateTimeField()
    recorded_at = models.DateTimeField(auto_now_add=True)
    version = models.PositiveIntegerField()

    class Meta:
        constraints = [models.UniqueConstraint(fields=["checkin", "idempotency_key"], name="checkin_event_idempotency"), models.UniqueConstraint(fields=["checkin", "version"], name="checkin_event_version")]
        ordering = ["version"]

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValidationError("Eventos de check-in são imutáveis.")
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Eventos de check-in são imutáveis.")
