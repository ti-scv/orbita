from unittest.mock import patch

from tests.test_report_canvas import env, post


def test_testing_report_hides_unexpected_database_error(env, caplog):
    setup, _, source = env
    secret = "SELECT password FROM private_table credential=secret"
    with patch("operations.report_engine.run_query", side_effect=RuntimeError(secret)):
        response = post(setup, source, "preview", {"parameters": {}})
    body = str(response.data)
    assert response.status_code == 400
    assert "Referência:" in body
    assert all(value not in body for value in ("SELECT", "private_table", "credential", "secret"))
    assert secret in caplog.text


def test_unexpected_errors_on_canvas_and_removal_routes_are_generic(env, settings):
    setup, report, source = env
    settings.REPORT_REMOVAL_ENABLED = True
    secret = "Traceback SELECT password FROM private_table credential=secret"
    routes = [
        ("get", f"/api/v1/reports/{report.pk}/canvas/?unit=ame", "operations.report_canvas.api.context_report"),
        ("post", f"/api/v1/reports/{report.pk}/canvas-preview/?unit=ame", "operations.report_canvas.api.context_report"),
        ("post", f"/api/v1/reports/{report.pk}/canvas-source-preview/?unit=ame", "operations.report_canvas.api.context_report"),
        ("post", f"/api/v1/reports/{report.pk}/canvas-column-origin/?unit=ame", "operations.report_canvas.api.context_report"),
        ("get", f"/api/v1/reports/{report.pk}/dependencias/?unit=ame", "operations.report_removal.dependencies"),
        ("get", f"/api/v1/report-connections/{source.connection_id}/dependencias/?unit=ame", "operations.report_removal.dependencies"),
        ("post", f"/api/v1/reports/{report.pk}/remover/?unit=ame", "operations.report_removal.require_removal"),
        ("post", f"/api/v1/report-connections/{source.connection_id}/remover/?unit=ame", "operations.report_removal.require_removal"),
    ]
    for method, url, target in routes:
        with patch(target, side_effect=RuntimeError(secret)):
            response = getattr(setup["client"], method)(url, {}, format="json")
        body = str(response.data)
        assert response.status_code == 500, (url, body)
        assert "Referência:" in body
        assert all(value not in body for value in ("Traceback", "SELECT", "private_table", "credential", "secret"))
