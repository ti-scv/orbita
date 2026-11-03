import pytest
from rest_framework.exceptions import ValidationError
from operations.report_canvas.api import infer_column_metadata
from operations.report_canvas.schema import default_layout, validate_layout

def test_blank_values_are_empty_and_not_samples():
    result = infer_column_metadata("Resultado", [None, "", "   ", "ok"])
    assert result["null_count"] == 3
    assert result["sample"] == ["ok"]

@pytest.mark.parametrize("key", ["width", "height", "columns", "background"])
def test_page_error_identifies_key(key):
    layout = default_layout()
    del layout["page"][key]
    with pytest.raises(ValidationError, match="page." + key):
        validate_layout(layout)

def test_missing_page_is_identified():
    layout = default_layout()
    del layout["page"]
    with pytest.raises(ValidationError, match="page"):
        validate_layout(layout)
