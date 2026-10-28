from unittest.mock import patch
import pytest
from core.models import Unit
from operations.models import ReportConnection, ReportDefinition
from operations.report_canvas.api import response
from operations.report_canvas.sql_columns import query_columns


@pytest.mark.parametrize('sql,engine,expected', [
    ('WITH origem AS (SELECT x FROM tabela) SELECT x AS "Paciente", COUNT(*) AS "Total" FROM origem GROUP BY x', 'postgres', ['Paciente', 'Total']),
    ('SELECT t.campo, 1 AS Total FROM tabela t', 'postgres', ['campo', 'total']),
    ('SELECT t.campo, 1 AS Total FROM tabela t', 'oracle', ['CAMPO', 'TOTAL']),
    ('SELECT 1 AS "Nome", 2 AS "Outro" UNION ALL SELECT 3, 4', 'postgres', ['Nome', 'Outro']),
    ('SELECT * FROM tabela', 'postgres', []),
    ('WITH grupo AS (SELECT x AS first, COUNT(*) AS total FROM t GROUP BY x) SELECT * FROM grupo', 'postgres', ['first', 'total']),
    ('SELECT * FROM (SELECT x AS first, y AS second FROM t) q', 'oracle', ['FIRST', 'SECOND']),
    ('SELECT * FROM (SELECT x AS "Data", y AS "Quantidade" FROM t) q', 'oracle', ['Data', 'Quantidade']),
    ('SELECT * FROM (SELECT * FROM t) q', 'oracle', []),
    ('SELECT a, t.* FROM tabela t', 'postgres', []),
    ('SELECT COUNT(*) FROM tabela', 'postgres', []),
    ('SELECT a AS "X", b AS "X" FROM tabela', 'postgres', []),
    ('SELECT a; SELECT b', 'postgres', []),
    ('SELECT (', 'postgres', []),
    ('SELECT a AS "' + 'x' * 64 + '" FROM t', 'postgres', []),
])
def test_sql_column_names_are_exact_or_unknown(sql,engine,expected):
    assert query_columns(sql,engine)==expected


def test_every_migrated_operational_metric_exposes_canvas_columns(setup):
    from operations.app_reporting import METRICS
    from operations.operational_sql import query_for
    from operations.operational_local_sql import query_for_standard
    from operations.reports import HANDLERS
    from operations.report_canvas.native import LOCAL_COLUMNS
    unit=setup['unit']
    for metric,columns in METRICS.items():
        assert query_columns(query_for(metric,unit,{}),'postgres')==columns,metric
    for handler in HANDLERS:
        assert query_columns(query_for_standard(handler,unit),'postgres')==LOCAL_COLUMNS,handler


def test_canvas_catalog_returns_current_sql_columns_without_querying_sources(setup):
    unit=setup['unit']
    connection=ReportConnection.objects.create(unit=unit,name='Fonte SQL',engine='postgres',enabled=True,validated=True)
    report=ReportDefinition.objects.create(unit=unit,code='sql-contract',name='SQL',source='sql',connection=connection,query_sql='SELECT 1 AS "Nome", 2 AS "Total"',reviewed=True,enabled=True)
    other=Unit.objects.create(slug='outra-fonte',name='Outra fonte')
    other_connection=ReportConnection.objects.create(unit=other,name='Fonte diferente',engine='postgres',enabled=True,validated=True)
    foreign=ReportDefinition.objects.create(unit=other,code='outro',name='Não visível',source='sql',connection=other_connection,query_sql='SELECT 1 AS "Segredo"',reviewed=True,enabled=True)
    with patch('operations.report_engine.connect',side_effect=AssertionError('Catálogo não deve executar consultas')):
        result=response(report)
        source=next(s for s in result['sources'] if s['id']==report.pk)
        assert source['columns']==['Nome','Total']
        assert not any(s['id']==foreign.pk for s in result['sources'])
        report.query_sql='SELECT 1 AS "Alterado"';report.save(update_fields=['query_sql'])
        updated=next(s for s in response(report)['sources'] if s['id']==report.pk)
        assert updated['columns']==['Alterado']
    report.reviewed=False;report.save(update_fields=['reviewed'])
    assert not any(s['id']==report.pk for s in response(report)['sources'])


def test_editor_can_show_own_disabled_reviewed_sql_columns(setup):
    unit=setup['unit']
    connection=ReportConnection.objects.create(unit=unit,name='SQL desativado',engine='postgres',enabled=True,validated=True)
    report=ReportDefinition.objects.create(unit=unit,code='draft-sql',name='SQL desativado',source='sql',connection=connection,query_sql='SELECT 1 AS "Total"',reviewed=True,enabled=False)
    result=response(report)
    assert next(s for s in result['sources'] if s['id']==report.pk)['columns']==['Total']
    other=ReportDefinition.objects.create(unit=unit,code='outro-draft',name='Outro rascunho',source='sql',connection=connection,query_sql='SELECT 1 AS "Total"',reviewed=True,enabled=False)
    assert not any(s['id']==other.pk for s in response(report)['sources'])


def test_oracle_source_accepts_sql_with_a_trailing_delimiter(setup):
    from contextlib import contextmanager
    from operations.report_engine import run_query
    unit=setup['unit']
    connection=ReportConnection.objects.create(unit=unit,name='Oracle',engine='oracle',enabled=True,validated=True)
    report=ReportDefinition(unit=unit,code='oracle-semicolon',name='Oracle',source='sql',connection=connection,query_sql='SELECT 1 AS "VALOR" FROM dual;')
    class Cursor:
        description=[('VALOR',)]
        def execute(self,sql,binds):
            assert sql=='SELECT 1 AS "VALOR" FROM dual'
        def fetchmany(self,limit):return [(1,)]
        def close(self):pass
    class Connection:
        def cursor(self):return Cursor()
    @contextmanager
    def session(_):yield Connection()
    with patch('operations.report_engine.connect',session):
        assert run_query(report,{}) == (['VALOR'],[['1']])
