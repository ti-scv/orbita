import re
from operations.report_engine import connect


def parse_table_identifier(raw_name: str) -> tuple[str | None, str]:
    cleaned = raw_name.strip().upper()
    cleaned = re.sub(r'[^A-Z0-9_.]', '', cleaned)
    if "." in cleaned:
        parts = cleaned.split(".", 1)
        return parts[0], parts[1]
    return None, cleaned


def inspect_table_columns(connection, table_name: str) -> list[dict]:
    owner, name = parse_table_identifier(table_name)
    if not name:
        return []

    with connect(connection) as conn:
        cursor = conn.cursor()
        if connection.engine == "oracle":
            if owner:
                query = """
                    SELECT column_name, data_type, data_length, nullable
                    FROM all_tab_columns
                    WHERE owner = :owner AND table_name = :tname
                    ORDER BY column_id
                """
                cursor.execute(query, {"owner": owner, "tname": name})
            else:
                query = """
                    SELECT column_name, data_type, data_length, nullable
                    FROM all_tab_columns
                    WHERE table_name = :tname
                    ORDER BY column_id
                """
                cursor.execute(query, {"tname": name})

            rows = cursor.fetchall()
            return [
                {
                    "name": str(r[0]),
                    "type": str(r[1]),
                    "length": r[2],
                    "nullable": r[3] == "Y",
                }
                for r in rows
            ]
        elif connection.engine == "postgres":
            schema = owner or "public"
            query = """
                SELECT column_name, data_type, character_maximum_length, is_nullable
                FROM information_schema.columns
                WHERE table_schema = %s AND table_name = %s
                ORDER BY ordinal_position
            """
            cursor.execute(query, [schema.lower(), name.lower()])
            rows = cursor.fetchall()
            return [
                {
                    "name": str(r[0]),
                    "type": str(r[1]),
                    "length": r[2],
                    "nullable": r[3] == "YES",
                }
                for r in rows
            ]
        else:
            return []


def fetch_survey_candidates(automation, specific_attendance_id=None, limit=None) -> list[dict]:
    connection = automation.connection
    if not connection:
        return []

    mapping = automation.column_mapping or {}
    id_col = mapping.get("id_column") or "ID"
    att_col = mapping.get("attendance_column") or "CD_ATENDIMENTO"
    name_col = mapping.get("patient_name_column") or "NM_PACIENTE"
    phone_col = mapping.get("phone_column") or "NR_CELULAR"
    status_col = mapping.get("status_column") or "SN_ENVIADO"
    dt_alta_col = mapping.get("attendance_date_column") or "DT_ALTA_MEDICA"

    cols = [id_col, att_col, name_col, phone_col, dt_alta_col]
    if status_col:
        cols.append(status_col)

    # Sanitize table name
    table = automation.table_name.strip()
    owner, name = parse_table_identifier(table)
    full_table = f"{owner}.{name}" if owner else name

    binds = {}
    where_clauses = []

    if specific_attendance_id:
        where_clauses.append(f"{att_col} = :spec_att")
        binds["spec_att"] = str(specific_attendance_id).strip()
    else:
        if status_col:
            where_clauses.append(f"({status_col} = 'N' OR {status_col} IS NULL)")
        if dt_alta_col:
            period = getattr(automation, "discharge_period", "previous_day") or "previous_day"
            is_oracle = getattr(connection, "engine", "oracle") == "oracle"
            if period == "previous_day":
                # Altas do dia anterior (D-1): entre 00:00:00 e 23:59:59 de ontem
                if is_oracle:
                    where_clauses.append(f"{dt_alta_col} >= TRUNC(SYSDATE - 1) AND {dt_alta_col} < TRUNC(SYSDATE)")
                else:
                    where_clauses.append(f"{dt_alta_col} >= CURRENT_DATE - INTERVAL '1 day' AND {dt_alta_col} < CURRENT_DATE")
            elif period == "same_day":
                # Altas do dia atual (D-0): a partir de 00:00:00 de hoje
                if is_oracle:
                    where_clauses.append(f"{dt_alta_col} >= TRUNC(SYSDATE) AND {dt_alta_col} < TRUNC(SYSDATE + 1)")
                else:
                    where_clauses.append(f"{dt_alta_col} >= CURRENT_DATE AND {dt_alta_col} < CURRENT_DATE + INTERVAL '1 day'")
            else:
                lookback = max(1, int(automation.lookback_hours or 48))
                if is_oracle:
                    where_clauses.append(f"{dt_alta_col} >= SYSDATE - :lookback / 24")
                    binds["lookback"] = lookback
                else:
                    where_clauses.append(f"{dt_alta_col} >= NOW() - INTERVAL '{lookback} hours'")

    where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""
    select_cols = ", ".join(f'"{c.strip().upper()}"' if not re.match(r'^[A-Za-z0-9_]+$', c) else c.strip() for c in cols)

    limit_val = limit or automation.batch_limit or 500

    with connect(connection) as conn:
        cursor = conn.cursor()
        sql = f"""
            SELECT * FROM (
                SELECT {select_cols}
                FROM {full_table}
                {where_sql}
                ORDER BY {id_col} ASC
            ) WHERE ROWNUM <= :max_rows
        """
        binds["max_rows"] = limit_val
        cursor.execute(sql, binds)
        rows = cursor.fetchall()

    results = []
    for r in rows:
        results.append({
            "record_id": str(r[0]) if r[0] is not None else "",
            "attendance_id": str(r[1]) if r[1] is not None else "",
            "patient_name": str(r[2]) if r[2] is not None else "",
            "phone": str(r[3]) if r[3] is not None else "",
            "attendance_date": r[4].isoformat() if hasattr(r[4], "isoformat") else str(r[4] or ""),
            "status": str(r[5]) if len(r) > 5 and r[5] is not None else "N",
        })
    return results
