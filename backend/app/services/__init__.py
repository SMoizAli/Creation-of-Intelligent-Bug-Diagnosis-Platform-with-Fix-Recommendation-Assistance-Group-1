"""Service layer exports (lazy to avoid circular imports with agents)."""

__all__ = ["AnalysisService", "BugService", "HistoryService"]


def __getattr__(name: str):
    if name == "AnalysisService":
        from app.services.analysis_service import AnalysisService

        return AnalysisService
    if name == "BugService":
        from app.services.bug_service import BugService

        return BugService
    if name == "HistoryService":
        from app.services.history_service import HistoryService

        return HistoryService
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
