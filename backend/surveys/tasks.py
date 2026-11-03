from celery import shared_task
from surveys.models import SurveyAutomation
from surveys.runner import run_survey_automation, is_within_schedule_window


@shared_task(name="surveys.tick")
def tick_surveys():
    automations = SurveyAutomation.objects.filter(
        enabled=True,
        unit__surveys_enabled=True,
    ).select_related("unit", "connection")

    results = []
    for auto in automations:
        if is_within_schedule_window(auto):
            res = run_survey_automation(auto.pk, force=False)
            results.append({"automation_id": str(auto.pk), "result": res})
    return results
