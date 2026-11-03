"""Metadados de origem sem executar consultas nem retornar credenciais."""
from operations.report_removal_compat import active_conditions

import re
from rest_framework.response import Response
from operations.models import ReportDefinition
from .schema import default_layout, validate_layout, fail

def column_origin(view, request):
    from .api import context_report
    owner = context_report(view, request)
    source = request.data.get("source")
    layout = default_layout()
    layout["sources"] = [source]
    validate_layout(layout)
    column = request.data.get("column")
    if not isinstance(column, str) or not column or len(column) > 100: fail("Coluna inválida.")
    name = source.get("label") or source["id"]
    if source["type"] == "inline":
        return Response({"source": name, "column": column, "database": "Dados manuais do relatório", "query": "", "expression": "Valor informado na tabela manual"})
    if source["type"] == "goals":
        return Response({"source": name, "column": column, "database": "Cadastro de metas do relatório no Orbita", "query": "", "expression": "Campo de meta mensal: " + column})
    child = ReportDefinition.objects.filter(pk=source["report_id"], unit=owner.unit, **active_conditions()).select_related("connection").first()
    if not child: fail("Fonte de outra unidade ou não encontrada.")
    from .native import datasets
    if datasets(child):
        return Response({"source": name, "report": child.name, "column": column, "database": "Definida pela rotina nativa; pode combinar bancos", "query": "", "expression": "Dados preparados pelo relatório de origem."})
    query = child.query_sql if child.source == "sql" else ""
    connection = child.connection if child.connection_id else None
    if connection:
        from operations.report_engine import secret
        try: password = secret(connection)
        except Exception: password = ""
        for value in (password, connection.ciphertext):
            if value: query = query.replace(str(value), "[credencial omitida]")
    query = re.sub(r"[a-zA-Z][a-zA-Z0-9+.-]*://[^\s'\"]+", "[conexão omitida]", query)
    query = re.sub(r"(?i)\b(?:password|passwd|pwd|dsn)\s*=\s*(?:'[^']*'|\"[^\"]*\"|[^\s;,]+)", "[credencial omitida]", query)
    engines = {"postgres":"PostgreSQL", "oracle":"Oracle", "mysql":"MySQL", "sqlite":"SQLite", "firebird":"Firebird"}
    database = (engines.get(connection.engine, connection.engine) + " · " + connection.name) if connection else "Banco não informado pela fonte"
    return Response({"source": name, "report": child.name, "column": column, "database": database, "query": query, "expression": "" if query else "Expressão não disponível para esta fonte"})
