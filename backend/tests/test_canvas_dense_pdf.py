import io
from pypdf import PdfReader
from operations.report_canvas.pdf import PDFExporter


def test_dense_text_and_table_continue_after_orientation_change():
    for width, height in ((794, 1123), (1123, 794)):
        text = {"id": "text", "type": "text", "x": 0, "y": 0, "width": 240, "height": 100,
                "title": "", "text": " ".join(f"word{i:03d}" for i in range(180)), "options": {}}
        table = {"id": "table", "type": "table", "x": 250, "y": 0, "width": 300, "height": 120,
                 "title": "", "columns": ["First", "Second"], "rows": [[" ".join(f"cell{i:03d}" for i in range(180)), "tailmarker"]], "options": {}}
        doc = {"name": "dense", "page": {"width": width, "height": height, "background": "#ffffff"},
               "pages": [{"blocks": [text, table]}]}
        pdf = PdfReader(io.BytesIO(PDFExporter().render(doc)))
        content = " ".join(page.extract_text() for page in pdf.pages)
        assert len(pdf.pages) > 1
        for i in range(180):
            assert f"word{i:03d}" in content
            assert f"cell{i:03d}" in content
        assert "tailmarker" in content


def test_wide_table_continues_by_column_in_both_orientations():
    for width, height in ((794, 1123), (1123, 794)):
        columns = [f"Column{i:02d}" for i in range(20)]
        row = [f"value{i:02d}" for i in range(20)]
        table = {"id": "table", "type": "table", "x": 0, "y": 0, "width": 240, "height": 180,
                 "title": "", "columns": columns, "rows": [row], "options": {}}
        doc = {"name": "wide", "page": {"width": width, "height": height, "background": "#ffffff"},
               "pages": [{"blocks": [table]}]}
        pdf = PdfReader(io.BytesIO(PDFExporter().render(doc)))
        content = " ".join(page.extract_text() for page in pdf.pages)
        assert len(pdf.pages) > 1
        for value in columns + row:
            assert value in content


def test_chart_labels_and_values_continue_in_both_orientations():
    for width, height in ((794, 1123), (1123, 794)):
        for kind in ("bar", "line", "pie"):
            chart = {"id": "chart", "type": kind, "x": 0, "y": 0, "width": 300, "height": 180,
                     "title": "Chart", "columns": ["Category", "LongSeriesNameMarker"],
                     "rows": [[f"LongCategoryMarker{i:02d}", i + 1] for i in range(15)], "options": {}}
            doc = {"name": "chart", "page": {"width": width, "height": height, "background": "#ffffff"},
                   "pages": [{"blocks": [chart]}]}
            pdf = PdfReader(io.BytesIO(PDFExporter().render(doc)))
            content = " ".join(page.extract_text() for page in pdf.pages)
            assert len(pdf.pages) > 1
            assert "LongSeriesNameMarker" in content
            for i in range(15):
                assert f"LongCategoryMarker{i:02d}" in content
