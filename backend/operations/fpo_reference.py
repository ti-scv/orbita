"""FPO legacy reference imports and the recovered percentage formula."""
from collections import defaultdict
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
import hashlib,json
from django.db import transaction
from django.utils import timezone
from core.models import Unit,Audit
from operations.models import ReportDefinition,ReportSnapshotConfiguration,ReportSnapshotRun,ReportSnapshotDataRow

QUOTA="FPO_COTA_DRS_PROCEDIMENTOS"
MAPPING="FPO_DEPARA_MUTIRAO"
REQUIRED={QUOTA:{"GRUPO_RELATORIO","FINANCIAMENTO","TIPO_FISICO_FINANCEIRO","AGRUPAMENTO","COMPLEXIDADE_AMB","VALOR","COMPETENCIA"},MAPPING:{"REMESSA","TIPO"}}

def digest(rows):
    payload=json.dumps(rows,ensure_ascii=False,sort_keys=True,separators=(",",":"),allow_nan=False).encode()
    return hashlib.sha256(payload).hexdigest()

def validate(payload):
    if payload.get("schema")!=1 or payload.get("source")!="172.16.0.123 GLDADOS.FDB" or payload.get("read_only") is not True or payload.get("no_db_triggers") is not True:raise ValueError("Origem ou transação incompatível")
    tables=payload.get("tables",{})
    if set(tables)!={QUOTA,MAPPING}:raise ValueError("Tabelas incompatíveis")
    for table,required in REQUIRED.items():
        obj=tables[table];columns=obj.get("columns",[]);rows=obj.get("rows",[])
        if len(set(columns))!=len(columns) or not required.issubset(columns) or not isinstance(rows,list) or not rows or len(rows)>20000:raise ValueError("Colunas ou quantidade inválidas")
        if any(not isinstance(row,dict) or set(row)!=set(columns) for row in rows):raise ValueError("Linha incompleta")
        digest(rows)
    grouped=defaultdict(list)
    for row in tables[QUOTA]["rows"]:
        stamp=row.get("COMPETENCIA")
        try:day=datetime.fromisoformat(stamp).date()
        except (TypeError,ValueError):raise ValueError("Competência inválida") from None
        if day.day!=1:raise ValueError("Competência deve ser o primeiro dia do mês")
        grouped[day].append(row)
    return grouped,tables[MAPPING]["rows"]


def projected_percentage(production, quota, day_elapsed, days_in_month):
    # Recovered statically from PROC_FPO_CALCULA_PERCENTUAL BLR. Its zero
    # display is an empty string; NULL operands propagate once the guard passes.
    if quota is None or day_elapsed is None:return 0,""
    q,day=Decimal(str(quota)),Decimal(str(day_elapsed))
    if not q.is_finite() or not day.is_finite():raise ValueError("Valor não finito")
    if q<=0 or day<=0:return 0,""
    if production is None or days_in_month is None:return None,None
    vals=[Decimal(str(v)) for v in (production,quota,day_elapsed,days_in_month)]
    if not all(v.is_finite() for v in vals):raise ValueError("Valor não finito")
    p,q,day,total=vals
    number=int(((p/day*total/q)*100).quantize(Decimal("1"),rounding=ROUND_HALF_UP))
    return number, f"{number}%" if number else ""


def import_references(unit,payload,source_sha256,*,captured_at=None):
    if unit.slug!="scv":raise ValueError("A origem foi validada apenas para SCV")
    grouped,mapping=validate(payload);now=captured_at or timezone.now()
    run_sets=[("fpo_quotas","fpo-cotas-historicas","FPO · cotas históricas",grouped),("fpo_mapping","fpo-depara-historico","FPO · de/para histórico",{timezone.localdate(now):mapping})]
    counts={};created=0
    with transaction.atomic():
        Unit.objects.select_for_update().get(pk=unit.pk)
        consumers=list(ReportDefinition.objects.filter(unit=unit,code__in=["legacy123-75","legacy123-81"]))
        if len(consumers)!=2:raise ValueError("Relatórios FPO não encontrados")
        for kind,code,name,periods in run_sets:
            source,_=ReportDefinition.objects.get_or_create(unit=unit,code=code+"-source",defaults={"name":name+" · origem", "catalog_kind":"component","source":"legacy_pending","enabled":False,"reviewed":False,"manual_enabled":False,"unavailable_reason":"Referência importada do legado; atualização atual ainda não configurada.","legacy":{"source_path":"Firebird GLDADOS: "+(QUOTA if kind=="fpo_quotas" else MAPPING)}})
            target,_=ReportDefinition.objects.get_or_create(unit=unit,code=code+"-data",defaults={"name":name,"catalog_kind":"component","source":"local","handler":"","enabled":False,"reviewed":False,"manual_enabled":False,"unavailable_reason":"Histórico disponível em Coleta; relatório FPO ainda em validação."})
            config,_=ReportSnapshotConfiguration.objects.get_or_create(unit=unit,code=code,defaults={"name":name,"dataset_kind":kind,"source_report":source,"output_report":target,"environment":"production","collection_time":"00:00:00","enabled":False})
            if config.dataset_kind!=kind or config.source_report_id!=source.pk or config.output_report_id!=target.pk or config.environment!="production" or config.enabled:raise ValueError("Configuração existente incompatível")
            config.consumers.add(*consumers)
            rows_total=0
            for stamp,records in sorted(periods.items()):
                records=sorted(records,key=lambda v:json.dumps(v,ensure_ascii=False,sort_keys=True,separators=(",",":"),allow_nan=False))
                sha=digest(records);key=kind+"_legacy_v1"
                run=ReportSnapshotRun.objects.filter(configuration=config,dataset_key=key,reference_date=stamp).first()
                if run:
                    saved=list(run.data_rows.order_by("record_key").values_list("payload",flat=True))
                    if run.unit_id!=unit.pk or run.state!="ready" or run.source_snapshot.get("environment")!="production" or run.source_snapshot.get("kind")!="legacy_reference_import" or run.row_count!=len(records) or digest(saved)!=sha:raise ValueError("Importação existente diverge; preservada")
                else:
                    run=ReportSnapshotRun.objects.create(unit=unit,configuration=config,reference_date=stamp,dataset_key=key,period_type="month" if kind=="fpo_quotas" else "day",origin="legacy",state="ready",configuration_version=config.version,source_snapshot={"kind":"legacy_reference_import","environment":"production","source":"GLDADOS.FDB","table":QUOTA if kind=="fpo_quotas" else MAPPING,"source_sha256":source_sha256,"data_sha256":sha,"read_only":True,"no_db_triggers":True},captured_at=now,completed_at=now,row_count=len(records))
                    ReportSnapshotDataRow.objects.bulk_create([ReportSnapshotDataRow(unit=unit,run=run,record_key=f"{i:08d}",payload=record) for i,record in enumerate(records)],batch_size=1000)
                    created+=1
                rows_total+=len(records)
            counts[kind]={"records":rows_total,"periods":len(periods),"configuration":config.pk}
        if created:
            for report in consumers:
                meta=dict(report.legacy);external=dict(meta.get("external_mapping",{}));external["blocker"]="Cotas e de/para históricos importados; cotas recuperadas apenas de 01/2022 a 05/2023. Localizar cotas atuais e reconciliar produção e cálculos antes de habilitar.";meta["external_mapping"]=external;meta["fpo_reference"]={"quotas":"fpo-cotas-historicas","mapping":"fpo-depara-historico","source_sha256":source_sha256,"coverage_start":min(grouped).isoformat(),"coverage_end":max(grouped).isoformat()};report.legacy=meta;report.version+=1;report.save(update_fields=["legacy","version"])
            Audit.objects.create(unit=unit,action="report.fpo_reference_imported",object_id="fpo",details={"quotas":counts["fpo_quotas"],"mapping":counts["fpo_mapping"],"source_sha256":source_sha256,"coverage_start":min(grouped).isoformat(),"coverage_end":max(grouped).isoformat(),"automatic_enabled":False})
    return {"counts":counts,"created_runs":created,"coverage_start":min(grouped).isoformat(),"coverage_end":max(grouped).isoformat()}
