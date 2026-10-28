import copy
import json
from io import StringIO
from unittest.mock import patch

import pytest
from django.core.management import call_command, CommandError

from core.models import Unit, Audit
from operations.models import ReportConnection, ReportDefinition
from operations.management.commands.map_legacy_five_canvases import (
    IDS, COLUMNS, KEY, eligible, mapped_layout, apply_plan, sha, state,
)


@pytest.fixture
def five(db):
    unit = Unit.objects.create(pk=2, slug='scv', name='SCV')
    connection = ReportConnection.objects.create(pk=1, unit=unit, name='Oracle',
                                                engine='oracle', enabled=True, validated=True)
    return [ReportDefinition.objects.create(pk=pk, unit=unit, code=code, name=code,
                catalog_kind='component', source='sql', connection=connection, reviewed=False,
                enabled=False, canvas_enabled=False, query_sql='SELECT 1 AS "Total" FROM dual',
                legacy={'original_sql': 'SELECT 1 AS "Total" FROM dual'})
            for pk, code in IDS.items()]


def plan(five):
    return {'mode': 'dry_run', 'reports': [
        {'id': r.pk, 'before_sha256': sha(state(r)),
         'layout': mapped_layout(r, COLUMNS[r.pk]),
         'evidence': {'read_only': True, 'numeric_parity': 'pending_accepted_legacy_sample',
                      'sample_rows': 5}}
        for r in five]}


def test_apply_is_scoped_idempotent_and_keeps_sources_unapproved(five):
    before = {r.pk: state(r) for r in five}
    approved = plan(five)
    assert set(apply_plan(approved)) == set(IDS)
    assert apply_plan(approved) == []
    assert Audit.objects.filter(action='report.legacy_five_draft_mapped').count() == 5
    for r in five:
        r.refresh_from_db()
        assert r.canvas_layout and r.legacy[KEY]['previous']['canvas_layout'] == {}
        for field, value in before[r.pk].items():
            if field not in {'canvas_layout', 'legacy', 'version'}:
                assert getattr(r, field) == value


def test_concurrent_change_rolls_back_whole_lot(five):
    approved = plan(five)
    last = five[-1]
    last.version += 1
    last.save(update_fields=['version'])
    with pytest.raises(CommandError, match='alterado'):
        apply_plan(approved)
    assert not Audit.objects.filter(action='report.legacy_five_draft_mapped').exists()
    assert not ReportDefinition.objects.exclude(canvas_layout={}).exists()


def test_missing_ids_and_changed_original_sql_are_rejected(five):
    approved = plan(five)
    approved['reports'].pop()
    with pytest.raises(CommandError, match='exatamente'):
        apply_plan(approved)
    five[0].query_sql = 'SELECT 2 FROM dual'
    with pytest.raises(CommandError, match='fora do lote'):
        eligible(five[0])


def test_dry_run_never_writes_and_backup_must_be_complete(five, tmp_path):
    def sample(r):
        return mapped_layout(r, COLUMNS[r.pk]), {
            'read_only': True, 'numeric_parity': 'pending_accepted_legacy_sample', 'sample_rows': 5}
    output = tmp_path/'dry.json'
    with patch('operations.management.commands.map_legacy_five_canvases.probe', side_effect=sample):
        call_command('map_legacy_five_canvases', output=str(output), stdout=StringIO())
    assert len(json.loads(output.read_text())['reports']) == 5
    assert not Audit.objects.exists()
    assert not ReportDefinition.objects.exclude(canvas_layout={}).exists()
    backup = tmp_path/'backup.sql'
    backup.write_text('x' * 500)
    with pytest.raises(CommandError, match='incompleto'):
        call_command('map_legacy_five_canvases', output=str(tmp_path/'apply.json'),
                     apply=True, backup=str(backup), approved_plan=str(output), stdout=StringIO())


def test_existing_blocks_are_preserved_and_post_apply_edit_is_not_silently_skipped(five):
    r = five[0]
    r.canvas_layout = mapped_layout(r, COLUMNS[r.pk])
    r.save(update_fields=['canvas_layout'])
    before = copy.deepcopy(r.canvas_layout)
    assert mapped_layout(r, COLUMNS[r.pk]) == before
    approved = plan(five)
    apply_plan(approved)
    r.refresh_from_db()
    r.canvas_layout['pages'][0]['name'] = 'Edição posterior'
    r.save(update_fields=['canvas_layout'])
    with pytest.raises(CommandError, match='editado'):
        apply_plan(approved)


def test_reversal_restores_only_mapping_and_rejects_later_edits(five):
    from operations.management.commands.map_legacy_five_canvases import revert_plan
    approved = plan(five)
    apply_plan(approved)
    from django.db import connection
    from django.test.utils import CaptureQueriesContext
    with CaptureQueriesContext(connection) as captured:
        assert set(revert_plan(approved)) == set(IDS)
    assert not any('FOR UPDATE' in q['sql'] for q in captured.captured_queries)
    assert ReportDefinition.objects.exclude(canvas_layout={}).count() == 5
    assert set(revert_plan(approved, apply=True)) == set(IDS)
    assert not ReportDefinition.objects.exclude(canvas_layout={}).exists()
    assert all(KEY not in r.legacy for r in ReportDefinition.objects.all())
    with pytest.raises(CommandError, match='ausente'):
        revert_plan(approved, apply=True)
