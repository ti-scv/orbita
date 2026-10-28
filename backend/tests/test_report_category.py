from operations.models import ReportDefinition
from operations.report_api import CatalogSerializer


def test_report_category_and_description_are_editable_without_losing_legacy(setup):
    report = ReportDefinition.objects.create(unit=setup['unit'], code='category-test', name='Categoria', legacy={'original': 'preservado'})
    serializer = CatalogSerializer(report, data={'category': '  Atendimento  ', 'description': 'Descrição editada'}, partial=True)
    assert serializer.is_valid(), serializer.errors
    serializer.save()
    report.refresh_from_db()
    assert report.legacy == {'original': 'preservado', 'report_category': 'Atendimento', 'report_description': 'Descrição editada'}
    assert CatalogSerializer(report).data['category'] == 'Atendimento'
    serializer = CatalogSerializer(report, data={'category': ''}, partial=True)
    assert serializer.is_valid(), serializer.errors
    serializer.save()
    report.refresh_from_db()
    assert report.legacy['report_category'] == ''
    assert report.legacy['report_description'] == 'Descrição editada'
