"""Pytest configuration and shared fixtures."""

import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Ensure backend root is on path
BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_ROOT.parent
sys.path.insert(0, str(BACKEND_ROOT))


@pytest.fixture(scope="session", autouse=True)
def configure_test_environment(tmp_path_factory):
    """Isolate test storage from developer/production paths."""
    test_root = tmp_path_factory.mktemp("aiba_tests")
    os.environ["CHROMA_PERSIST_DIR"] = str(test_root / "chroma_db")
    os.environ["DATABASE_URL"] = f"sqlite:///{(test_root / 'test.db').as_posix()}"
    os.environ["UPLOAD_DIR"] = str(test_root / "uploads")
    os.environ["LOG_DIR"] = str(test_root / "logs")
    os.environ.setdefault("LLM_API_KEY", "")

    from app.config.settings import get_settings

    get_settings.cache_clear()


@pytest.fixture
def client():
    from app.api.dependencies import get_analysis_service, get_bug_service, get_history_service
    from app.config.settings import get_settings
    from app.main import create_app

    get_settings.cache_clear()
    get_bug_service.cache_clear()
    get_analysis_service.cache_clear()
    get_history_service.cache_clear()

    app = create_app()
    with TestClient(app) as c:
        yield c


@pytest.fixture
def sample_bug_content():
    return """
    ERROR: NullPointerException in UserService.getProfile()
    at com.example.UserService.getProfile(UserService.java:42)
    HTTP 500 Internal Server Error
    Timestamp: 2024-01-15T10:30:00Z
    Critical production outage affecting login flow.
    """
