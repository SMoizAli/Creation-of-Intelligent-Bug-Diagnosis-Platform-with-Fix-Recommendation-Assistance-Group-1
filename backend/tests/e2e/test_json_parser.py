"""E2E Test – JSON Parser / Schema Mismatch Error.

Scenario:
    An upstream microservice returns a double-encoded or malformed JSON payload.
    The receiving service's Jackson deserialiser raises a ``JsonParseException``,
    causing a 500-level failure for end users.

Assertions:
    1. Bug is submitted and stored successfully.
    2. Analytics endpoint reflects the submission.
    3. KB feedback endpoint stores an embedding (ChromaDB upsert mocked).
    4. Analytics root-cause themes list is a valid list (even if empty early).
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from tests.e2e.conftest import submit_and_get_bug_id


class TestJSONParserError:
    """End-to-end tests for JSON parse / schema mismatch bugs."""

    def test_submit_json_parser_bug(self, e2e_client, json_parser_bug_content):
        """Bug submission must succeed and return a valid bug ID."""
        response = e2e_client.post(
            "/api/v1/submit-bug",
            data={
                "content": json_parser_bug_content,
                "title": "JsonParseException – Malformed Upstream Payload",
                "component": "API/PayloadParser",
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body["success"] is True
        assert body["bug"]["id"]
        assert body["analysis_id"]

    def test_analytics_top_components_count_increases(self, e2e_client, json_parser_bug_content):
        """Submitting a bug must increase the component entry count in analytics."""
        # Get baseline count
        baseline = e2e_client.get("/api/v1/analytics/defect-patterns").json()
        before = sum(c["count"] for c in baseline.get("top_components", []))

        submit_and_get_bug_id(e2e_client, json_parser_bug_content, "API/PayloadParser")

        after_resp = e2e_client.get("/api/v1/analytics/defect-patterns")
        assert after_resp.status_code == 200
        after_body = after_resp.json()
        after = sum(c["count"] for c in after_body.get("top_components", []))

        assert after > before, "Total component count should increase after bug submission"

    def test_analytics_root_cause_themes_is_list(self, e2e_client, json_parser_bug_content):
        """root_cause_themes must always be a list (not null)."""
        submit_and_get_bug_id(e2e_client, json_parser_bug_content, "API/PayloadParser")

        resp = e2e_client.get("/api/v1/analytics/defect-patterns")
        body = resp.json()
        assert isinstance(body["root_cause_themes"], list)

    def test_kb_feedback_json_parser_fix(self, e2e_client, json_parser_bug_content):
        """KB feedback endpoint must accept and store a JSON parser fix."""
        bug_id = submit_and_get_bug_id(e2e_client, json_parser_bug_content, "API/PayloadParser")

        with patch("app.api.kb_feedback.upsert_resolved_fix", return_value="doc-json-parser-fix") as _, \
             patch("app.api.kb_feedback.EmbeddingService") as mock_emb_cls:
            mock_emb = MagicMock()
            mock_emb.embed_query.return_value = [0.05] * 384
            mock_emb_cls.return_value = mock_emb

            resp = e2e_client.post(
                "/api/v1/kb/feedback",
                json={
                    "bug_id": bug_id,
                    "fix_summary": (
                        "Validate upstream JSON responses with a schema check before deserialization. "
                        "Use lenient parser settings and add a circuit-breaker for malformed payloads."
                    ),
                },
            )

        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["doc_id"] == "doc-json-parser-fix"
        assert body["bug_id"] == bug_id
        assert "timestamp" in body

    def test_submit_minimal_json_bug(self, e2e_client):
        """A minimal JSON-type bug with only required fields must still be stored."""
        resp = e2e_client.post(
            "/api/v1/submit-bug",
            data={"content": "JsonParseException: Unexpected token at line 1 column 5"},
        )
        assert resp.status_code == 200
        assert resp.json()["success"] is True
