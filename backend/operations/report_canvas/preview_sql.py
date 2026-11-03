"""Equivalent rewrite of the known operational messages join, preview only."""
OLD_JOIN = "JOIN selected c ON (m.case_id=c.id OR (m.case_id IS NULL AND c.id=(SELECT ma.id FROM mapped_appointments ma WHERE ma.appointment_id=m.appointment_id))) AND m.revisao=c.revisao"


def optimize(sql):
    # The generated mapping is unique; the two branches are disjoint by case_id.
    marker = "), messages AS (\n "
    unique = "SELECT DISTINCT ON (appointment_id) appointment_id,id FROM selected WHERE appointment_id IS NOT NULL ORDER BY appointment_id,data_evento DESC,id DESC"
    if unique not in sql or marker not in sql or sql.count(OLD_JOIN) != 1:
        return sql
    # Check the actual CTE, rather than accepting the expected text in a comment.
    import sqlglot
    from sqlglot import exp
    tree = sqlglot.parse_one(sql, read="postgres")
    mappings = [cte.this for cte in tree.find_all(exp.CTE) if cte.alias_or_name == "mapped_appointments"]
    if len(mappings) != 1 or mappings[0] != sqlglot.parse_one(unique, read="postgres"):
        return sql
    start = sql.index(marker) + len(marker)
    end = sql.index(OLD_JOIN)
    if end <= start:
        return sql
    prefix = sql[start:end]
    if not prefix.lstrip().startswith("SELECT m.*, c.id AS cid,") or "SELECT" in prefix[7:]:
        return sql
    direct = "JOIN selected c ON m.case_id=c.id AND m.revisao=c.revisao"
    fallback = "JOIN mapped_appointments ma ON ma.appointment_id=m.appointment_id JOIN selected c ON c.id=ma.id AND m.revisao=c.revisao WHERE m.case_id IS NULL"
    return sql[:end] + direct + "\n UNION ALL\n " + prefix + fallback + sql[end + len(OLD_JOIN):]
