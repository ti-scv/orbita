from core.models import Unit
from operations.models import ReportDefinition
from operations.report_canvas.api import response
from tests.test_report_canvas import env


def test_catalog_preserves_homonyms_and_excludes_other_units(env):
    _, report, _ = env
    other = Unit.objects.create(slug="outra-32g", name="Outra")
    legacy = {"external_mapping": {"columns": ["valor"]}}
    first = ReportDefinition.objects.create(unit=report.unit, code="same-a", name="Mesmo nome", source="legacy_pending", legacy=legacy)
    second = ReportDefinition.objects.create(unit=report.unit, code="same-b", name="Mesmo nome", source="legacy_pending", legacy=legacy)
    foreign = ReportDefinition.objects.create(unit=other, code="foreign-32g", name="Mesmo nome", source="legacy_pending", legacy=legacy)
    sources = {item["id"]: item for item in response(report)["sources"]}
    assert sources[first.pk]["code"] == "same-a"
    assert sources[second.pk]["code"] == "same-b"
    assert foreign.pk not in sources
