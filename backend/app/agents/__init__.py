"""Agent package exports (lazy workflow import to avoid circular dependencies)."""

from app.agents.orchestrator import BugAnalysisOrchestrator

__all__ = ["BugAnalysisOrchestrator", "WorkflowOrchestrator"]


def __getattr__(name: str):
    if name == "WorkflowOrchestrator":
        from app.agents.workflow import WorkflowOrchestrator

        return WorkflowOrchestrator
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
