"""Inventário somente leitura do lote 2."""
import json
import time
from pathlib import Path
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from operations.models import ReportDefinition

IDS = {31:18,32:19,35:23,36:24,37:25,52:42,61:51,62:52,64:54,68:58,72:62,73:63,74:64,75:65,78:68}

def blocker(pk):
    if pk in {31,32,35,36,37}:
        return "Faltam rateio G4, capacidade histórica/vigências aceitas, janelas e amostra aceita."
    if pk in {52,61,62}:
        return "Substituição no Canvas 63 existente; falta aceite da separação dos ramos 1/4/2 e amostra aceita por saída."
    if pk in {68,72,74,75}:
        return "Faltam reconciliação de janelas, denominadores, arredondamentos e amostra aceita."
    return "Faltam ramo por especialidade, seleção/ordem, nulos e amostra aceita; aceite médico só em homologação."

def inventory():
    started = time.monotonic()
    with transaction.atomic():
        with connection.cursor() as cursor:
            cursor.execute("SET TRANSACTION READ ONLY")
        reports = list(ReportDefinition.objects.filter(pk__in=IDS).select_related("connection").order_by("pk"))
        if {r.pk for r in reports} != set(IDS):
            raise CommandError("Inventário incompleto.")
        rows = []
        for r in reports:
            if r.code != f"legacy123-{IDS[r.pk]}" or r.unit_id != 2:
                raise CommandError(f"Identidade divergente: {r.pk}")
            rows.append({
                "id": r.pk, "legacy_id": IDS[r.pk], "name": r.name,
                "procedure": r.legacy.get("record", {}).get("PROCEDIMENTO", ""),
                "parameters": [{"nome": p.get("NOME"), "valor": p.get("CONTEUDO")} for p in r.legacy.get("parameters", [])],
                "status": "PENDENTE", "reason": blocker(r.pk),
                "connection_id": r.connection_id,
                "connection_enabled": bool(r.connection and r.connection.enabled),
                "connection_validated": bool(r.connection and r.connection.validated),
                "has_sql": bool(r.query_sql.strip()), "has_canvas": bool(r.canvas_layout),
                "enabled": r.enabled, "reviewed": r.reviewed, "canvas_enabled": r.canvas_enabled,
                "version": r.version, "link": f"/relatorios/{r.pk}/canvas?unit=scv",
                "oracle_read_seconds": None,
            })
    return {"mode": "dry_run", "reports": rows, "created_ids": [], "changed_ids": [],
            "writes": False, "sends": False, "metadata_seconds": round(time.monotonic()-started, 6),
            "reversal": "Sem alterações; nenhuma reversão necessária."}

class Command(BaseCommand):
    help = "Audita 15 procedimentos sem escrita, consulta clínica ou envio."
    def add_arguments(self, parser):
        parser.add_argument("--output", required=True)
    def handle(self, *args, **options):
        result = inventory()
        output = Path(options["output"])
        output.write_text(json.dumps(result, ensure_ascii=False, indent=2))
        output.chmod(0o600)
        self.stdout.write("15 pendentes; 0 criados; 0 alterações; 0 envios.")
