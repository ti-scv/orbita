"""Derive reliable SQL output names for the Canvas without executing the query."""
from functools import lru_cache


@lru_cache(maxsize=256)
def _columns(sql, engine):
    import sqlglot
    from sqlglot import exp

    if not isinstance(sql, str) or not sql.strip() or len(sql) > 100000:
        return ()
    try:
        dialect = {'postgres': 'postgres', 'oracle': 'oracle', 'mysql': 'mysql', 'sqlite': 'sqlite'}.get(engine)
        trees = sqlglot.parse(sql, read=dialect)
        if len(trees) != 1 or not isinstance(trees[0], (exp.Select, exp.Union, exp.Intersect, exp.Except)):
            return ()
        def selections_for(tree, inherited=None, depth=0):
            if depth > 12:
                return None
            if isinstance(tree, (exp.Union, exp.Intersect, exp.Except)):
                return selections_for(tree.this, inherited, depth + 1)
            if not isinstance(tree, exp.Select):
                return None
            ctes = dict(inherited or {})
            with_clause = tree.args.get('with') or tree.args.get('with_')
            if with_clause:
                ctes.update({c.alias_or_name.upper(): c.this for c in with_clause.expressions})
            selections = tree.selects
            # Expand only a single star over one known subquery or CTE; a base
            # table, join or wildcard modifiers require the live preview instead.
            if len(selections) == 1 and isinstance(selections[0], exp.Star):
                star = selections[0]
                if any(star.args.values()) or tree.args.get('joins'):
                    return None
                source = tree.args.get('from') or tree.args.get('from_')
                origin = source.this if source else None
                if isinstance(origin, exp.Subquery):
                    return selections_for(origin.this, ctes, depth + 1)
                if isinstance(origin, exp.Table) and not origin.db and not origin.catalog:
                    target = ctes.get(origin.name.upper())
                    if target is not None:
                        return selections_for(target, ctes, depth + 1)
                return None
            return selections

        selections = selections_for(trees[0])
        if not selections or not 1 <= len(selections) <= 100:
            return ()
        result = []
        for item in selections:
            # Never guess names for wildcards or unnamed expressions. A preview
            # can discover those at runtime if the source is available.
            identifier = item.args.get('alias') if isinstance(item, exp.Alias) else item.this if isinstance(item, exp.Column) else None
            if not isinstance(identifier, exp.Identifier):
                return ()
            name = identifier.this
            if not isinstance(name, str) or not name or len(name) > 100:
                return ()
            if not identifier.args.get('quoted'):
                if engine == 'postgres':
                    name = name.translate(str.maketrans('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'))
                elif engine in {'oracle', 'firebird'}:
                    name = name.translate(str.maketrans('abcdefghijklmnopqrstuvwxyz', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'))
            if engine == 'postgres' and len(name.encode('utf-8')) > 63:
                return ()
            if name in result:
                return ()
            result.append(name)
        return tuple(result)
    except Exception:  # Invalid or unsupported syntax is left to the SQL preview.
        return ()


def query_columns(sql, engine):
    return list(_columns(sql, engine))
