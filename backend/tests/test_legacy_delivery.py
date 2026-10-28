import copy
import json
from datetime import date
from io import StringIO
from unittest.mock import patch

import pytest
from django.core.management import call_command, CommandError
from rest_framework.exceptions import ValidationError
from core.models import Unit, Audit
from operations.models import ReportConnection, ReportDefinition
from operations.legacy_delivery import (apply_plans, legacy_inventory, plan_report,
                                        sample_parameters, validate_candidate, revert_canvases)
from operations.report_canvas.api import response


@pytest.fixture
def source(db):
    unit = Unit.objects.create(slug='scv', name='SCV')
    c = ReportConnection.objects.create(unit=unit, name='Oracle', engine='oracle', enabled=True, validated=True)
    return ReportDefinition.objects.create(unit=unit, name='Atendimentos', code='legacy123-33',
        catalog_kind='component', source='sql', connection=c, reviewed=True, enabled=True,
        query_sql='SELECT 1 AS "Total" FROM dual', output_format='csv')


def test_only_previously_reviewed_sources_are_eligible(source):
    assert plan_report(source) == {}
    source.reviewed = False
    assert plan_report(source) is None
    source.reviewed = True; source.code = 'unknown-procedure'
    assert plan_report(source) is None
    source.code = 'legacy123-33'; source.canvas_layout = {'custom': True}
    assert plan_report(source) is None


def test_date_preview_is_relative_and_never_invents_identifiers(source):
    source.parameter_schema = {'inicio': {'type':'date'}, 'fim_exclusivo': {'type':'date'}}
    assert sample_parameters(source, date(2026,10,28)) == {'inicio':'2026-09-28','fim_exclusivo':'2026-10-28'}
    source.parameter_schema['codigo'] = {'type':'integer','required':True}
    with pytest.raises(ValidationError): sample_parameters(source)


def test_validates_real_rows_without_persisting_them_and_preserves_export(source):
    with patch('operations.legacy_delivery.run_query', return_value=(['Total'],[[5]])):
        layout, evidence = validate_candidate(source, {})
    assert evidence['rows'] == 1 and evidence['types'] == {'Total':['int']}
    assert evidence['pdf_bytes'] > 100 and 'rows' not in layout['sources'][0]
    assert apply_plans([(source,layout,evidence)]) == [source.pk]
    source.refresh_from_db()
    assert source.output_format == 'csv' and source.enabled and source.reviewed
    assert source.canvas_enabled is False
    assert plan_report(source) is None  # idempotente
    assert response(source)['default_data_mode'] == 'preview'
    assert Audit.objects.filter(action='report.legacy_canvas_completed').count() == 1
    assert set(layout['sources'][0]) <= {'id','type','report_id','label'}


def test_source_columns_empty_sample_and_concurrent_edits_are_rejected(source):
    with patch('operations.legacy_delivery.run_query', return_value=(['Wrong'],[[5]])):
        with pytest.raises(ValidationError):validate_candidate(source,{})
    with patch('operations.legacy_delivery.run_query', return_value=(['Total'],[])):
        with pytest.raises(ValidationError):validate_candidate(source,{})
    original = copy.copy(source)
    source.version += 1; source.save(update_fields=['version'])
    with pytest.raises(ValidationError):apply_plans([(original,{}, {})])
    source.refresh_from_db(); assert source.canvas_layout == {}


def test_inventory_covers_every_legacy_record_including_missing_and_external(source):
    archive={'reports':[{'ID_RELATORIO':33,'NOME_RELATORIO':'Atendimentos'}, {'ID_RELATORIO':999,'NOME_RELATORIO':'Ausente'}]}
    rows=legacy_inventory(archive)
    assert len(rows)==2 and rows[0]['exists'] and rows[0]['source_ready']
    assert not rows[1]['exists'] and not rows[1]['canvas']


def test_command_dry_run_writes_only_evidence_and_apply_requires_backup(source,tmp_path):
    archive=tmp_path/'archive.json'; archive.write_text('{"reports":[]}')
    with patch('operations.management.commands.complete_legacy_canvases.validate_candidate', return_value=({'version':1},{'rows':1})):
        call_command('complete_legacy_canvases',archive=str(archive),output=str(tmp_path/'dry'),stdout=StringIO())
    source.refresh_from_db(); assert source.canvas_layout == {}
    assert not Audit.objects.filter(action='report.legacy_canvas_completed').exists()
    with pytest.raises(CommandError):
        call_command('complete_legacy_canvases',archive=str(archive),output=str(tmp_path/'apply'),apply=True,backup=str(tmp_path/'missing'),stdout=StringIO())


def test_reversal_is_explicit_and_preserves_concurrent_edits(source):
    with patch('operations.legacy_delivery.run_query', return_value=(['Total'], [[5]])):
        layout, evidence = validate_candidate(source,{})
    apply_plans([(source,layout,evidence)])
    assert revert_canvases([source.pk]) == [source.pk]
    source.refresh_from_db(); assert source.canvas_layout
    assert revert_canvases([source.pk],apply=True) == [source.pk]
    source.refresh_from_db(); assert not source.canvas_layout and 'canvas_legacy_delivery' not in source.legacy
    with pytest.raises(ValidationError):revert_canvases([source.pk],apply=True)
