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


def test_catalog_includes_unreviewed_same_unit_reports_as_unavailable(env):
    _, report, _ = env
    draft = ReportDefinition.objects.create(unit=report.unit, code="draft-33l", name="Vendas", source="sql", enabled=False, reviewed=False)
    other = Unit.objects.create(slug="foreign-33l", name="Outra")
    foreign = ReportDefinition.objects.create(unit=other, code="foreign-33l", name="Vendas", source="sql")
    sources = {item["id"]: item for item in response(report)["sources"]}
    assert sources[draft.pk]["available"] is False
    assert foreign.pk not in sources
