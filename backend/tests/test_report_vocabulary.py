"""Prevent internal terminology from returning in reporting API messages."""
import ast
import re
from pathlib import Path


def test_reporting_messages_use_user_vocabulary():
    operations = Path(__file__).resolve().parents[1] / "operations"
    failures = []
    for path in [*operations.joinpath("report_canvas").glob("*.py"), operations / "reporting.py"]:
        tree = ast.parse(path.read_text())
        parents = {child: node for node in ast.walk(tree) for child in ast.iter_child_nodes(node)}
        for node in ast.walk(tree):
            if not isinstance(node, ast.Constant) or not isinstance(node.value, str):
                continue
            text = node.value
            parent = parents.get(node)
            if isinstance(parent, ast.Expr):  # docstrings
                continue
            if isinstance(parent, ast.Call) and isinstance(parent.func, ast.Attribute) and parent.func.attr in {"warning", "info", "exception", "debug"}:
                continue  # server diagnostics
            if not re.search(r"\s", text):
                continue  # internal identifiers and keys
            if re.search(r"\b(canvas|JSON|payload|schema|slug)\b", text, re.I) or (re.search(r"\bXLSX\b", text) and "Excel" not in text):
                failures.append(f"{path.name}:{node.lineno}: {text}")
    assert failures == []
