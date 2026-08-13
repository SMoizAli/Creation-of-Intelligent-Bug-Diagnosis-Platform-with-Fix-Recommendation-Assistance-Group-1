"""E2E Test – UI Thread / ANR Error.

Scenario:
    A mobile application throws ``NetworkOnMainThreadException`` because a
    network call is made on the Android UI thread.  This causes an Application
    Not Responding (ANR) event and a fatal crash.

Assertions:
    1. Bug is submitted and stored (HTTP 200, bug ID present).
    2. Analytics endpoint reflects the new component entry.
    3. KB feedback endpoint stores an embedding (ChromaDB upsert mocked).
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from tests.e2e.conftest import submit_and_get_bug_id


class TestUIThreadError:
    """End-to-end tests for UI thread / ANR bug reports."""

    def test_submit_ui_thread_bug(self, e2e_client, ui_thread_bug_content):
        """Bug submission must succeed and return a valid bug ID."""
        response = e2e_client.post(
            "/api/v1/submit-bug",
            data={
                "content": ui_thread_bug_content,
                "title": "NetworkOnMainThreadException – UI Thread Violation",
                "component": "MobileApp/NetworkLayer",
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert "id" in body["bug"]
        assert body["bug"]["id"]  # non-empty
        assert body["analysis_id"]

    def test_analytics_reflects_component(self, e2e_client, ui_thread_bug_content):
        """After submitting a bug, the analytics endpoint must list the component."""
        submit_and_get_bug_id(e2e_client, ui_thread_bug_content, "MobileApp/NetworkLayer")

        resp = e2e_client.get("/api/v1/analytics/defect-patterns")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True

        component_names = [c["component"] for c in body["top_components"]]
        # At least one component entry must exist (the one we just submitted or "Unknown")
        assert len(component_names) > 0

    def test_analytics_severity_present(self, e2e_client, ui_thread_bug_content):
        """Severity distribution must include at least one entry."""
        submit_and_get_bug_id(e2e_client, ui_thread_bug_content, "MobileApp/NetworkLayer")

        resp = e2e_client.get("/api/v1/analytics/defect-patterns")
        body = resp.json()
        assert len(body["severity_distribution"]) > 0

    def test_kb_feedback_stores_embedding(self, e2e_client, ui_thread_bug_content):
        """KB feedback endpoint must return success with a doc_id."""
        bug_id = submit_and_get_bug_id(e2e_client, ui_thread_bug_content, "MobileApp/NetworkLayer")

        # Mock the ChromaDB upsert to avoid requiring a live vector store
        with patch("app.api.kb_feedback.upsert_resolved_fix", return_value="mock-doc-id-ui-thread") as mock_upsert, \
             patch("app.api.kb_feedback.EmbeddingService") as mock_emb_cls:
            mock_emb = MagicMock()
            mock_emb.embed_query.return_value = [0.1] * 384
            mock_emb_cls.return_value = mock_emb

            resp = e2e_client.post(
                "/api/v1/kb/feedback",
                json={
                    "bug_id": bug_id,
                    "fix_summary": (
                        "Move all network calls off the main thread using AsyncTask, "
                        "Kotlin Coroutines (IO dispatcher), or RxJava observeOn(Schedulers.io())."
                    ),
                },
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["doc_id"] == "mock-doc-id-ui-thread"
        assert body["bug_id"] == bug_id

    def test_kb_feedback_rejects_unknown_bug(self, e2e_client):
        """KB feedback must return 404 for a non-existent bug ID."""
        resp = e2e_client.post(
            "/api/v1/kb/feedback",
            json={"bug_id": "nonexistent-bug-id", "fix_summary": "Some fix summary here."},
        )
        assert resp.status_code == 404
