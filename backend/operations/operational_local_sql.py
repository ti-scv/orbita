"""Port the original eight operational handlers to their own editable SQL queries."""
import copy
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from django.db import transaction
from django.utils import timezone
from operations.operational_sql import literal, schema_name, parameter_schema, provision, fail


def query_for_standard(handler, unit):
    from operations.reports import HANDLERS
    from operations.models import Purpose
    if handler not in HANDLERS:
        fail('Relatório operacional padrão inválido.')
    schema=schema_name(unit.pk)
    zone=literal(unit.timezone)
    conditions=["c.unidade=:unidade", "(COALESCE(:tipo_envio,'')='' OR c.finalidade=:tipo_envio)", f"(CAST(:start AS date) IS NULL OR c.data_evento>=(CAST(:start AS date)::timestamp AT TIME ZONE {zone}))", f"(CAST(:end AS date) IS NULL OR c.data_evento<((CAST(:end AS date)+1)::timestamp AT TIME ZONE {zone}))"]
    if handler in {'confirmed','declined'}:
        conditions.append('c.resultado='+literal(handler))
    elif handler in {'not_confirmed','combined'}:
        conditions.append("c.resultado<>'confirmed'")
    elif handler=='no_response':
        conditions.append("c.resposta_situacao='no_response'")
    elif handler=='not_sent':
        conditions.append(f"NOT EXISTS (SELECT 1 FROM {schema}.mensagens m WHERE m.case_id=c.id AND m.situacao IN ('accepted','sent','delivered','read'))")
    elif handler=='failures':
        conditions.append(f"EXISTS (SELECT 1 FROM {schema}.mensagens m WHERE m.case_id=c.id AND m.situacao IN ('failed','blocked','uncertain'))")
    purpose='CASE c.finalidade '+' '.join(f'WHEN {literal(k)} THEN {literal(v)}' for k,v in Purpose.choices)+' ELSE c.finalidade END'
    return f'''SELECT c.paciente AS "Paciente", c.telefone AS "Telefone", {purpose} AS "Finalidade", c.data_evento AS "Data",
      c.resposta_situacao AS "Resposta", c.resultado AS "Resultado", c.estado AS "Atendimento", c.responsavel AS "Responsável"
      FROM {schema}.casos c WHERE {' AND '.join(conditions)} ORDER BY c.data_evento'''


def standard_schema(unit, handler):
    defaults={'purpose':'appointment'} if handler in {'confirmed','declined','not_confirmed','not_sent','combined'} else {}
    schema=parameter_schema(unit,defaults)
    schema['start']['prompt']='Informe a data inicial (DD/MM/AAAA). Em branco: sem limite inicial.'
    schema['end']['prompt']='Informe a data final (DD/MM/AAAA). Em branco: sem limite final.'
    return schema


def migrate_standard_reports(admin_password):
    from core.models import Audit
    from operations.models import ReportDefinition
    from operations.reports import HANDLERS,local_report_data
    from operations.report_engine import run_query
    from operations.report_canvas.ports import make_layout
    rows=list(ReportDefinition.objects.filter(source='local',handler__in=HANDLERS).select_related('unit'))
    connections={}
    prepared=[]
    for original in rows:
        unit=original.unit
        if unit.pk not in connections:
            connections[unit.pk]=provision(unit,unit,admin_password)
        draft=copy.copy(original)
        draft.source='sql';draft.handler='';draft.connection=connections[unit.pk]
        draft.legacy={**original.legacy,'operational_sql_local':True}
        draft.parameter_schema=standard_schema(unit,original.handler)
        draft.query_sql=query_for_standard(original.handler,unit)
        today=timezone.localtime(timezone.now(),ZoneInfo(unit.timezone)).date()
        for values in [{},{'start':today.replace(day=1).isoformat(),'end':today.isoformat()},{'start':(today-timedelta(days=29)).isoformat(),'end':today.isoformat()}]:
            cols,expected=local_report_data(original,values)
            for row in expected:
                row[3]=datetime.fromisoformat(row[3]).astimezone(ZoneInfo(unit.timezone)).replace(tzinfo=None)
            actual_cols,actual=run_query(draft,values,typed=True)
            if cols!=actual_cols or sorted(expected,key=repr)!=sorted(actual,key=repr):
                fail('Divergência na consulta padrão '+str(original.pk)+'; migração padrão não aplicada.')
        prepared.append((original,draft))
    with transaction.atomic():
        for original,draft in prepared:
            current=ReportDefinition.objects.select_for_update().get(pk=original.pk)
            if current.version!=original.version:
                fail('Relatório padrão alterado durante a migração.')
            previous={field:copy.deepcopy(getattr(current,field)) for field in ['source','handler','connection_id','app_connection_id','query_sql','parameter_schema','canvas_layout','canvas_enabled','reviewed','version','legacy']}
            layout=copy.deepcopy(current.canvas_layout) if current.canvas_layout else make_layout(current)
            for src in layout.get('sources',[]):
                if src.get('type')=='report' and src.get('report_id')==current.pk:
                    src.pop('dataset',None)
            current.legacy={**current.legacy,'operational_sql_local':True,'operational_sql_migration':{'version':1,'previous':previous,'source_unit':current.unit.slug,'date':today.isoformat()},'source_path':'PostgreSQL SCV · '+current.unit.name+' → visões isoladas '+schema_name(current.unit_id)+' → SQL cadastrado → Canvas'}
            current.legacy.setdefault('report_category','Operacional')
            current.source='sql';current.handler='';current.connection=draft.connection
            current.query_sql=draft.query_sql;current.parameter_schema=draft.parameter_schema
            current.canvas_layout=layout;current.canvas_enabled=True;current.reviewed=True
            current.version+=1;current.save()
            Audit.objects.create(unit=current.unit,action='report.standard_sql_migrated',object_id=str(current.pk),details={'code':current.code,'parity_periods':3,'sends':False})
    return {'migrated':len(prepared),'ids':[r.pk for r,_ in prepared],'connections':len(connections)}
