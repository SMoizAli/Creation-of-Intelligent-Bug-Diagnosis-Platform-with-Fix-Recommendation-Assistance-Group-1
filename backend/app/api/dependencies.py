"""FastAPI dependency injection."""

from functools import lru_cache

from app.services.analysis_service import AnalysisService
from app.services.bug_service import BugService
from app.services.history_service import HistoryService


@lru_cache
def get_bug_service() -> BugService:
    return BugService()


@lru_cache
def get_analysis_service() -> AnalysisService:
    return AnalysisService()


@lru_cache
def get_history_service() -> HistoryService:
    return HistoryService()
