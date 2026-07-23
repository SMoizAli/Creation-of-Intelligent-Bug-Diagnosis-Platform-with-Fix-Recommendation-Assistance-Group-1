"""API endpoint tests."""

import io


def test_health_check(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data


def test_status_endpoint(client):
    response = client.get("/api/v1/status")
    assert response.status_code == 200
    data = response.json()
    assert "overall" in data
    assert "services" in data


def test_submit_bug_text(client, sample_bug_content):
    response = client.post(
        "/api/v1/submit-bug",
        data={"content": sample_bug_content, "title": "Test Bug"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "bug" in data
    assert data["analysis_id"]


def test_submit_bug_empty_content(client):
    response = client.post("/api/v1/submit-bug", data={"content": ""})
    assert response.status_code == 422


def test_submit_bug_file(client, sample_bug_content):
    file = io.BytesIO(sample_bug_content.encode())
    response = client.post(
        "/api/v1/submit-bug",
        files={"file": ("error.log", file, "text/plain")},
    )
    assert response.status_code == 200
    assert response.json()["bug"]["file_name"] == "error.log"


def test_analyze_flow(client, sample_bug_content):
    submit = client.post(
        "/api/v1/submit-bug",
        data={"content": sample_bug_content},
    )
    bug_id = submit.json()["bug"]["id"]

    analyze = client.post("/api/v1/analyze", json={"bug_id": bug_id})
    assert analyze.status_code == 200
    result = analyze.json()["analysis"]
    assert result["status"] == "completed"
    assert result["triage"] is not None
    assert result["root_cause"] is not None
    assert result["remediation"] is not None


def test_history_endpoint(client, sample_bug_content):
    client.post("/api/v1/submit-bug", data={"content": sample_bug_content})
    response = client.get("/api/v1/history")
    assert response.status_code == 200
    assert "items" in response.json()


def test_settings_endpoint(client):
    response = client.get("/api/v1/settings")
    assert response.status_code == 200
    data = response.json()
    assert data["embedding_model"] == "sentence-transformers/all-MiniLM-L6-v2"
