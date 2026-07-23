"""Unit tests for the SQLite persistent database store layer."""

from datetime import datetime
from app.models import Bug, BugMetadata, BugPriority, BugStatus, Analysis, AnalysisStatus, WorkflowStage, HistoryEntry


def test_db_bug_persistence():
    from app.services.store import store
    bug_id = "test-bug-999"
    metadata = BugMetadata(priority=BugPriority.HIGH, component="database", tags=["test", "db"])
    bug = Bug(
        id=bug_id,
        title="Test SQLite Bug",
        description="Stack trace info",
        raw_content="Stack trace info",
        file_name="error.log",
        metadata=metadata,
        status=BugStatus.SUBMITTED
    )
    
    # Save to SQLite
    store.save_bug(bug)
    
    # Retrieve and Assert
    retrieved = store.get_bug(bug_id)
    assert retrieved is not None
    assert retrieved.title == "Test SQLite Bug"
    assert retrieved.metadata.component == "database"
    assert "db" in retrieved.metadata.tags


def test_db_analysis_persistence():
    from app.services.store import store
    bug_id = "test-bug-999"
    analysis_id = "test-analysis-888"
    analysis = Analysis(
        id=analysis_id,
        bug_id=bug_id,
        status=AnalysisStatus.COMPLETED,
        current_stage=WorkflowStage.COMPLETE,
        triage={"priority": "high", "component": "database"},
        summary="Test analysis summary result"
    )
    
    # Save to SQLite
    store.save_analysis(analysis)
    
    # Retrieve and Assert
    retrieved = store.get_analysis(analysis_id)
    assert retrieved is not None
    assert retrieved.status == AnalysisStatus.COMPLETED
    assert retrieved.summary == "Test analysis summary result"
    assert retrieved.triage["component"] == "database"


def test_db_history_persistence():
    from app.services.store import store
    bug_id = "test-bug-999"
    analysis_id = "test-analysis-888"
    entry = HistoryEntry(
        id="history-entry-777",
        bug_id=bug_id,
        analysis_id=analysis_id,
        title="Test History Title",
        priority=BugPriority.HIGH,
        component="database",
        status=AnalysisStatus.COMPLETED,
        summary="Test summary log",
        created_at=datetime.utcnow()
    )
    
    # Save to SQLite
    store.save_history(entry)
    
    # List history
    history = store.list_history(limit=5)
    assert len(history) > 0
    assert any(h.id == "history-entry-777" for h in history)

