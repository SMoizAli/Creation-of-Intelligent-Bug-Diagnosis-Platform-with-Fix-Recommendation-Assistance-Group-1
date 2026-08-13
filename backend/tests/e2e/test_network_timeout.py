"""E2E Test – Network Timeout Error.

Scenario:
    The payment gateway HTTP call consistently times out after 30 000 ms under
    load.  ``SocketTimeoutException`` is thrown, resulting in failed checkouts
    and customer complaints.

Assertions:
    1. Bug is submitted and stored successfully.
    2. Analytics endpoint returns valid JSON with non-empty top_components.
    3. Retrieving the stored bug by ID works correctly.
    4. KB feedback endpoint stores a timeout-mitigation fix (mocked).
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from tests.e2e.conftest import submit_and_get_bug_id


class TestNetworkTimeoutError:
    """End-to-end tests for network / socket timeout bugs."""

    def test_submit_network_timeout_bug(self, e2e_client, network_timeout_bug_content):
        """Bug submission must succeed and return a non-empty analysis ID."""
        response = e2e_client.post(
            "/api/v1/submit-bug",
            data={
                "content": network_timeout_bug_content,
                "title": "SocketTimeoutException – Payment Gateway Timeout",
                "component": "PaymentService/ExternalGateway",
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert body["bug"]["id"]
        assert body["analysis_id"]

    def test_get_bug_by_id_after_submit(self, e2e_client, network_timeout_bug_content):
        """After submission, GET /bug/{bug_id} must return the stored bug."""
        bug_id = submit_and_get_bug_id(e2e_client, network_timeout_bug_content, "PaymentService/ExternalGateway")

        resp = e2e_client.get(f"/api/v1/bug/{bug_id}")
        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == bug_id
        assert body["title"]

    def test_analytics_components_non_empty(self, e2e_client, network_timeout_bug_content):
        """After submitting a timeout bug, top_components must be non-empty."""
        submit_and_get_bug_id(e2e_client, network_timeout_bug_content, "PaymentService/ExternalGateway")

        resp = e2e_client.get("/api/v1/analytics/defect-patterns")
        assert resp.status_code == 200
        body = resp.json()
        assert len(body["top_components"]) > 0

    def test_analytics_counts_are_positive(self, e2e_client, network_timeout_bug_content):
        """Every component in the analytics response must have count >= 1."""
        submit_and_get_bug_id(e2e_client, network_timeout_bug_content, "PaymentService/ExternalGateway")

        resp = e2e_client.get("/api/v1/analytics/defect-patterns")
        body = resp.json()
        for component in body["top_components"]:
            assert component["count"] >= 1, f"Unexpected zero count for {component['component']}"

    def test_kb_feedback_timeout_fix(self, e2e_client, network_timeout_bug_content):
        """KB feedback must store a network timeout mitigation fix."""
        bug_id = submit_and_get_bug_id(e2e_client, network_timeout_bug_content, "PaymentService/ExternalGateway")

        with patch("app.api.kb_feedback.upsert_resolved_fix", return_value="doc-network-timeout-fix"), \
             patch("app.api.kb_feedback.EmbeddingService") as mock_emb_cls:
            mock_emb = MagicMock()
            mock_emb.embed_query.return_value = [0.15] * 384
            mock_emb_cls.return_value = mock_emb

            resp = e2e_client.post(
                "/api/v1/kb/feedback",
                json={
                    "bug_id": bug_id,
                    "fix_summary": (
                        "Reduce initial connect timeout to 5s. Implement exponential back-off retry "
                        "with maximum 3 attempts. Add circuit-breaker pattern (Resilience4J) with "
                        "50% failure threshold. Cache last successful response for fallback."
                    ),
                },
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["doc_id"] == "doc-network-timeout-fix"
        assert body["bug_id"] == bug_id
