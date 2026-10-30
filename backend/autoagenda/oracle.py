"""Oracle adapter: every browse request is read-only; booking is explicitly gated."""
from contextlib import contextmanager
from django.utils import timezone
from core.oracle_credentials import connect
from .queries import QUERIES
from .security import unseal


class SourceError(Exception):
    def __init__(self, code="oracle_unavailable"):
        self.code = code


def error_code(exc):
    import re
    found = re.search(r"(?:ORA|DPY|DPI)-[0-9]+", str(exc))
    return found.group(0) if found else "oracle_unavailable"


class Oracle:
    def __init__(self, config):
        self.config = config

    @contextmanager
    def connection(self, write=False):
        c = self.config
        payload = {"host": c.oracle_host, "port": c.oracle_port, "identifier_type":"sid",
                   "identifier":c.oracle_sid, "username":c.oracle_user,
                   "password":unseal(c.password_ciphertext).get("password", ""), "timeout_ms":20000}
        con = None
        try:
            con = connect(payload)
            with con.cursor() as cur:
                cur.execute("ALTER SESSION SET NLS_DATE_FORMAT = 'DD/MM/RRRR'")
                if not write:
                    cur.execute("SET TRANSACTION READ ONLY")
            yield con
        except SourceError:
            raise
        except Exception as exc:
            raise SourceError(error_code(exc)) from None
        finally:
            if con:
                try: con.rollback()
                finally: con.close()

    def query(self, sql, binds=None, limit=1000, connection=None):
        def run(con):
            with con.cursor() as cur:
                cur.execute(sql, binds or {})
                columns = [v[0] for v in cur.description]
                rows = cur.fetchmany(limit + 1)
                if len(rows) > limit:
                    raise SourceError("source_rows_limit")
                return [dict(zip(columns,row)) for row in rows]
        if connection is not None:
            return run(connection)
        with self.connection() as con:
            return run(con)

    def check(self):
        with self.connection() as con:
            identity = self.query("SELECT SYS_CONTEXT('USERENV','DB_NAME') DB_NAME, SYS_CONTEXT('USERENV','INSTANCE_NAME') INSTANCE_NAME FROM dual", connection=con)[0]
            for i in range(1,7):
                self.query(f"SELECT * FROM DBAMV.VDIC_AUTO_AGENDA_SAN_{i:03d} WHERE 1=0", connection=con)
            return identity

    def beneficiaries(self, cpf): return self.query(QUERIES['beneficiariosPorCpf'], {'cpf':cpf})
    def beneficiary(self, matricula):
        rows = self.query(QUERIES['beneficiario'], {'mat':matricula})
        return rows[0] if rows else None
    def specialties(self, age):
        from django.core.cache import cache
        # Only specialty descriptions/age ranges are cached; never patient records.
        key=f'autoagenda:specialties:{self.config.unit_id}:{self.config.pk}:{self.config.version}'
        rows=cache.get(key)
        if rows is None:
            with self.connection() as con:
                con.call_timeout=60000
                rows=self.query(QUERIES['consultarEspecialidades'],connection=con)
            cache.set(key,rows,1800)
        values = {str(r['CD_ESPECIALID']):r for r in rows if age is not None and int(r['IDADE_DE']) <= int(age) <= int(r['IDADE_ATE'])}
        return sorted(values.values(),key=lambda r:r['DS_ESPECIALID'])
    def providers(self, specialty, age): return self.query(QUERIES['prestadores'], {'esp':specialty,'idade':age})
    def existing(self, specialty, patient):
        rows = self.query("SELECT * FROM ("+QUERIES['agendamentoExistente']+") WHERE ROWNUM <= 1", {'esp':specialty,'pac':patient})
        return rows[0] if rows else None
    def future(self, patient):
        rows = self.query(QUERIES['agendamentosFuturos'],{'pac':patient})
        for row in rows: row['DH_AGENDA'] = row['DH_AGENDA_TXT']
        return rows
    def next_consultation(self, matricula, specialty, provider, patient):
        row = self.query(QUERIES['proximaConsulta'],{'mat':matricula,'esp':specialty,'prest':provider,'pac':patient})[0]
        return row['DT_PROXIMA_CONSULTA'] if int(row['RETORNO']) == 1 else None
    def dates(self, specialty, provider, next_date):
        base = "FROM dbamv.vdic_auto_agenda_san_003 v3 WHERE v3.qt_agenda_tm > v3.qt_agendados_tm AND v3.cd_prestador=:prest AND v3.cd_especialid=:esp"
        binds = {'prest':provider,'esp':specialty}
        if next_date:
            binds['dtprox'] = next_date
            date_sql = "SELECT DISTINCT TRUNC(v3.dt_agenda) dt,v3.cd_tip_mar "+base+" AND TRUNC(v3.dt_agenda) BETWEEN TRUNC(SYSDATE+1) AND TO_DATE(:dtprox,'DD/MM/YYYY')-1 AND v3.cd_tip_mar=2 UNION ALL SELECT DISTINCT TRUNC(v3.dt_agenda) dt,v3.cd_tip_mar "+base+" AND TRUNC(v3.dt_agenda)>=TO_DATE(:dtprox,'DD/MM/YYYY') AND v3.cd_tip_mar=1"
        else:
            date_sql = "SELECT DISTINCT TRUNC(v3.dt_agenda) dt,v3.cd_tip_mar "+base+" AND TRUNC(v3.dt_agenda)>=TRUNC(SYSDATE+1) AND v3.cd_tip_mar=1"
        return self.query("SELECT TO_CHAR(d.dt,'DD/MM/YYYY') DT_AGENDA,d.cd_tip_mar FROM ("+date_sql+") d ORDER BY d.dt",binds)
    def slots(self, specialty, provider, kind, day):
        rows = self.query(QUERIES['horarios'],{'esp':specialty,'prest':provider,'tip':kind,'data':day})
        return list({r['HR_AGENDA']:r for r in reversed(rows)}.values())[::-1]
    def confirmed(self, slot, patient, connection=None):
        return int(self.query(QUERIES['agendamentoConfirmado'],{'pac':patient,'prest':slot['CD_PRESTADOR'],'dh':slot['DH_AGENDA']},connection=connection)[0]['QTD']) > 0
    def book(self, slot, beneficiary, phone):
        c = self.config
        if not c.enabled or not c.booking_enabled or not c.validated:
            raise SourceError("booking_disabled")
        fields = {'p_cd_agenda_central':slot['CD_AGENDA_CENTRAL'], 'p_cd_it_agenda_central':slot['CD_IT_AGENDA_CENTRAL'],
                  'p_cd_paciente':beneficiary['CD_PACIENTE_MV'], 'p_dh_agenda':slot['DH_AGENDA'],
                  'p_cd_item_agendamento':slot['CD_ITEM_AGENDAMENTO'], 'p_cd_convenio':c.agreement,
                  'p_cd_plano':beneficiary['CD_PLANO'], 'p_cd_unidade_atendimento':slot['CD_UNIDADE_ATENDIMENTO'],
                  'p_cd_tipo_marcacao':slot['CD_TIP_MAR'], 'p_cd_setor':slot['CD_SETOR'],
                  'p_cd_servico':slot['CD_SERVICO'], 'p_cd_prestador':slot['CD_PRESTADOR'],
                  'p_usuario':c.booking_user, 'p_tempo_consulta':slot['TEMPO_CONSULTA'], 'p_celular_agendamento':phone}
        binds = {k:v for k,v in fields.items()}
        args = ','.join(k+" => "+("TO_DATE(:"+k+",'DD/MM/YYYY HH24:MI:SS')" if k=='p_dh_agenda' else ':'+k) for k in fields)
        with self.connection(write=True) as con:
            # Recheck identity/eligibility/slot immediately before any write.
            current = self.query(QUERIES['beneficiario'],{'mat':beneficiary['CD_MATRICULA']},connection=con)
            if not current or str(current[0]['CD_PACIENTE_MV']) != str(beneficiary['CD_PACIENTE_MV']) or str(current[0]['ELEGIBILIDADE']).strip() != '#OK#':
                raise SourceError('eligibility_changed')
            available = self.query("SELECT CD_IT_AGENDA_CENTRAL FROM DBAMV.VDIC_AUTO_AGENDA_SAN_003 WHERE CD_IT_AGENDA_CENTRAL=:slot AND CD_PRESTADOR=:provider AND QT_AGENDA_TM>QT_AGENDADOS_TM AND DH_AGENDA=TO_DATE(:dh,'DD/MM/YYYY HH24:MI:SS')",{'slot':slot['CD_IT_AGENDA_CENTRAL'],'provider':slot['CD_PRESTADOR'],'dh':slot['DH_AGENDA']},connection=con)
            if not available: raise SourceError('slot_unavailable')
            with con.cursor() as cur: cur.execute('BEGIN DBAMV.RF_PRC_AUTO_AGENDA_AGENDAR('+args+'); END;',binds)
            if not self.confirmed(slot,beneficiary['CD_PACIENTE_MV'],connection=con):
                raise SourceError('booking_unverified')
            con.commit()
