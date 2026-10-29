from types import SimpleNamespace
from operations.report_canvas.api import source_establishment
from operations.report_canvas.native import LOCAL_COLUMN_TYPES

def test_establishment_uses_legacy_location_and_canvas_unit_fallback():
    unit = SimpleNamespace(name="Santa Casa Votuporanga")
    def report(name, location=""):
        return SimpleNamespace(name=name, legacy={"source_location": {"name": location}}, unit=unit)
    assert source_establishment(report("CONSULTAS", "ROB8 MENSAGENS CONFIRMACAO CONSULTAS E EXAMES")) == "AME Votuporanga"
    assert source_establishment(report("RANKING", "AME JALES ROB8")) == "AME Jales"
    assert source_establishment(report("AME SANTA FÉ - RESPOSTAS")) == "AME Santa Fé"
    assert source_establishment(report("Agendamentos")) == unit.name

def test_local_schema_describes_empty_responsavel_and_dates():
    assert LOCAL_COLUMN_TYPES["Responsável"] == "text"
    assert LOCAL_COLUMN_TYPES["Data"] == "date"


def test_sql_description_estimates_only_known_types():
    from operations.report_canvas.sql_columns import description_types
    assert description_types([('a', 25), ('b', 23), ('c', 1082), ('d', 999999)], 'postgres') == ['text', 'number', 'date', 'unknown']


import pytest

@pytest.mark.django_db
def test_postgres_empty_query_returns_type_metadata():
    from django.db import connection
    from operations.report_canvas.sql_columns import description_types
    if connection.vendor != 'postgresql':
        pytest.skip('Exige PostgreSQL')
    with connection.cursor() as cursor:
        cursor.execute('SELECT NULL::text AS resposta, NULL::date AS data WHERE false')
        assert cursor.fetchall() == []
        assert description_types(cursor.description, 'postgres') == ['text', 'date']
