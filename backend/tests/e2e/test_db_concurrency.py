"""E2E Test – Database Concurrency / Deadlock Error.

Scenario:
    Two concurrent write transactions on the ``orders`` table deadlock.  MySQL
    rolls back one of them with ``MySQLTransactionRollbackException``.  This
    manifests as sporadic 500 errors during checkout on high-traffic days.

Assertions:
    1. Bug is submitted and stored successfully.
    2. Analytics endpoint shows the component and severity entries.
    3. Severity distribution sums to at least the number of submitted bugs.
    4. KB feedback endpoint accepts and mocks-stores the concurrency fix.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from tests.e2e.conftest import submit_and_get_bug_id


class TestDBConcurrencyError:
    """End-to-end tests for database deadlock / concurrency bugs."""

    def test_submit_db_concurrency_bug(self, e2e_client, db_concurrency_bug_content):
        """Bug submission must succeed and return a valid analysis pipeline ID."""
        response = e2e_client.post(
            "/api/v1/submit-bug",
            data={
                "content": db_concurrency_bug_content,
                "title": "MySQLTransactionRollbackException – Deadlock on Orders Table",
                "component": "Database/TransactionManager",
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert body["bug"]["id"]
        assert body["analysis_id"]

    def test_analytics_severity_sums_correct(self, e2e_client, db_concurrency_bug_content):
        """Total severity count must equal the total number of bugs submitted."""
        # Submit two bugs for this test
        submit_and_get_bug_id(e2e_client, db_concurrency_bug_content, "Database/TransactionManager")
        submit_and_get_bug_id(e2e_client, db_concurrency_bug_content, "Database/TransactionManager")

        resp = e2e_client.get("/api/v1/analytics/defect-patterns")
        assert resp.status_code == 200
        body = resp.json()

        total_bugs = sum(c["count"] for c in body["top_components"])
        total_severity = sum(s["count"] for s in body["severity_distribution"])
        assert total_bugs == total_severity, (
            f"Component sum ({total_bugs}) must equal severity sum ({total_severity})"
        )

    def test_analytics_response_schema(self, e2e_client, db_concurrency_bug_content):
        """Analytics response must contain the three required top-level keys."""
        submit_and_get_bug_id(e2e_client, db_concurrency_bug_content, "Database/TransactionManager")

        resp = e2e_client.get("/api/v1/analytics/defect-patterns")
        assert resp.status_code == 200
        body = resp.json()

        assert "top_components" in body
        assert "severity_distribution" in body
        assert "root_cause_themes" in body

        for item in body["top_components"]:
            assert "component" in item
            assert "count" in item
            assert item["count"] >= 1

        for item in body["severity_distribution"]:
            assert "severity" in item
            assert "count" in item

    def test_kb_feedback_db_concurrency_fix(self, e2e_client, db_concurrency_bug_content):
        """KB feedback must store a concurrency fix with a correct doc_id."""
        bug_id = submit_and_get_bug_id(e2e_client, db_concurrency_bug_content, "Database/TransactionManager")

        with patch("app.api.kb_feedback.upsert_resolved_fix", return_value="doc-db-deadlock-fix"), \
             patch("app.api.kb_feedback.EmbeddingService") as mock_emb_cls:
            mock_emb = MagicMock()
            mock_emb.embed_query.return_value = [0.2] * 384
            mock_emb_cls.return_value = mock_emb

            resp = e2e_client.post(
                "/api/v1/kb/feedback",
                json={
                    "bug_id": bug_id,
                    "fix_summary": (
                        "Reorder DML operations to acquire locks in consistent order across all "
                        "transactions. Add retry logic with exponential back-off for deadlock "
                        "rollbacks. Enable InnoDB deadlock detection logging."
                    ),
                },
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["doc_id"] == "doc-db-deadlock-fix"

    def test_kb_feedback_fix_summary_too_short(self, e2e_client, db_concurrency_bug_content):
        """KB feedback must reject fix_summary shorter than 5 characters."""
        bug_id = submit_and_get_bug_id(e2e_client, db_concurrency_bug_content, "Database/TransactionManager")
        resp = e2e_client.post(
            "/api/v1/kb/feedback",
            json={"bug_id": bug_id, "fix_summary": "ok"},
        )
        # Pydantic validation should return 422
        assert resp.status_code == 422
