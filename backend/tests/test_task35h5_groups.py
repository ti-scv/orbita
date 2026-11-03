import json
from unittest.mock import patch

import pytest
from core.access import SECTIONS, check_resource
from core.models import Membership, RemoteInstance, Unit
from messaging.models import AppointmentGroup
from operations.models import Case, SourceEvent
from operations.services import ensure_appointment_case
from rest_framework.exceptions import PermissionDenied
from test_federation import connected, federation


def policy(**values):
    return {**{key: "none" for key in SECTIONS}, **values}


def make_group(f, unit=None, version=1):
    return AppointmentGroup.objects.create(unit=unit or f["unit"], kind="consultation",
        appointment_date=f["now"].date(), rule=f["rule"], rule_version=version, scheduled_for=f["now"])


@pytest.mark.django_db
def test_group_cases_and_objects(setup):
    f = setup
    case = ensure_appointment_case(f["appointment"])
    group = make_group(f)
    other_group = make_group(f, version=2)
    empty_group = make_group(f, version=3)
    f["message"].group = group
    f["message"].case = case
    f["message"].save()
    from copy import copy
    from uuid import uuid4
    other_message = copy(f["message"])
    other_message.pk = uuid4()
    other_message.group = other_group
    other_message.rule_version += 1
    other_message.notification_key = None
    other_message.notification = None
    other_message.save(force_insert=True)
    other_event = SourceEvent.objects.create(unit=f["unit"], source="test", kind="cross", external_id="outside", occurred_at=f["now"])
    other = Case.objects.create(unit=f["unit"], event=other_event, purpose="appointment")
    member = Membership.objects.get(user=f["user"], unit=f["unit"])
    member.permissions = policy(groups="write")
    member.save()
    c = f["client"]
    suffix = f"?group={group.pk}"
    for path in [f"cases/{case.pk}/", f"cases/{case.pk}/timeline/", f"cases/{case.pk}/communications/", "cases/", "cases/metrics/", "cases/export/"]:
        assert c.get('/api/v1/' + path + suffix).status_code == 200
    communications = c.get(f'/api/v1/cases/{case.pk}/communications/' + suffix).json()
    assert {item['id'] for item in communications['messages']} == {str(f['message'].pk)}
    appointment = c.get(f'/api/v1/appointments/{f["appointment"].pk}/' + suffix).json()
    assert appointment['tracking']['messages'] == 1
    assert c.get(f'/api/v1/cases/{other.pk}/' + suffix).status_code == 404
    assert c.get(f'/api/v1/cases/{case.pk}/?group={empty_group.pk}').status_code == 404
    other_comms = c.get(f'/api/v1/cases/{case.pk}/communications/?group={other_group.pk}').json()
    assert {item['id'] for item in other_comms['messages']} == {str(other_message.pk)}
    assert c.get('/api/v1/cases/operators/' + suffix).status_code == 403
    assert c.get('/api/v1/cases/health/' + suffix).status_code == 403
    assert c.post(f'/api/v1/cases/{other.pk}/act/' + suffix, {"action":"note", "text":"nota", "version":1}, format='json', HTTP_IDEMPOTENCY_KEY='group-case-outside').status_code == 404
    assert c.post(f'/api/v1/cases/{case.pk}/act/' + suffix, {"action":"note", "text":"nota", "version":1}, format='json', HTTP_IDEMPOTENCY_KEY='group-case-inside').status_code == 200
    member.permissions = policy(appointments="write")
    member.save()
    for resource in ['cases', 'contacts', 'movements', 'appointments', 'agenda-items']:
        assert c.get('/api/v1/' + resource + '/' + suffix).status_code == 403
    member.permissions = policy(groups="read")
    member.save()
    assert c.post(f'/api/v1/cases/{case.pk}/act/' + suffix, {}, format='json', HTTP_IDEMPOTENCY_KEY='group-case-readonly').status_code == 403
    other_unit = Unit.objects.create(slug='other-unit', name='Outra')
    foreign = make_group(f, other_unit)
    assert c.get(f'/api/v1/cases/?group={foreign.pk}').status_code == 404


@pytest.mark.django_db
@pytest.mark.parametrize('resource', ['cases/', 'contacts/', 'movements/', 'appointments/', 'agenda-items/'])
def test_proxy_group_requires_supported_origin_and_permission(connected, resource):
    f = connected
    connection = RemoteInstance.objects.get()
    connection.remote_unit_slug = f['unit'].slug
    connection.save()
    member = Membership.objects.get(user=f['user'], unit=f['unit'])
    member.permissions = policy(groups='read')
    member.save()
    group = make_group(f)
    with patch('core.federation.remote_http', return_value=(200, {}, b'{"cases_section_limit":true,"contacts_movements_section_limit":true}')) as remote:
        assert f['client'].get(f['proxy'] + resource + f'?group={group.pk}').status_code == 403
        assert remote.call_count == 1
    member.permissions = policy(appointments='read')
    member.save()
    with patch('core.federation.remote_http') as remote:
        assert f['client'].get(f['proxy'] + resource + f'?group={group.pk}').status_code == 403
        remote.assert_not_called()


@pytest.mark.parametrize('section', ['overview','messages','groups','issues','appointments','campaigns'])
@pytest.mark.parametrize('method', ['GET','POST'])
def test_generic_case_and_movement_permission_matrix(section, method):
    level = 'read' if method == 'GET' else 'write'
    allowed = {'cases': {'messages','issues','appointments','campaigns'}, 'movements': {'messages','issues','appointments'}}
    for resource, sections in allowed.items():
        if section in sections:
            check_resource(policy(**{section:level}), resource+'/', method, {})
        else:
            with pytest.raises(PermissionDenied):
                check_resource(policy(**{section:level}), resource+'/', method, {})
        with pytest.raises(PermissionDenied):
            check_resource(policy(**{section:'read'}), resource+'/', 'POST', {})


@pytest.mark.django_db
def test_group_scope_is_enforced_by_federated_origin(connected):
    from urllib.parse import urlencode
    f = connected
    connection = RemoteInstance.objects.get()
    connection.remote_unit_slug = f['unit'].slug
    connection.save()
    case = ensure_appointment_case(f['appointment'])
    group = make_group(f)
    f['message'].group = group
    f['message'].save()
    event = SourceEvent.objects.create(unit=f['unit'], source='test', kind='cross', external_id='outside-remote', occurred_at=f['now'])
    other = Case.objects.create(unit=f['unit'], event=event, purpose='appointment')
    member = Membership.objects.get(user=f['user'], unit=f['unit'])
    member.permissions = policy(groups='read')
    member.save()

    def origin(base_url, key, path, **kwargs):
        if path == 'federation/manifest/':
            return 200, {}, b'{"group_object_scope":true,"cases_section_limit":true}'
        query = urlencode(kwargs['query'], doseq=True)
        response = f['bearer'].get('/api/v1/' + path + '?' + query,
            HTTP_X_ORBITA_SECTION_LIMIT=json.dumps(kwargs['section_limit']))
        return response.status_code, {'Content-Type': 'application/json'}, response.content

    with patch('core.federation.remote_http', side_effect=origin):
        assert f['client'].get(f["proxy"] + f'cases/{case.pk}/?group={group.pk}').status_code == 200
        assert f['client'].get(f["proxy"] + f'cases/{other.pk}/?group={group.pk}').status_code == 404
        f['appointment'].revision += 1
        f['appointment'].save(update_fields=['revision'])
        assert f['client'].get(f["proxy"] + f'cases/{case.pk}/?group={group.pk}').status_code == 404


@pytest.mark.django_db
@pytest.mark.parametrize('section', ['overview', 'messages', 'groups', 'issues', 'appointments', 'campaigns'])
def test_case_endpoint_subareas_and_method_levels(setup, section):
    f = setup
    case = ensure_appointment_case(f['appointment'])
    member = Membership.objects.get(user=f['user'], unit=f['unit'])
    client = f['client']
    path = f'/api/v1/cases/{case.pk}/'
    member.permissions = policy(**{section:'read'})
    member.save()
    expected = 200 if section in {'messages', 'issues', 'appointments', 'campaigns'} else 403
    for url in [path, path + 'timeline/', path + 'communications/']:
        assert client.get(url).status_code == expected
    payload = {'action':'note', 'text':'nota', 'version':case.version}
    assert client.post(path + 'act/', payload, format='json', HTTP_IDEMPOTENCY_KEY='case-matrix-read').status_code == 403
    member.permissions = policy(**{section:'write'})
    member.save()
    assert client.post(path + 'act/', payload, format='json', HTTP_IDEMPOTENCY_KEY='case-matrix-write').status_code == expected


@pytest.mark.django_db
@pytest.mark.parametrize('section', ['overview', 'messages', 'groups', 'issues', 'appointments', 'campaigns'])
def test_movement_endpoint_subareas_and_effects(setup, section):
    from operations.models import Movement
    f = setup
    case = ensure_appointment_case(f['appointment'])
    movement = Movement.objects.create(unit=f['unit'], case=case, kind='cancel', created_by=f['user'])
    member = Membership.objects.get(user=f['user'], unit=f['unit'])
    member.permissions = policy(**{section:'read'})
    member.save()
    client = f['client']
    path = f'/api/v1/movements/{movement.pk}/'
    allowed = section in {'messages', 'issues', 'appointments'}
    assert client.get(path).status_code == (200 if allowed else 403)
    payload = {'version': 1, 'evidence': 'confirmado', 'final': {}}
    assert client.post(path + 'confirm/', payload, format='json', HTTP_IDEMPOTENCY_KEY='movement-matrix-read').status_code == 403
    member.permissions = policy(**{section:'write'})
    member.save()
    assert client.post(path + 'confirm/', payload, format='json', HTTP_IDEMPOTENCY_KEY='movement-matrix-write').status_code == (200 if allowed else 403)
    movement.refresh_from_db()
    assert (movement.state == 'confirmed_external') == allowed
