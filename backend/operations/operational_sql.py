"""SQL operacional editável sobre visões PostgreSQL isoladas por unidade."""
import copy
import secrets
from datetime import timedelta
from zoneinfo import ZoneInfo
from django.db import connection as django_connection, transaction
from rest_framework.exceptions import ValidationError
from operations.app_reporting import METRICS, OUTCOME_LABELS, date_range, validate_filters

VERSION = 1
VIEW_NAMES = {'casos', 'mensagens', 'respostas', 'ligacoes', 'contatos'}
SEND_TYPES = {'appointment', 'absence', 'postoperative', 'waitlist', 'summons', 'movement'}
SEND_LABELS = {'appointment': 'Agendamentos', 'absence': 'Ausentes', 'postoperative': 'Pós-procedimento', 'waitlist': 'Busca ativa CDR', 'summons': 'Convocação', 'movement': 'Movimentações'}
FUNCTIONS = {'COALESCE', 'NULLIF', 'CAST', 'COUNT', 'SUM', 'MAX', 'MIN', 'ROUND', 'BOOL_OR', 'STRING_AGG', 'TO_CHAR', 'ROW_NUMBER', 'CONCAT', 'CONCAT_WS', 'CURRENT_TIMESTAMP', 'CURRENT_DATE', 'DATE_TRUNC', 'TIME_TO_STR', 'LOGICAL_OR', 'GROUP_CONCAT', 'TIMESTAMP_TRUNC', 'IF', 'CASE', 'AND', 'OR', 'EXISTS', 'COLLATE', 'ARREDONDAR'}


def fail(message):
    raise ValidationError(message)


def literal(value):
    return "'" + str(value).replace("'", "''") + "'"


def schema_name(unit_id):
    return 'scv_rpt_' + str(int(unit_id))


def is_internal(connection):
    return connection is not None and connection.options.get('scv_operational_sql') == VERSION


def validate_sql(sql, conn):
    """Only scoped views, CTEs and known pure builtins; database grants enforce scope too."""
    import sqlglot
    from sqlglot import exp
    if not is_internal(conn):
        return
    schema = schema_name(conn.options['source_unit_id'])
    tree = sqlglot.parse_one(sql, read='postgres')
    ctes = {c.alias_or_name for c in tree.find_all(exp.CTE)}
    for table in tree.find_all(exp.Table):
        if table.catalog or (table.db and (table.db != schema or table.name not in VIEW_NAMES)) or (not table.db and table.name not in ctes):
            fail('Use somente as visões da unidade: ' + schema + '.')
    for node in tree.walk():
        if isinstance(node, exp.Func):
            name = node.name.upper() if isinstance(node, exp.Anonymous) else node.sql_name().upper()
            if name not in FUNCTIONS:
                fail('Função não permitida na consulta operacional: ' + name)
            if isinstance(node.parent, exp.Dot):
                namespace = node.parent.this.sql(dialect='postgres').strip('"')
                if namespace != 'pg_catalog' and not (namespace == schema and name == 'ARREDONDAR'):
                    fail('Esquema de função não permitido na consulta operacional.')


def prepare_values(report, values):
    conn = report.connection
    if not is_internal(conn):
        return values
    from core.models import Unit
    unit = Unit.objects.get(pk=conn.options['source_unit_id'])
    supplied = values.get('unidade', report.parameter_schema.get('unidade', {}).get('default'))
    if supplied not in (None, '', unit.slug):
        fail('A unidade deve corresponder à origem autorizada deste relatório.')
    kind = values.get('tipo_envio', report.parameter_schema.get('tipo_envio', {}).get('default')) or ''
    if kind not in SEND_TYPES | {''}:
        fail('Tipo de envio inválido.')
    if report.legacy.get('operational_sql_local'):
        from operations.reports import validate_parameters
        dates = {k: str(values[k]) for k in ('start','end') if values.get(k)}
        validate_parameters(dates)
        start, end = dates.get('start'), dates.get('end')
    else:
        start, end = date_range(unit, {k: values[k] for k in ('start', 'end') if k in values})
    return {**values, 'unidade': unit.slug, 'tipo_envio': kind, 'start': start, 'end': end}


def parameter_schema(unit, filters):
    return {
        'unidade': {'type': 'string', 'required': False, 'default': unit.slug, 'label': 'Unidade', 'choices': [{'value': unit.slug, 'label': unit.name}], 'use_default': True, 'order': 1},
        'start': {'type': 'date', 'required': False, 'label': 'Data inicial', 'prompt': 'Informe a data inicial (DD/MM/AAAA). Em branco: início do mês.', 'order': 2},
        'end': {'type': 'date', 'required': False, 'label': 'Data final', 'prompt': 'Informe a data final (DD/MM/AAAA). Em branco: hoje.', 'not_before': 'start', 'order': 3},
        'tipo_envio': {'type': 'string', 'required': False, 'default': filters.get('purpose', ''), 'label': 'Tipo de envio', 'choices': [{'value': '', 'label': 'Todos'}, *[{'value': k, 'label': v} for k, v in SEND_LABELS.items()]], 'use_default': True, 'order': 4},
    }


def view_definitions(unit):
    uid = int(unit.pk)
    def raw(key):
        value = "e.data->" + literal(key)
        return f"CASE WHEN {value} IN ('null'::jsonb, 'false'::jsonb, '0'::jsonb, '\"\"'::jsonb, '[]'::jsonb, '{{}}'::jsonb) THEN NULL ELSE e.data->>{literal(key)} END"
    def data(key, alias=None):
        parts = [raw(key)]
        if alias:
            parts.append(raw(alias))
        parts.append("e.data->'standardized'->>" + literal(alias or key))
        return 'COALESCE(' + ', '.join(parts) + ", '')"
    proc = data('procedure', 'tipo')
    clinic = data('clinic', 'local')
    return {
        'casos': f'''SELECT c.id, c.event_id, c.unit_id, {literal(unit.slug)}::text AS unidade,
          c.purpose AS finalidade, c.outcome AS resultado, e.revision AS revisao,
          e.appointment_id, e.patient AS paciente, e.phone AS telefone,
          e.occurred_at AS data_evento, e.created_at AS data_importacao,
          COALESCE(NULLIF({data('patient_id', 'codigo')}, ''), e.external_id) AS codigo,
          COALESCE(NULLIF({proc}, ''), a.procedure, '') AS procedimento,
          {proc} AS procedimento_informado,
          COALESCE(NULLIF({data('category')}, ''), NULLIF({data('campaign_type')}, ''), {data('type')}) AS categoria,
          COALESCE(NULLIF({clinic}, ''), NULLIF({data('health_unit')}, ''), {data('unidade_saude')}) AS local,
          COALESCE(NULLIF({data('origin_code')}, ''), {data('PARAM20')}) AS codigo_origem,
          COALESCE(a.kind, e.kind) AS tipo_agendamento,
          c.response_state AS resposta_situacao, c.state AS estado, COALESCE(u.username,'') AS responsavel
          FROM public.operations_case c JOIN public.operations_sourceevent e ON e.id=c.event_id AND e.unit_id={uid}
          LEFT JOIN public.scheduling_appointment a ON a.id=e.appointment_id AND a.unit_id={uid}
          LEFT JOIN public.auth_user u ON u.id=c.assignee_id
          WHERE c.unit_id={uid} ''',
        'mensagens': f'''SELECT id, case_id, appointment_id, appointment_revision AS revisao, recipient AS destinatario, state AS situacao, created_at
          FROM public.messaging_message WHERE unit_id={uid}''',
        'respostas': f'''SELECT r.id, r.message_id, r.text AS resposta, r.classification AS classificacao, r.sender AS contato,
          e.occurred_at AS data_resposta, COALESCE(e.data->>'sender_name','') AS respondido_por
          FROM public.responses_reply r JOIN public.messaging_message m ON m.id=r.message_id AND m.unit_id={uid}
          JOIN public.messaging_providerevent e ON e.id=r.event_id WHERE r.unit_id={uid}''',
        'ligacoes': f'''SELECT i.id, i.case_id, i.occurred_at AS data_ligacao, i.outcome AS resultado,
          COALESCE(u.username, 'Sem autor') AS atendente FROM public.operations_interaction i
          JOIN public.operations_case c ON c.id=i.case_id AND c.unit_id={uid}
          LEFT JOIN public.auth_user u ON u.id=i.actor_id WHERE i.kind='call' ''',
        'contatos': f'''SELECT event_id, phone AS telefone FROM public.operations_contact WHERE unit_id={uid}''',
    }


def query_for(metric, unit, filters):
    validate_filters(filters)
    if metric not in METRICS:
        fail('Indicador não permitido.')
    schema = schema_name(unit.pk)
    zone = literal(unit.timezone)
    basis = filters.get('basis', 'event')
    conditions = ["c.unidade=:unidade", "c.finalidade<>'report'", "(COALESCE(:tipo_envio, '')='' OR c.finalidade=:tipo_envio)"]
    if basis == 'response':
        conditions.append(f"EXISTS (SELECT 1 FROM {schema}.mensagens em JOIN {schema}.respostas er ON er.message_id=em.id WHERE em.case_id=c.id AND er.data_resposta>=p.lo AND er.data_resposta<p.hi)")
    elif basis == 'interaction':
        conditions.append(f"EXISTS (SELECT 1 FROM {schema}.ligacoes ec WHERE ec.case_id=c.id AND ec.data_ligacao>=p.lo AND ec.data_ligacao<p.hi)")
    else:
        column = 'data_importacao' if basis == 'created' else 'data_evento'
        conditions.append(f'c.{column}>=p.lo AND c.{column}<p.hi')
    for key, column in [('category', 'categoria'), ('clinic', 'local'), ('origin_code', 'codigo_origem')]:
        if filters.get(key):
            conditions.append(f'c.{column}={literal(filters[key])}')
    if filters.get('procedure_in'):
        conditions.append('c.procedimento IN (' + ','.join(map(literal, filters['procedure_in'])) + ')')
    reply_dates = 'WHERE r.data_resposta>=p.lo AND r.data_resposta<p.hi' if basis == 'response' else ''
    outcome = 'CASE f.resultado ' + ' '.join(f'WHEN {literal(k)} THEN {literal(v)}' for k, v in OUTCOME_LABELS.items()) + ' ELSE f.resultado END'
    from messaging.models import Message
    labels = 'CASE m.situacao ' + ' '.join(f'WHEN {literal(k)} THEN {literal(v)}' for k, v in Message.State.choices) + ' ELSE m.situacao END'
    head = f'''WITH p AS (
 SELECT CAST(:start AS date) AS inicio, CAST(:end AS date) AS fim,
 (CAST(:start AS date)::timestamp AT TIME ZONE {zone}) AS lo,
 ((CAST(:end AS date)+1)::timestamp AT TIME ZONE {zone}) AS hi
), selected AS (
 SELECT c.* FROM {schema}.casos c CROSS JOIN p WHERE {' AND '.join(conditions)}
), mapped_appointments AS (
 SELECT DISTINCT ON (appointment_id) appointment_id,id FROM selected WHERE appointment_id IS NOT NULL ORDER BY appointment_id,data_evento DESC,id DESC
), messages AS (
 SELECT m.*, c.id AS cid, {labels} AS situacao_texto FROM {schema}.mensagens m
 JOIN selected c ON (m.case_id=c.id OR (m.case_id IS NULL AND c.id=(SELECT ma.id FROM mapped_appointments ma WHERE ma.appointment_id=m.appointment_id))) AND m.revisao=c.revisao
), replies AS (
 SELECT r.*, m.cid FROM {schema}.respostas r JOIN messages m ON m.id=r.message_id CROSS JOIN p {reply_dates}
), last_replies AS (
 SELECT * FROM (SELECT r.*, ROW_NUMBER() OVER (PARTITION BY cid ORDER BY data_resposta DESC,id DESC) AS rn FROM replies r) ranked WHERE rn=1
), calls AS (
 SELECT l.* FROM {schema}.ligacoes l JOIN selected c ON c.id=l.case_id CROSS JOIN p WHERE l.data_ligacao>=p.lo AND l.data_ligacao<p.hi
), msgstats AS (
 SELECT cid, BOOL_OR(situacao IN ('accepted','sent','delivered','read')) AS enviado,
 BOOL_OR(situacao IN ('sending','uncertain')) AS em_andamento,
 STRING_AGG(DISTINCT situacao_texto::text COLLATE "C", '; ' ORDER BY situacao_texto::text COLLATE "C") AS entrega FROM messages GROUP BY cid
), phone_values AS (
 SELECT id AS cid, telefone FROM selected UNION SELECT cid, destinatario FROM messages
 UNION SELECT c.id AS cid, co.telefone FROM selected c JOIN {schema}.contatos co ON co.event_id=c.event_id
), phones AS (
 SELECT cid, STRING_AGG(DISTINCT telefone::text COLLATE "C", ', ' ORDER BY telefone::text COLLATE "C") AS telefones FROM phone_values WHERE telefone<>'' GROUP BY cid
), facts AS (
 SELECT c.*, ROW_NUMBER() OVER (ORDER BY c.data_evento,c.id) AS ordem, COALESCE(m.enviado,FALSE) AS enviado, COALESCE(m.em_andamento,FALSE) AS em_andamento,
 COALESCE(m.entrega,'Não executada') AS entrega, r.id IS NOT NULL AS respondido,
 COALESCE(r.resposta,'') AS resposta, COALESCE(r.classificacao,'') AS classificacao, r.data_resposta,
 COALESCE(r.contato,'') AS contato_resposta, COALESCE(r.respondido_por,'') AS respondido_por,
 COALESCE(ph.telefones,'') AS telefones,
 EXISTS (SELECT 1 FROM calls ca WHERE ca.case_id=c.id AND ca.resultado='answered') AS ligado
 FROM selected c LEFT JOIN msgstats m ON m.cid=c.id LEFT JOIN last_replies r ON r.cid=c.id LEFT JOIN phones ph ON ph.cid=c.id
 {'WHERE r.id IS NOT NULL' if basis=='response' else ''}
)
'''
    def cols(expressions):
        return ', '.join(f'{expr} AS "{name}"' for expr, name in zip(expressions, METRICS[metric]))
    def output(expressions, tail):
        return head + 'SELECT ' + cols(expressions) + ' ' + tail
    if metric in {'confirmed', 'not_confirmed', 'not_sent', 'combined', 'absence_detail', 'absence_imported', 'campaign_detail'}:
        where = {'confirmed': "f.resultado='confirmed'", 'not_confirmed': "f.enviado AND f.resultado<>'confirmed'", 'not_sent': 'NOT f.enviado AND NOT f.em_andamento', 'combined': "f.resultado<>'confirmed'", 'absence_detail': 'f.respondido', 'campaign_detail': 'f.respondido', 'absence_imported': 'TRUE'}[metric]
        kind = "CASE f.tipo_agendamento WHEN 'consultation' THEN 'Consulta' WHEN 'exam' THEN 'Exame' WHEN 'lab' THEN 'Laboratório' WHEN 'postprocedure' THEN 'Pós-procedimento' ELSE CASE f.finalidade " + ' '.join(f'WHEN {literal(k)} THEN {literal(v)}' for k, v in __import__('operations.models', fromlist=['Purpose']).Purpose.choices) + ' ELSE f.finalidade END END'
        return output(['f.paciente','f.codigo','f.telefones',kind,'f.procedimento',f"TO_CHAR(f.data_evento AT TIME ZONE {zone}, 'DD/MM/YYYY HH24:MI')",'f.entrega','f.resposta',f"COALESCE(TO_CHAR(f.data_resposta AT TIME ZONE {zone}, 'DD/MM/YYYY HH24:MI'),'')",'f.contato_resposta','f.respondido_por',outcome],f'FROM facts f WHERE {where} ORDER BY f.data_evento,f.id')
    if metric == 'response_counts':
        return output([f"TO_CHAR(r.data_resposta AT TIME ZONE {zone},'YYYY-MM-DD')",'COUNT(*)','COUNT(DISTINCT f.event_id)'], 'FROM replies r JOIN facts f ON f.id=r.cid GROUP BY 1 ORDER BY 1')
    if metric == 'response_stats':
        head += ", outcomes AS (SELECT CASE WHEN respondido THEN COALESCE(NULLIF(resultado,''),NULLIF(classificacao,''),'Resposta livre') ELSE 'Sem resposta WhatsApp' END AS resultado FROM facts)\n"
        label = 'CASE o.resultado ' + ' '.join(f'WHEN {literal(k)} THEN {literal(v)}' for k, v in OUTCOME_LABELS.items()) + ' ELSE o.resultado END'
        return output([label,'COUNT(*)','(SELECT COUNT(*) FROM facts)',f'{schema}.arredondar(COUNT(*)::double precision*100/(SELECT COUNT(*) FROM facts)::double precision)'], 'FROM outcomes o GROUP BY o.resultado ORDER BY o.resultado COLLATE "C"')
    if metric == 'contacted':
        return output(["TO_CHAR(p.inicio,'DD/MM/YYYY') || ' a ' || TO_CHAR(p.fim,'DD/MM/YYYY')",'(SELECT COUNT(*) FROM facts WHERE enviado)','(SELECT COUNT(*) FROM facts WHERE ligado)','(SELECT COUNT(*) FROM facts WHERE enviado OR ligado)'], 'FROM p')
    if metric == 'calls':
        days = f"COUNT(DISTINCT (data_ligacao AT TIME ZONE {zone})::date)"
        return output(['atendente','COUNT(*)',days,f'{schema}.arredondar(COUNT(*)::double precision/{days}::double precision)',"COUNT(*) FILTER (WHERE resultado='answered')","COUNT(*) FILTER (WHERE resultado='not_answered')"], 'FROM calls GROUP BY atendente ORDER BY atendente COLLATE "C"')
    if metric == 'message_management':
        return output(['situacao_texto','COUNT(*)','COUNT(DISTINCT cid)'], 'FROM messages GROUP BY situacao_texto ORDER BY situacao_texto::text COLLATE "C"')
    if metric == 'postoperative_daily':
        return output([f"TO_CHAR(data_importacao AT TIME ZONE {zone},'YYYY-MM-DD')",'COUNT(*)','COUNT(*) FILTER (WHERE enviado)','COUNT(*) FILTER (WHERE NOT enviado)','COUNT(*) FILTER (WHERE enviado AND NOT respondido)','COUNT(*) FILTER (WHERE respondido)'], 'FROM facts GROUP BY 1 ORDER BY 1')
    if metric == 'absence_ranking':
        return output(['resposta','COUNT(*)','(SELECT COUNT(*) FROM facts WHERE respondido)',f'{schema}.arredondar(COUNT(*)::double precision*100/(SELECT COUNT(*) FROM facts WHERE respondido)::double precision)'], 'FROM facts WHERE respondido GROUP BY resposta ORDER BY COUNT(*) DESC, MIN(ordem)')
    proc = "COALESCE(NULLIF(procedimento_informado,''),'Não informado')"
    if metric == 'absence_specialty':
        return output([proc,'resposta','COUNT(*)'], f'FROM facts WHERE respondido GROUP BY 1,2 ORDER BY {proc} COLLATE "C",resposta::text COLLATE "C"')
    if metric == 'absence_distinct':
        return output([proc,'COUNT(DISTINCT resposta)'], 'FROM facts WHERE respondido GROUP BY 1 ORDER BY 1')
    fail('Indicador não implementado.')


def provision(owner, source_unit, admin_password):
    """Create only reporting views/roles; never change permissions on source tables."""
    import hashlib
    from psycopg import sql
    from django.utils import timezone
    from operations.models import ReportConnection
    from operations.report_engine import seal, secret
    from core.models import Audit
    if django_connection.vendor != 'postgresql':
        fail('A fonte SQL operacional requer PostgreSQL.')
    db = django_connection.settings_dict
    role = 'scv_reports_' + str(source_unit.pk) + '_' + hashlib.sha256(str(db['NAME']).encode()).hexdigest()[:8]
    schema = schema_name(source_unit.pk)
    with transaction.atomic():
        django_connection.cursor().execute('SELECT pg_advisory_xact_lock(%s, %s)', [681230, source_unit.pk])
        conn = ReportConnection.objects.filter(unit=owner, options__scv_operational_sql=VERSION, options__source_unit_id=source_unit.pk).first()
        credential_conn = conn or ReportConnection.objects.filter(username=role, options__scv_operational_sql=VERSION, options__source_unit_id=source_unit.pk).first()
        password = secret(credential_conn) if credential_conn else secrets.token_urlsafe(48)
        with django_connection.cursor() as q:
            q.execute('SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname=%s', [role])
            existing = q.fetchone()
            if existing is not None and any(existing):
                fail('A conta de relatórios possui privilégios incompatíveis.')
            if existing is None:
                q.execute(sql.SQL('CREATE ROLE {} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD {}').format(sql.Identifier(role), sql.Literal(password)))
            elif not credential_conn:
                fail('Conta de relatórios existente sem configuração correspondente.')
            q.execute('SELECT COUNT(*) FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.member WHERE r.rolname=%s', [role])
            if q.fetchone()[0]:
                fail('A conta de relatórios não pode herdar outras funções.')
            q.execute(sql.SQL('ALTER ROLE {} SET default_transaction_read_only=on').format(sql.Identifier(role)))
            q.execute(sql.SQL('ALTER ROLE {} SET statement_timeout=30000').format(sql.Identifier(role)))
            q.execute(sql.SQL('ALTER ROLE {} SET search_path=pg_catalog').format(sql.Identifier(role)))
            q.execute(sql.SQL('CREATE SCHEMA IF NOT EXISTS {}').format(sql.Identifier(schema)))
            q.execute(sql.SQL('REVOKE ALL ON SCHEMA {} FROM PUBLIC').format(sql.Identifier(schema)))
            for name, definition in view_definitions(source_unit).items():
                q.execute(sql.SQL('CREATE OR REPLACE VIEW {}.{} WITH (security_barrier=true) AS ').format(sql.Identifier(schema), sql.Identifier(name)) + sql.SQL(definition))
            # Match Python's binary-float round(x, 2), including ties; aggregate-only utility.
            fraction = ' + '.join([f'get_byte(bytes,{i})::numeric * {2 ** ((7-i)*8)}' for i in range(2,8)])
            rounding = f"""CREATE OR REPLACE FUNCTION {{schema}}.arredondar(valor double precision) RETURNS numeric
            LANGUAGE SQL IMMUTABLE STRICT PARALLEL SAFE SET search_path=pg_catalog AS $round$
            WITH b AS (SELECT float8send(abs(valor)) AS bytes),
            bits AS (SELECT ((get_byte(bytes,0) & 127)*16 + (get_byte(bytes,1)>>4)) AS exponent,
              (get_byte(bytes,1) & 15)::numeric*281474976710656 + {fraction} AS fraction FROM b),
            ratio AS (SELECT (fraction + CASE WHEN exponent>0 THEN 4503599627370496 ELSE 0 END)*100
              *CASE WHEN exponent>1075 THEN power(2::numeric,exponent-1075) ELSE 1 END AS n,
              power(2::numeric,CASE WHEN exponent=0 THEN 1074 ELSE greatest(0,1075-exponent) END) AS d FROM bits),
            parts AS (SELECT div(n,d) AS whole, mod(n,d) AS remainder,d FROM ratio)
            SELECT (CASE WHEN valor<0 THEN -1 ELSE 1 END) *
              (whole + CASE WHEN remainder*2>d OR (remainder*2=d AND mod(whole,2)=1) THEN 1 ELSE 0 END)/100
            FROM parts $round$"""
            q.execute(sql.SQL(rounding).format(schema=sql.Identifier(schema)))
            q.execute(sql.SQL('REVOKE ALL ON FUNCTION {}.arredondar(double precision) FROM PUBLIC').format(sql.Identifier(schema)))
            q.execute(sql.SQL('GRANT EXECUTE ON FUNCTION {}.arredondar(double precision) TO {}').format(sql.Identifier(schema),sql.Identifier(role)))
            q.execute(sql.SQL('GRANT USAGE ON SCHEMA {} TO {}').format(sql.Identifier(schema), sql.Identifier(role)))
            for name in VIEW_NAMES:
                q.execute(sql.SQL('GRANT SELECT ON {}.{} TO {}').format(sql.Identifier(schema), sql.Identifier(name), sql.Identifier(role)))
            q.execute("SELECT n.nspname,c.relname,has_table_privilege(%s,c.oid,'SELECT'),has_table_privilege(%s,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p','v','m','f') AND n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%%'", [role, role])
            grants = q.fetchall()
            if any(write or (read and (ns != schema or name not in VIEW_NAMES)) for ns, name, read, write in grants):
                fail('A conta possui acesso adicional às visões autorizadas.')
        if conn is None:
            conn = ReportConnection.objects.create(unit=owner, name='SCV · PostgreSQL · ' + source_unit.name, engine='postgres', host=db.get('HOST') or 'db', port=int(db.get('PORT') or 5432), database=str(db['NAME']), username=role, ciphertext=seal(password, admin_password), timeout_seconds=30, max_rows=10000, enabled=True, validated=False, options={'scv_operational_sql': VERSION, 'source_unit_id': source_unit.pk, 'source_unit_slug': source_unit.slug, 'schema': schema}, legacy={'source_description': 'Dados operacionais do SCV. Visões isoladas da unidade ' + source_unit.name + '; conta somente de leitura.'})
            Audit.objects.create(unit=owner, action='report.sql_connection_created', object_id=str(conn.pk), details={'source_unit': source_unit.slug, 'views': sorted(VIEW_NAMES), 'sends': False})
    # A new login becomes visible only after the transaction commits.
    from operations.report_engine import connect
    with connect(conn) as session:
        q = session.cursor()
        q.execute('SELECT current_user, current_setting(\'transaction_read_only\')')
        username, readonly = q.fetchone()
        if username != role or readonly != 'on':
            fail('A conexão de relatórios não está em modo somente de leitura.')
        q.execute('SELECT COUNT(*) FROM ' + schema + '.casos')
        q.fetchone()
    conn.validated = True
    conn.checked_at = timezone.now()
    conn.save(update_fields=['validated', 'checked_at'])
    return conn


def migrate_reports(admin_password):
    from operations.models import ReportDefinition
    from operations.report_engine import run_query
    from operations.app_reporting import local_data
    from core.models import Audit
    from django.utils import timezone
    targets = list(ReportDefinition.objects.filter(source='app', handler='app_operational_v1').select_related('unit','app_connection__local_unit'))
    if any(not r.app_connection_id or r.app_connection.mode != 'local' for r in targets):
        fail('Existem origens remotas; migração automática não permitida para elas.')
    connections = {}
    for report in targets:
        key = (report.unit_id, report.app_connection.local_unit_id)
        if key not in connections:
            connections[key] = provision(report.unit, report.app_connection.local_unit, admin_password)
    prepared = []
    for report in targets:
        unit = report.app_connection.local_unit
        config = report.legacy['app_report']
        draft = copy.copy(report)
        draft.source = 'sql'
        draft.handler = ''
        draft.connection = connections[(report.unit_id, unit.pk)]
        draft.parameter_schema = parameter_schema(unit, config['filters'])
        draft.query_sql = query_for(config['metric'], unit, config['filters'])
        validate_sql(draft.query_sql, draft.connection)
        # Compare 30 days and current-month output without producing/sending messages.
        today = timezone.localtime(timezone.now(), ZoneInfo(unit.timezone)).date()
        for start in {today.replace(day=1), today-timedelta(days=29)}:
            values = {'start': start.isoformat(), 'end': today.isoformat()}
            before_cols, before_rows = local_data(unit, config['metric'], values, config['filters'])
            after_cols, after_rows = run_query(draft, values, typed=True)
            def canonical(rows):
                from decimal import Decimal
                return [[float(v) if isinstance(v, Decimal) else v for v in row] for row in rows]
            if before_cols != after_cols or canonical(before_rows) != canonical(after_rows):
                fail('Divergência na conversão SQL de ' + report.code + '. Migração não aplicada.')
        prepared.append((report, draft))
    migrated_ids = {r.pk for r, _ in prepared}
    with transaction.atomic():
        for report, draft in prepared:
            current = ReportDefinition.objects.select_for_update().get(pk=report.pk)
            if current.version != report.version:
                fail('Relatório alterado durante a migração: ' + report.code)
            old = {field: copy.deepcopy(getattr(current, field)) for field in ['source','handler','connection_id','app_connection_id','query_sql','parameter_schema','canvas_layout','version','legacy']}
            current.legacy = {**current.legacy, 'operational_sql_migration': {'version': VERSION, 'previous': old, 'source_unit': report.app_connection.local_unit.slug, 'date': today.isoformat()}}
            if not current.legacy.get('report_category'):
                current.legacy['report_category'] = SEND_LABELS.get(report.legacy['app_report']['filters'].get('purpose'), 'Operacional')
            current.legacy['source_path'] = 'PostgreSQL SCV · ' + report.app_connection.local_unit.name + ' → visões isoladas ' + schema_name(report.app_connection.local_unit_id) + ' → consulta SQL cadastrada → Canvas'
            current.source = 'sql'
            current.handler = ''
            current.connection = draft.connection
            current.app_connection = None
            current.query_sql = draft.query_sql
            current.parameter_schema = draft.parameter_schema
            current.canvas_layout = copy.deepcopy(current.canvas_layout)
            for src in current.canvas_layout.get('sources', []):
                if src.get('type') == 'report' and src.get('report_id') in migrated_ids:
                    src.pop('dataset', None)
            current.version += 1
            current.save()
            Audit.objects.create(unit=current.unit, action='report.operational_sql_migrated', object_id=str(current.pk), details={'code':current.code,'source_unit':draft.connection.options['source_unit_slug'],'parity_periods':2,'sends':False})
        # Compositions retain their pages and mappings; SQL sources have no native dataset key.
        for parent in ReportDefinition.objects.exclude(pk__in=migrated_ids).exclude(canvas_layout={}):
            layout = copy.deepcopy(parent.canvas_layout)
            changed = False
            for src in layout.get('sources', []):
                if src.get('type') == 'report' and src.get('report_id') in migrated_ids and 'dataset' in src:
                    src.pop('dataset', None)
                    changed = True
            if changed:
                refs = {src.get('report_id') for src in layout.get('sources', []) if src.get('type') == 'report'}
                parent.legacy = {**parent.legacy, 'operational_sql_composition': {'previous': {'canvas_layout': copy.deepcopy(parent.canvas_layout), 'parameter_schema': copy.deepcopy(parent.parameter_schema), 'version': parent.version}}}
                if refs and refs <= migrated_ids:
                    parts = [original for original, _ in prepared if original.pk in refs]
                    source_units = {part.app_connection.local_unit_id for part in parts}
                    types = {part.legacy['app_report']['filters'].get('purpose', '') for part in parts}
                    if len(types) == 1:
                        parent.parameter_schema = {**parent.parameter_schema, **parameter_schema(parts[0].app_connection.local_unit, {'purpose': next(iter(types))})}
                        if len(source_units) > 1:
                            parent.parameter_schema['unidade'].update(default='_origens', choices=[{'value':'_origens','label':'Unidades da composição'}])
                    if not parent.legacy.get('report_category'):
                        parent.legacy['report_category'] = SEND_LABELS.get(next(iter(types)) if len(types) == 1 else '', 'Operacional')
                parent.canvas_layout = layout
                parent.version += 1
                parent.save(update_fields=['canvas_layout','parameter_schema','legacy','version'])
                Audit.objects.create(unit=parent.unit, action='report.sql_canvas_sources_migrated', object_id=str(parent.pk), details={'sends':False})
    return {'migrated': len(prepared), 'connections':len(connections), 'ids':sorted(migrated_ids)}
