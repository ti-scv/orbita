"""Edição explícita de declarações; nenhuma consulta é reescrita."""
import copy
import json
import re
import unicodedata
from pathlib import Path
from functools import lru_cache
from .schema import fail
from operations.report_parameters import _references

@lru_cache(maxsize=1)
def snapshot():
    return json.loads(Path(__file__).with_name("parameter_audit.json").read_text())

def declarations(report):
    records = report.legacy.get("parameters", [])
    names = list(dict.fromkeys([*report.parameter_schema, *[str(r.get("NOME", "")) for r in records]]))
    audit = snapshot().get(str(report.pk), {})
    current = audit.get("version") == report.version
    bindings, _ = _references(report.query_sql)
    def norm(name):
        return re.sub(r"[^a-z0-9]", "", unicodedata.normalize("NFKD", name.lower()).encode("ascii", "ignore").decode())
    items = []
    for name in names:
        uses = []
        if name in report.parameter_schema: uses.append("Contrato da API (validação e repasse)")
        if name in bindings: uses.append("Consulta atual: :" + name)
        for source in report.canvas_layout.get("sources", []):
            for key, value in source.get("parameters", {}).items():
                if value == {"parameter": name} or (key == name and name in report.parameter_schema):
                    uses.append("Fonte " + source.get("label", source["id"]) + ": " + key)
        for page in report.canvas_layout.get("pages", []):
            for block in page.get("blocks", []):
                if re.search(r"{{\s*" + re.escape(name) + r"\s*}}", block.get("text", "")):
                    uses.append("Bloco " + block.get("title", block["id"]))
        evidence = audit.get("items", {}).get(name, {}) if current else {}
        suggestion = evidence.get("suggestion", "")
        if evidence.get("uses") and not uses: uses.append(evidence["uses"])
        duplicate = sum(norm(n) == norm(name) for n in names) > 1 or sum(r.get("NOME") == name for r in records) > 1
        status = "Duplicado" if duplicate else ("Nome parecido com " + suggestion if suggestion and not uses else "Usado" if uses else "Não usado")
        items.append({"name": name, "status": status, "uses": uses, "suggestion": suggestion if name not in report.parameter_schema else "", "historical": name not in report.parameter_schema})
    return items

def apply_edits(report, edits):
    if not isinstance(edits, list) or len(edits) > 200: fail("Alterações de parâmetros inválidas.")
    schema = copy.deepcopy(report.parameter_schema)
    legacy = copy.deepcopy(report.legacy)
    for edit in edits:
        if not isinstance(edit, dict) or set(edit) - {"name", "rename"}: fail("Alteração de parâmetro inválida.")
        name = edit.get("name")
        records = legacy.get("parameters", [])
        if name not in schema and not any(r.get("NOME") == name for r in records): fail("Parâmetro não encontrado: " + str(name))
        target = edit.get("rename")
        if target is not None:
            # Suggestions concern historical names only. Current contracts need a separate migration.
            allowed = next((i["suggestion"] for i in declarations(report) if i["name"] == name), "")
            if name in schema or not target or target != allowed: fail("Sugestão de renomeação indisponível; recarregue a auditoria.")
            if any(r.get("NOME") == target for r in records): fail("Já existe declaração legada com esse nome.")
            for record in records:
                if record.get("NOME") == name: record["NOME"] = target
        else:
            schema.pop(name, None)
            legacy["parameters"] = [r for r in records if r.get("NOME") != name]
    report.parameter_schema, report.legacy = schema, legacy
