"""Shared pytest fixtures for the e2e test suite.

These fixtures extend the session-level environment isolation already provided
by the parent ``tests/conftest.py`` and add convenience helpers specific to
e2e scenarios (submit a bug and run analytics checks).
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

# Ensure the backend root is resolvable when tests are invoked directly.
BACKEND_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(BACKEND_ROOT))


# ── Session-level environment isolation ──────────────────────────────────────

@pytest.fixture(scope="session", autouse=True)
def e2e_test_environment(tmp_path_factory):
    """Override paths so e2e tests use temporary, isolated storage."""
    test_root = tmp_path_factory.mktemp("e2e_tests")
    os.environ["CHROMA_PERSIST_DIR"] = str(test_root / "chroma_db")
    os.environ["DATABASE_URL"] = f"sqlite:///{(test_root / 'e2e_test.db').as_posix()}"
    os.environ["UPLOAD_DIR"] = str(test_root / "uploads")
    os.environ["LOG_DIR"] = str(test_root / "logs")
    os.environ.setdefault("LLM_API_KEY", "test-key-e2e")

    from app.config.settings import get_settings
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


# ── Per-test client ──────────────────────────────────────────────────────────

@pytest.fixture
def e2e_client():
    """Return a fresh TestClient with all service caches cleared."""
    from app.api.dependencies import get_analysis_service, get_bug_service, get_history_service
    from app.config.settings import get_settings
    from app.main import create_app

    get_settings.cache_clear()
    get_bug_service.cache_clear()
    get_analysis_service.cache_clear()
    get_history_service.cache_clear()

    app = create_app()
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


# ── Synthetic bug content templates ─────────────────────────────────────────

@pytest.fixture
def ui_thread_bug_content():
    return """
    FATAL ERROR: UI Thread Violation
    android.os.NetworkOnMainThreadException
    at android.os.StrictMode$AndroidBlockGuardPolicy.onNetwork(StrictMode.java:1512)
    at java.net.Inet6AddressImpl.lookupHostByName(Inet6AddressImpl.java:117)
    Component: MobileApp/NetworkLayer
    Severity: Critical
    Timestamp: 2024-03-10T14:22:00Z
    Description: Network call performed on the main UI thread causing ANR and crash.
    """


@pytest.fixture
def json_parser_bug_content():
    return """
    ERROR: JSON Parse Failure
    com.fasterxml.jackson.core.JsonParseException: Unexpected character ('{' at position 0)
    at [Source: (byte[])"{{malformed}}"; line: 1, column: 2]
    Component: API/PayloadParser
    Severity: High
    Timestamp: 2024-03-11T09:15:00Z
    Description: Upstream service returned double-encoded JSON causing deserialization failure.
    """


@pytest.fixture
def db_concurrency_bug_content():
    return """
    ERROR: Database Deadlock Detected
    com.mysql.jdbc.exceptions.jdbc4.MySQLTransactionRollbackException: Deadlock found when trying to get lock
    at sun.reflect.NativeConstructorAccessorImpl.newInstance0(NativeConstructorAccessorImpl.java)
    Component: Database/TransactionManager
    Severity: Critical
    Timestamp: 2024-03-12T18:45:00Z
    Description: Two concurrent write transactions deadlocked on the orders table.
    """


@pytest.fixture
def network_timeout_bug_content():
    return """
    ERROR: Request Timeout
    java.net.SocketTimeoutException: Read timed out after 30000ms
    at sun.nio.ch.SocketAdaptor.read(SocketAdaptor.java:160)
    Component: PaymentService/ExternalGateway
    Severity: High
    Timestamp: 2024-03-13T11:05:00Z
    Description: Payment gateway HTTP call consistently timing out under load.
    """


@pytest.fixture
def memory_oob_bug_content():
    return """
    CRITICAL ERROR: Out of Memory
    java.lang.OutOfMemoryError: Java heap space
    at java.util.Arrays.copyOf(Arrays.java:3210)
    at java.util.ArrayList.grow(ArrayList.java:265)
    Component: ReportEngine/LargeDataExport
    Severity: Critical
    Timestamp: 2024-03-14T22:30:00Z
    Description: Report generation for datasets > 500k rows exhausts heap allocation.
    """


# ── Shared helper fixture ────────────────────────────────────────────────────

def submit_and_get_bug_id(client: TestClient, content: str, component: str = "TestComponent") -> str:
    """Submit a bug report and return the assigned bug ID."""
    resp = client.post(
        "/api/v1/submit-bug",
        data={"content": content, "title": "E2E Test Bug", "component": component},
    )
    assert resp.status_code == 200, f"submit-bug failed: {resp.text}"
    data = resp.json()
    assert data.get("success") is True
    return data["bug"]["id"]
