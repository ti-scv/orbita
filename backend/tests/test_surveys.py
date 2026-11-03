import uuid
from datetime import date, datetime, time
import pytest
from zoneinfo import ZoneInfo
from django.utils import timezone
from rest_framework.test import APIClient

from core.models import Unit, Membership
from surveys.models import SurveyAutomation, SurveyExecution
from surveys.sender import (
    format_patient_first_name,
    normalize_recipient_phone,
    build_survey_url,
)
from surveys.api import analyze_template_components
from surveys.runner import run_survey_automation


@pytest.fixture
def survey_setup(db):
    unit = Unit.objects.create(slug="sansaude", name="Sansaúde", paused=False, surveys_enabled=True)
    automation = SurveyAutomation.objects.create(
        unit=unit,
        name="Pesquisa NPS Teste",
        table_name="dbasistemas.rf_tbl_msg_alta_med_san",
        template_name="pesquisa_nps",
        survey_base_url="https://pesqfy.santacasavotuporanga.com.br/survey/019d923b-22e0-73ea-9a90-d84097fa0fe4",
        column_mapping={
            "id_column": "ID",
            "attendance_column": "CD_ATENDIMENTO",
            "patient_name_column": "NM_PACIENTE",
            "patient_first_name_only": True,
            "phone_column": "NR_CELULAR",
            "status_column": "SN_ENVIADO",
            "attendance_date_column": "DT_ALTA_MEDICA",
            "sent_date_column": "DT_ENVIO",
        },
        schedule_type="daily_time",
        discharge_period="previous_day",
        start_time=time(8, 0),
        end_time=time(18, 0),
        enabled=True,
    )
    return {"unit": unit, "automation": automation}


@pytest.mark.django_db
def test_survey_sender_helpers():
    # First name formatting
    assert format_patient_first_name("LUIZ APARECIDO MARTINS") == "Luiz"
    assert format_patient_first_name("MARIA DA SILVA") == "Maria"
    assert format_patient_first_name("") == "Cliente"
    assert format_patient_first_name(None) == "Cliente"

    # Phone normalization
    assert normalize_recipient_phone("17992714448") == "5517992714448"
    assert normalize_recipient_phone("+55 (17) 99271-4448") == "5517992714448"
    assert normalize_recipient_phone("5517992714448") == "5517992714448"
    assert normalize_recipient_phone("invalid") == ""

    # Dynamic URL builder
    url = build_survey_url(
        "https://pesqfy.santacasavotuporanga.com.br/survey/019d923b-22e0-73ea-9a90-d84097fa0fe4",
        "4307337"
    )
    assert url == "https://pesqfy.santacasavotuporanga.com.br/survey/019d923b-22e0-73ea-9a90-d84097fa0fe4?atendimento=4307337"


@pytest.mark.django_db
def test_survey_template_compatibility():
    from django.contrib.auth import get_user_model
    valid_components = [
        {"type": "BODY", "text": "Olá {{1}}, responda nossa pesquisa."},
        {"type": "BUTTONS", "buttons": [{"type": "URL", "text": "Responder", "url": "https://pesqfy.santacasavotuporanga.com.br/survey/abc?atendimento={{1}}"}]}
    ]
    analysis = analyze_template_components(valid_components)
    assert analysis["is_survey_ready"] is True
    assert analysis["body_variables_count"] == 1
    assert analysis["button_has_variable"] is True
    assert analysis["extracted_base_url"] == "https://pesqfy.santacasavotuporanga.com.br/survey/abc"

    # Missing dynamic button parameter
    invalid_components = [
        {"type": "BODY", "text": "Olá {{1}}, responda nossa pesquisa."},
        {"type": "BUTTONS", "buttons": [{"type": "QUICK_REPLY", "text": "Responder"}]}
    ]
    analysis_invalid = analyze_template_components(invalid_components)
    assert analysis_invalid["is_survey_ready"] is False


@pytest.mark.django_db
def test_survey_deduplication(survey_setup):
    unit = survey_setup["unit"]
    auto = survey_setup["automation"]

    # First execution sent
    ex1 = SurveyExecution.objects.create(
        unit=unit,
        automation=auto,
        source_record_id="REC-1",
        attendance_id="4307337",
        patient_name="LUIZ",
        phone="5517999999999",
        survey_url="https://example.com/?atendimento=4307337",
        status="sent",
    )
    assert ex1.pk is not None

    # Check deduplication query
    exists = SurveyExecution.objects.filter(
        automation=auto,
        attendance_id="4307337",
        status="sent"
    ).exists()
    assert exists is True

    # Unique constraint violation when attempting duplicate sent status
    with pytest.raises(Exception):
        SurveyExecution.objects.create(
            unit=unit,
            automation=auto,
            source_record_id="REC-2",
            attendance_id="4307337",
            patient_name="LUIZ",
            phone="5517999999999",
            status="sent",
        )


@pytest.mark.django_db
def test_survey_executions_api_pagination_and_date_filtering(survey_setup):
    from django.contrib.auth import get_user_model
    unit = survey_setup["unit"]
    auto = survey_setup["automation"]
    tz = ZoneInfo("America/Sao_Paulo")

    user = get_user_model().objects.create_superuser("admin_survey", "admin@example.com", "pass123")
    Membership.objects.create(user=user, unit=unit, role="admin")

    now = timezone.now()
    # Create 3 executions across different dates
    ex_today = SurveyExecution.objects.create(
        unit=unit, automation=auto, attendance_id="ATT-100", patient_name="Hoje",
        phone="5517999990001", status="sent", created_at=now
    )

    client = APIClient()
    client.force_authenticate(user)

    today_str = now.astimezone(tz).strftime("%Y-%m-%d")
    res = client.get(f"/api/v1/surveys/executions/?unit=sansaude&start_date={today_str}&end_date={today_str}&page=1&page_size=10")
    assert res.status_code == 200, res.data
    data = res.data
    assert data["count"] >= 1
    assert data["page"] == 1
    assert data["page_size"] == 10
    assert "total_pages" in data
    assert any(r["attendance_id"] == "ATT-100" for r in data["results"])

    # Filter with date that has no records
    res_empty = client.get("/api/v1/surveys/executions/?unit=sansaude&start_date=2020-01-01&end_date=2020-01-01")
    assert res_empty.status_code == 200
    assert res_empty.data["count"] == 0
    assert res_empty.data["results"] == []
