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
