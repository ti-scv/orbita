import copy
from datetime import date,datetime,timezone
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from core.models import Unit,Membership
from operations.models import ReportDefinition,ReportSnapshotConfiguration,ReportSnapshotRun,ReportSnapshotDataRow
from operations.fpo_reference import import_references,projected_percentage,QUOTA,MAPPING
from operations.bed_snapshots import definition,SnapshotError


def payload():
    q={"GRUPO_RELATORIO":"AMB","FINANCIAMENTO":"MAC","TIPO_FISICO_FINANCEIRO":"FISICO","AGRUPAMENTO":"A","COMPLEXIDADE_AMB":"MC","VALOR":10,"COMPETENCIA":"2023-05-01T00:00:00"}
    m={"REMESSA":"MUTIRAO","TIPO":"CORUJAO/MUTIRAO"}
    return {"schema":1,"source":"172.16.0.123 GLDADOS.FDB","read_only":True,"no_db_triggers":True,"tables":{QUOTA:{"columns":list(q),"rows":[q,copy.deepcopy(q)]},MAPPING:{"columns":list(m),"rows":[m]}}}

@pytest.fixture
def unit(db):
    unit=Unit.objects.create(slug="scv",name="SCV")
    for code in ["legacy123-75","legacy123-81"]:ReportDefinition.objects.create(unit=unit,code=code,name=code)
    return unit


def test_formula_matches_recovered_projection_and_null_semantics():
    assert projected_percentage(80,100,10,30)==(240,"240%")
    assert projected_percentage(1,8,1,1)==(13,"13%")
    assert projected_percentage(1,0,10,30)==(0,"")
    assert projected_percentage(1,10,0,30)==(0,"")
    assert projected_percentage(None,10,10,30)==(None,None)
    with pytest.raises(ValueError):projected_percentage(1,"NaN",10,30)


@pytest.mark.django_db
def test_idempotent_import_preserves_duplicate_rows_and_never_extrapolates(unit):
    when=datetime(2026,10,27,tzinfo=timezone.utc)
    first=import_references(unit,payload(),"a"*64,captured_at=when)
    second=import_references(unit,payload(),"a"*64,captured_at=when)
    assert first['created_runs']==2 and second['created_runs']==0
    assert first['coverage_end']=='2023-05-01'
    quota=ReportSnapshotRun.objects.get(configuration__dataset_kind='fpo_quotas')
    assert quota.data_rows.count()==2 and quota.reference_date==date(2023,5,1)
    assert not ReportSnapshotRun.objects.filter(configuration__dataset_kind='fpo_quotas',reference_date__gte=date(2026,1,1)).exists()
    assert not ReportSnapshotConfiguration.objects.filter(dataset_kind__startswith='fpo_',enabled=True).exists()
    with pytest.raises(SnapshotError):definition(quota.configuration,require_source=True)


@pytest.mark.django_db
def test_conflicting_reimport_rolls_back_and_preserves_history(unit):
    when=datetime(2026,10,27,tzinfo=timezone.utc);import_references(unit,payload(),"a"*64,captured_at=when)
    altered=payload();altered['tables'][QUOTA]['rows'][0]['VALOR']=99
    with pytest.raises(ValueError,match='diverge'):import_references(unit,altered,"b"*64,captured_at=when)
    assert list(ReportSnapshotDataRow.objects.filter(run__configuration__dataset_kind='fpo_quotas').values_list('payload',flat=True))[0]['VALOR']==10


@pytest.mark.django_db
def test_history_api_is_scoped_and_available_to_own_admin(unit):
    import_references(unit,payload(),"a"*64,captured_at=datetime(2026,10,27,tzinfo=timezone.utc))
    other=Unit.objects.create(slug='other-fpo',name='Outra');user=get_user_model().objects.create_user(username='fpo-qa')
    Membership.objects.create(user=user,unit=unit,role='admin');Membership.objects.create(user=user,unit=other,role='admin')
    client=APIClient();client.force_authenticate(user)
    run=ReportSnapshotRun.objects.get(configuration__dataset_kind='fpo_quotas')
    assert client.get(f'/api/v1/report-snapshot-runs/{run.pk}/records/?unit=scv').status_code==200
    assert client.get(f'/api/v1/report-snapshot-runs/{run.pk}/records/?unit=other-fpo').status_code==404
    listing=client.get('/api/v1/report-snapshots/?unit=scv');assert listing.status_code==200
    assert any(row['dataset_kind']=='fpo_quotas' and row['connection_name']=='Importação legada' for row in listing.data['results'])
