from types import SimpleNamespace
from unittest.mock import patch
import pytest
from rest_framework.exceptions import ValidationError
from core.models import Unit
from operations.models import ReportDefinition
from operations.external_report_mapping import contract,draft,compose
from operations.report_canvas.blocks import TableBlock
from operations.report_canvas.sources import Dataset,resolve_report
from operations.report_canvas.api import response


def evidence():
    return {"components":[{"ID_RELATORIO":39,"DATAFIELD":c,"VISCOMP":"S"} for c in ["RET_NOME_ESPECIALIDADE","RET_MES10","RET_MES2","RET_MES1","RET_MES1_TITULO"]],"charts":[]}


def test_draft_preserves_fields_and_period_order_without_rows():
    spec=contract(39,evidence())
    assert spec['table_columns']==['RET_NOME_ESPECIALIDADE','RET_MES1','RET_MES2','RET_MES10']
    value=draft(SimpleNamespace(pk=9,name='Altas'),spec)
    assert value['sources']==[{'id':'dados','type':'report','report_id':9,'label':'Altas'}]
    assert value['pages'][0]['blocks'][-1]['options']['header_fields']=={'RET_MES1':'RET_MES1_TITULO'}
    assert all('rows' not in s for s in value['sources'])


def test_wide_tables_keep_every_column():
    fields=['Nome']+[f'Campo{i}' for i in range(40)]
    value=draft(SimpleNamespace(pk=9,name='QA'),{'columns':fields})
    recovered={c for p in value['pages'] for b in p['blocks'] if b['type']=='table' for c in b['options']['columns']}
    assert recovered==set(fields)


def test_oversized_composition_fails_explicitly_without_truncating():
    children=[SimpleNamespace(pk=i,code=str(i),canvas_layout=draft(SimpleNamespace(pk=i,name='QA'),{'columns':['A','B']})) for i in range(1,32)]
    value,reason=compose(SimpleNamespace(),children)
    assert value is None and '30 fontes' in reason
    assert len(children)==31


def test_dynamic_headers_preserve_values_and_detect_mixed_periods():
    b={'id':'b','type':'table','source_id':'s','options':{'columns':['V'],'header_fields':{'V':'T'}}}
    result=TableBlock().prepare(b,SimpleNamespace(datasets={'s':Dataset(['V','T'],[[15,'out/26'],[23,'out/26']])}))
    assert result['columns']==['out/26'] and result['rows']==[[15],[23]]
    with pytest.raises(ValidationError):TableBlock().prepare(b,SimpleNamespace(datasets={'s':Dataset(['V','T'],[[15,'out/26'],[23,'nov/26']])}))


@pytest.mark.django_db
def test_pending_catalog_is_same_unit_design_only_and_never_queries_external_db():
    unit=Unit.objects.create(slug='external-qa',name='QA');other=Unit.objects.create(slug='other-external',name='Outra')
    owner=ReportDefinition.objects.create(unit=unit,code='owner',name='Pai')
    pending=ReportDefinition.objects.create(unit=unit,code='pending',name='Pendente',enabled=False,reviewed=False,legacy={'external_mapping':{'columns':['A','B'],'blocker':'Validar fonte'}})
    foreign=ReportDefinition.objects.create(unit=other,code='foreign',name='Outra',legacy={'external_mapping':{'columns':['A']}})
    with patch('operations.report_engine.connect',side_effect=AssertionError('No external connection in catalog')):
        catalog=response(owner)['sources']
        assert any(r['id']==pending.pk and r['available'] is False and r['columns']==['A','B'] for r in catalog)
        assert not any(r['id']==foreign.pk for r in catalog)
        with pytest.raises(ValidationError):resolve_report(owner,{'report_id':pending.pk})
        with pytest.raises(ValidationError):resolve_report(owner,{'report_id':foreign.pk})
