"""PostgreSQL parity and real database-role isolation; never uses external sources."""
import copy
from datetime import timedelta
from decimal import Decimal
import pytest
from django.db import connection
from django.utils import timezone
from rest_framework.exceptions import ValidationError
from core.models import Unit
from operations.models import ReportDefinition, Contact
from operations.app_reporting import METRICS, local_data
from operations.operational_sql import provision, query_for, parameter_schema, schema_name, validate_sql
from operations.report_engine import run_query, connect
from test_app_reporting import case, message, reply

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture
def sql_source(setup):
    if connection.vendor != 'postgresql':
        pytest.skip('Requires PostgreSQL to verify role isolation')
    assert str(connection.settings_dict['NAME']).startswith('test'), 'Never provision test roles in production'
    unit = setup['unit']
    conn = provision(unit, unit, 'test-administrator-password')
    try:
        yield conn
    finally:
        from psycopg import sql
        with connection.cursor() as q:
            q.execute(sql.SQL('DROP SCHEMA {} CASCADE').format(sql.Identifier(schema_name(unit.pk))))
            q.execute(sql.SQL('DROP ROLE {}').format(sql.Identifier(conn.username)))


def normalize(rows):
    return [[float(x) if isinstance(x, Decimal) else x for x in row] for row in rows]


def draft(setup, conn, metric, filters):
    unit = setup['unit']
    return ReportDefinition(unit=unit, connection=conn, name='SQL', code='sql-parity', source='sql', query_sql=query_for(metric, unit, filters), parameter_schema=parameter_schema(unit, filters))


def test_all_operational_metrics_equal_existing_adapter(setup, sql_source):
    from operations.models import Interaction
    unit = setup['unit']
    records = []
    for purpose, outcome in [('appointment','confirmed'),('appointment','declined'),('absence',''),('postoperative','needs_attention'),('waitlist','')]:
        c = case(setup, purpose=purpose, outcome=outcome, data={'tipo':'EXAME','codigo':'42','local':'Clínica','category':'CAMPANHA RH','origin_code':'93-1'})
        records.append(c)
        a = message(setup,c)
        b = message(setup,c, recipient='5511888888888')
        reply(setup,a,'SIM')
        last = reply(setup,b,'NAO')
        last.event.occurred_at += timedelta(seconds=1)
        last.event.data = {'sender_name':'Perfil'}
        last.event.save()
        Contact.objects.create(unit=unit,event=c.event,phone='5511777777777')
        Interaction.objects.create(case=c, actor=setup['user'],kind='call',text='Teste',outcome='answered',occurred_at=timezone.now())
    for state in ['queued','failed','uncertain','sending']:
        message(setup,case(setup),state)
    stale = message(setup,records[0]);stale.appointment_revision+=1;stale.save();reply(setup,stale,'IGNORAR')
    other = Unit.objects.create(slug='other-sql',name='Outra')
    foreign = case(setup,unit=other,outcome='confirmed');reply(setup,message(setup,foreign),'OUTRA UNIDADE')
    for metric in METRICS:
        for filters in [{}, {'purpose':'appointment'}, {'purpose':'absence','basis':'response'}, {'purpose':'appointment','basis':'interaction'}, {'basis':'created','category':'CAMPANHA RH','clinic':'Clínica','origin_code':'93-1','procedure_in':['EXAME']}]:
            expected=local_data(unit,metric,{},filters)
            actual=run_query(draft(setup,sql_source,metric,filters),{},typed=True)
            assert expected[0]==actual[0],(metric,filters)
            assert normalize(expected[1])==normalize(actual[1]),(metric,filters,expected[1],actual[1])


def test_scope_holds_even_if_query_omits_unit_where(setup,sql_source):
    import psycopg
    unit=setup['unit']; own=case(setup,outcome='confirmed')
    other=Unit.objects.create(slug='other-role',name='Outra'); foreign=case(setup,unit=other,outcome='confirmed')
    with connect(sql_source) as db:
        q=db.cursor();q.execute('SELECT DISTINCT unidade FROM '+schema_name(unit.pk)+'.casos')
        assert q.fetchall()==[(unit.slug,)]
        q.execute('SELECT id FROM '+schema_name(unit.pk)+'.casos WHERE id=%s',[foreign.pk]);assert q.fetchall()==[]
    with pytest.raises(psycopg.errors.InsufficientPrivilege):
        with connect(sql_source) as db: db.cursor().execute('SELECT * FROM public.operations_case')
    with pytest.raises((psycopg.errors.InsufficientPrivilege, psycopg.errors.ReadOnlySqlTransaction)):
        with connect(sql_source) as db: db.cursor().execute('UPDATE '+schema_name(unit.pk)+'.mensagens SET situacao=\'x\'')
    with pytest.raises(ValidationError):run_query(draft(setup,sql_source,'confirmed',{}),{'unidade':other.slug})
    for query in ['SELECT * FROM public.operations_case','SELECT pg_read_file(\'/etc/passwd\')','SELECT public.arredondar(1.2)','SELECT set_config(\'search_path\',\'public\',false)','SELECT * FROM '+schema_name(other.pk)+'.casos']:
        with pytest.raises(ValidationError):validate_sql(query,sql_source)


def test_dates_types_defaults_and_prompt_contract(setup,sql_source):
    from operations.report_whatsapp import ordered_parameters
    unit=setup['unit'];a=case(setup,purpose='appointment',outcome='confirmed');b=case(setup,purpose='absence',outcome='confirmed')
    report=draft(setup,sql_source,'confirmed',{'purpose':'appointment'})
    assert len(run_query(report,{},typed=True)[1])==1
    rows=run_query(report,{'tipo_envio':'absence'},typed=True)[1]
    assert len(rows)==1 and rows[0][1]==b.event.external_id
    assert ordered_parameters(report)==['start','end']
    for values in [{'tipo_envio':'invalid'},{'start':'2026-12-31','end':'2026-01-01'},{'start':'2020-01-01','end':'2026-01-01'}]:
        with pytest.raises(ValidationError):run_query(report,values)


def test_late_reply_and_multiple_purposes_keep_appointment_mapping(setup,sql_source):
    from operations.models import Case
    from messaging.models import Message
    from operations.models import SourceEvent
    event=SourceEvent.objects.get(appointment=setup['appointment'])
    event.occurred_at=timezone.now()-timedelta(days=10);event.save()
    c,_=Case.objects.get_or_create(unit=setup['unit'],event=event,purpose='appointment',defaults={'outcome':'confirmed'})
    Case.objects.create(unit=c.unit,event=c.event,purpose='absence')
    m=message(setup,c)
    m.case=None;m.appointment=setup['appointment'];m.save()
    reply(setup,m,'SIM')
    late=case(setup,outcome='confirmed')
    late.event.occurred_at=timezone.now()-timedelta(days=45);late.event.save()
    reply(setup,message(setup,late),'SIM')
    for metric in METRICS:
        for filters in [{}, {'basis':'response'}]:
            expected=local_data(c.unit,metric,{},filters)
            actual=run_query(draft(setup,sql_source,metric,filters),{},typed=True)
            assert expected[0]==actual[0]
            assert normalize(expected[1])==normalize(actual[1]),(metric,filters,expected[1],actual[1])


def test_percentage_rounding_matches_existing_binary_float_values(setup,sql_source):
    with connect(sql_source) as db:
        for value in [0,2.675,3.125,96.875,1.005,-2.675,12.345,99.999999,50000]:
            q=db.cursor();q.execute('SELECT '+schema_name(setup['unit'].pk)+'.arredondar(%s)',[value])
            assert float(q.fetchone()[0])==round(value,2),value


def test_sql_source_exports_through_canvas_without_creating_messages(setup,sql_source):
    import io,base64
    from pypdf import PdfReader
    from operations.report_canvas.ports import make_layout
    from operations.report_canvas.engine import export
    from messaging.models import Message
    case(setup,outcome='confirmed')
    report=draft(setup,sql_source,'confirmed',{'purpose':'appointment'})
    report.reviewed=True;report.enabled=True;report.canvas_enabled=True;report.save()
    layout=make_layout(report)
    report.canvas_layout=layout;report.save(update_fields=['canvas_layout'])
    assert 'dataset' not in layout['sources'][0]
    before=Message.objects.count()
    result,_=export(report,layout,{},[],'pdf')
    assert len(PdfReader(io.BytesIO(base64.b64decode(result))).pages)>=1
    assert Message.objects.count()==before
    from types import SimpleNamespace
    from operations.reports import local_report_content
    legacy_result,_=local_report_content(SimpleNamespace(report=report,parameters={},format='pdf'))
    assert len(PdfReader(io.BytesIO(base64.b64decode(legacy_result))).pages)>=1
    csv_result,_=local_report_content(SimpleNamespace(report=report,parameters={},format='csv'))
    assert 'Paciente' in csv_result and 'Teste' in csv_result
    assert Message.objects.count()==before
    parent=ReportDefinition.objects.create(unit=report.unit,name='Consolidado',code='consolidated',source='composite',reviewed=True,enabled=True,canvas_enabled=True,parameter_schema={**report.parameter_schema,'unidade':{**report.parameter_schema['unidade'],'default':'_origens'}},components=[{'code':report.code}])
    result,_=export(parent,layout,{},[],'pdf')
    pdf=PdfReader(io.BytesIO(base64.b64decode(result)))
    assert 'Teste' in ''.join(page.extract_text() for page in pdf.pages)
    assert Message.objects.count()==before


def test_standard_operational_handlers_match_without_forcing_a_date_window(setup,sql_source):
    from operations.operational_local_sql import query_for_standard,standard_schema
    from operations.reports import HANDLERS,local_report_data
    from datetime import datetime
    from zoneinfo import ZoneInfo
    for purpose,outcome in [('appointment','confirmed'),('appointment','declined'),('absence',''),('report','')]:
        c=case(setup,purpose=purpose,outcome=outcome,response_state='no_response')
        c.assignee=setup['user'];c.save()
        if purpose=='report':
            c.event.occurred_at=timezone.now()-timedelta(days=80);c.event.save()
        for state in ['sent','failed']:
            message(setup,c,state)
    message(setup,case(setup),'queued')
    for handler in HANDLERS:
        original=ReportDefinition(unit=setup['unit'],source='local',handler=handler)
        report=ReportDefinition(unit=setup['unit'],source='sql',connection=sql_source,query_sql=query_for_standard(handler,setup['unit']),parameter_schema=standard_schema(setup['unit'],handler),legacy={'operational_sql_local':True})
        for values in [{},{'start':timezone.now().date().isoformat(),'end':timezone.now().date().isoformat()}]:
            cols,expected=local_report_data(original,values)
            for row in expected:row[3]=datetime.fromisoformat(row[3]).astimezone(ZoneInfo(setup['unit'].timezone)).replace(tzinfo=None)
            actual_cols,actual=run_query(report,values,typed=True)
            assert cols==actual_cols
            assert sorted(expected,key=repr)==sorted(actual,key=repr),(handler,values,expected,actual)
