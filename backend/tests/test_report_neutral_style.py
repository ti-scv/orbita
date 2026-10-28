import io
from openpyxl import load_workbook
from operations.report_canvas.pdf import style, table_parts
from operations.report_canvas.ports import block
from operations.report_canvas.xlsx import XLSXExporter


def test_new_text_and_tables_are_neutral_without_changing_chart_series():
    for kind in ("text", "table", "kpi"):
        assert block("b", kind, 0, 0, 500, 200)["options"]["color"] == "#262626"
    assert block("b", "bar", 0, 0, 500, 200)["options"]["color"] == "#17638f"
    assert style({"type":"line","options":{"color":"#17638f"}}).textColor.hexval() == "0x262626"


def document():
    table={"id":"b","type":"table","x":0,"y":0,"width":600,"height":200,"options":{},"columns":["Setor","Quantidade","Data"],"rows":[["Enfermaria",12,"2026-10-27"],["UTI",3,"2026-10-28"]]}
    return {"name":"QA","page":{"width":800,"height":500,"columns":24,"background":"#ffffff"},"pages":[{"id":"p","name":"QA","blocks":[table]}],"xlsx_mode":"table"}


def test_pdf_table_uses_neutral_ink_and_preserves_cells():
    b=document()["pages"][0]["blocks"][0]
    table=table_parts(b,600,200)[0]
    name=table._cellvalues[1][0]
    name=name[0] if isinstance(name,tuple) else name
    quantity=table._cellvalues[1][1]
    quantity=quantity[0] if isinstance(quantity,tuple) else quantity
    assert name.getPlainText() == "Enfermaria"
    assert quantity.getPlainText() == "12"
    assert name.style.textColor.hexval() == "0x262626"


def test_xlsx_keeps_structure_and_neutral_day_bands():
    book=load_workbook(io.BytesIO(XLSXExporter().render(document())))
    sheet=book.active
    assert list(sheet.values)==[("Setor","Quantidade","Data"),("Enfermaria",12,"2026-10-27"),("UTI",3,"2026-10-28")]
    assert sheet["A1"].font.color.rgb[-6:] == "262626"
    assert sheet["A1"].fill.fgColor.rgb[-6:] == "EDEDED"
    assert sheet["A2"].fill.fgColor.rgb[-6:] in {"F5F5F5","FFFFFF"}
    assert sheet["A3"].border.top.color.rgb[-6:] == "BDBDBD"
