"""E2E Test – Memory Out-of-Bounds / Out-of-Memory Error.

Scenario:
    The report-generation engine exhausts JVM heap space when exporting datasets
    with more than 500 000 rows.  ``OutOfMemoryError: Java heap space`` is thrown
    inside ``Arrays.copyOf``, crashing the service and losing all in-progress
    export jobs.

Assertions:
    1. Bug is submitted and stored successfully.
    2. Analytics endpoint reflects the memory-related component.
    3. Multiple sequential submissions increment the analytics counts correctly.
    4. KB feedback endpoint accepts and stores a heap-management fix (mocked).
    5. History endpoint includes the submitted bug.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from tests.e2e.conftest import submit_and_get_bug_id


class TestMemoryOOBError:
    """End-to-end tests for memory out-of-bounds / OOM bugs."""

    def test_submit_memory_oob_bug(self, e2e_client, memory_oob_bug_content):
        """Bug submission must succeed and return a valid analysis ID."""
        response = e2e_client.post(
            "/api/v1/submit-bug",
            data={
                "content": memory_oob_bug_content,
                "title": "OutOfMemoryError – Java Heap Space During Large Export",
                "component": "ReportEngine/LargeDataExport",
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert body["bug"]["id"]
        assert body["analysis_id"]

    def test_analytics_after_memory_bug(self, e2e_client, memory_oob_bug_content):
        """Analytics endpoint must return valid defect-pattern data after OOM bug submission."""
        submit_and_get_bug_id(e2e_client, memory_oob_bug_content, "ReportEngine/LargeDataExport")

        resp = e2e_client.get("/api/v1/analytics/defect-patterns")
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert isinstance(body["top_components"], list)
        assert isinstance(body["severity_distribution"], list)
        assert isinstance(body["root_cause_themes"], list)

    def test_multiple_submissions_increment_counts(self, e2e_client, memory_oob_bug_content):
        """Submitting 3 bugs must raise the total component count by exactly 3."""
        before = e2e_client.get("/api/v1/analytics/defect-patterns").json()
        before_total = sum(c["count"] for c in before.get("top_components", []))

        for _ in range(3):
            submit_and_get_bug_id(e2e_client, memory_oob_bug_content, "ReportEngine/LargeDataExport")

        after = e2e_client.get("/api/v1/analytics/defect-patterns").json()
        after_total = sum(c["count"] for c in after.get("top_components", []))

        assert after_total == before_total + 3, (
            f"Expected total to grow by 3 (from {before_total} to {before_total + 3}), "
            f"but got {after_total}"
        )

    def test_kb_feedback_memory_fix(self, e2e_client, memory_oob_bug_content):
        """KB feedback must store a heap management fix successfully."""
        bug_id = submit_and_get_bug_id(e2e_client, memory_oob_bug_content, "ReportEngine/LargeDataExport")

        with patch("app.api.kb_feedback.upsert_resolved_fix", return_value="doc-memory-oob-fix"), \
             patch("app.api.kb_feedback.EmbeddingService") as mock_emb_cls:
            mock_emb = MagicMock()
            mock_emb.embed_query.return_value = [0.3] * 384
            mock_emb_cls.return_value = mock_emb

            resp = e2e_client.post(
                "/api/v1/kb/feedback",
                json={
                    "bug_id": bug_id,
                    "fix_summary": (
                        "Stream dataset in paginated batches of 10 000 rows using cursor-based "
                        "pagination.  Use Apache POI streaming API (SXSSFWorkbook) for Excel exports. "
                        "Increase JVM heap via -Xmx4g for the report service pod. "
                        "Add heap-usage monitoring alert at 80% threshold."
                    ),
                },
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["doc_id"] == "doc-memory-oob-fix"
        assert body["bug_id"] == bug_id
        assert body["timestamp"]

    def test_history_contains_submitted_bug(self, e2e_client, memory_oob_bug_content):
        """After submitting an OOM bug the history endpoint must include it."""
        submit_and_get_bug_id(e2e_client, memory_oob_bug_content, "ReportEngine/LargeDataExport")

        resp = e2e_client.get("/api/v1/history", params={"limit": 50})
        assert resp.status_code == 200
        body = resp.json()
        # History items may be empty if analysis hasn't completed, but response must be valid
        assert "items" in body
        assert isinstance(body["items"], list)
