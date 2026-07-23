"""Database-backed repositories and business logic stores."""

import json
from contextlib import contextmanager
from typing import Dict, List, Optional
from datetime import datetime

from app.config.database import SessionLocal
from app.models import (
    Analysis, AnalysisStatus, Bug, BugPriority, BugStatus,
    HistoryEntry, WorkflowStage, AgentResult, BugMetadata
)
from app.models.db_models import DBBug, DBAnalysis, DBAgentResult, DBHistoryEntry
from app.utils.logger import get_logger

logger = get_logger("services.store")

@contextmanager
def get_db_session():
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error(f"Database transaction failed: {exc}")
        raise
    finally:
        db.close()


class SQLStore:
    """Thread-safe SQL database store."""

    def _db_to_bug(self, db_bug: DBBug) -> Bug:
        tags_list = []
        if db_bug.tags:
            tags_list = [t.strip() for t in db_bug.tags.split(",") if t.strip()]
        return Bug(
            id=db_bug.id,
            title=db_bug.title,
            description=db_bug.description,
            raw_content=db_bug.raw_content,
            file_path=db_bug.file_path,
            file_name=db_bug.file_name,
            status=BugStatus(db_bug.status),
            metadata=BugMetadata(
                bug_id=db_bug.id,
                priority=BugPriority(db_bug.priority),
                component=db_bug.component,
                resolution=db_bug.resolution or "",
                source=db_bug.source,
                date=db_bug.date,
                tags=tags_list
            ),
            created_at=db_bug.created_at,
            updated_at=db_bug.updated_at
        )

    def _bug_to_db(self, bug: Bug) -> DBBug:
        tags_str = ""
        if bug.metadata.tags:
            if isinstance(bug.metadata.tags, str):
                tags_str = bug.metadata.tags
            else:
                tags_str = ",".join(bug.metadata.tags)
        return DBBug(
            id=bug.id,
            title=bug.title,
            description=bug.description,
            raw_content=bug.raw_content,
            file_path=bug.file_path,
            file_name=bug.file_name,
            status=bug.status.value,
            priority=bug.metadata.priority.value,
            component=bug.metadata.component,
            resolution=bug.metadata.resolution,
            source=bug.metadata.source,
            date=bug.metadata.date,
            tags=tags_str,
            created_at=bug.created_at or datetime.utcnow(),
            updated_at=bug.updated_at or datetime.utcnow(),
        )

    def _db_to_analysis(self, db_analysis: DBAnalysis) -> Analysis:
        return Analysis(
            id=db_analysis.id,
            bug_id=db_analysis.bug_id,
            status=AnalysisStatus(db_analysis.status),
            current_stage=WorkflowStage(db_analysis.current_stage),
            triage=json.loads(db_analysis.triage) if db_analysis.triage else None,
            log_analysis=json.loads(db_analysis.log_analysis) if db_analysis.log_analysis else None,
            duplicate_detection=json.loads(db_analysis.duplicate_detection) if db_analysis.duplicate_detection else None,
            root_cause=json.loads(db_analysis.root_cause) if db_analysis.root_cause else None,
            remediation=json.loads(db_analysis.remediation) if db_analysis.remediation else None,
            risk_assessment=json.loads(db_analysis.risk_assessment) if db_analysis.risk_assessment else None,
            confidence_scoring=json.loads(db_analysis.confidence_scoring) if db_analysis.confidence_scoring else None,
            executive_summary=json.loads(db_analysis.executive_summary) if db_analysis.executive_summary else None,
            retrieved_context=json.loads(db_analysis.retrieved_context) if db_analysis.retrieved_context else [],
            agent_results=[
                AgentResult(
                    agent_name=r.agent_name,
                    stage=WorkflowStage(r.stage),
                    output=json.loads(r.output) if r.output else {},
                    confidence=r.confidence,
                    duration_ms=r.duration_ms
                )
                for r in db_analysis.agent_results
            ],
            summary=db_analysis.summary,
            created_at=db_analysis.created_at,
            completed_at=db_analysis.completed_at
        )

    def save_bug(self, bug: Bug) -> Bug:
        with get_db_session() as db:
            existing = db.query(DBBug).filter(DBBug.id == bug.id).first()
            db_bug = self._bug_to_db(bug)
            if existing:
                for key in DBBug.__table__.columns.keys():
                    if key != 'id':
                        setattr(existing, key, getattr(db_bug, key))
                existing.updated_at = datetime.utcnow()
            else:
                db.add(db_bug)
        return bug

    def get_bug(self, bug_id: str) -> Optional[Bug]:
        with get_db_session() as db:
            db_bug = db.query(DBBug).filter(DBBug.id == bug_id).first()
            if not db_bug:
                return None
            return self._db_to_bug(db_bug)

    def save_analysis(self, analysis: Analysis) -> Analysis:
        with get_db_session() as db:
            existing = db.query(DBAnalysis).filter(DBAnalysis.id == analysis.id).first()
            
            triage_str = json.dumps(analysis.triage) if analysis.triage else None
            log_str = json.dumps(analysis.log_analysis) if analysis.log_analysis else None
            dup_str = json.dumps(analysis.duplicate_detection) if analysis.duplicate_detection else None
            rc_str = json.dumps(analysis.root_cause) if analysis.root_cause else None
            rem_str = json.dumps(analysis.remediation) if analysis.remediation else None
            risk_str = json.dumps(analysis.risk_assessment) if analysis.risk_assessment else None
            conf_str = json.dumps(analysis.confidence_scoring) if analysis.confidence_scoring else None
            exec_str = json.dumps(analysis.executive_summary) if analysis.executive_summary else None
            context_str = json.dumps(analysis.retrieved_context) if analysis.retrieved_context else None

            if existing:
                existing.status = analysis.status.value
                existing.current_stage = analysis.current_stage.value
                existing.triage = triage_str
                existing.log_analysis = log_str
                existing.duplicate_detection = dup_str
                existing.root_cause = rc_str
                existing.remediation = rem_str
                existing.risk_assessment = risk_str
                existing.confidence_scoring = conf_str
                existing.executive_summary = exec_str
                existing.retrieved_context = context_str
                existing.summary = analysis.summary
                existing.completed_at = analysis.completed_at
                
                db.query(DBAgentResult).filter(DBAgentResult.analysis_id == analysis.id).delete()
            else:
                existing = DBAnalysis(
                    id=analysis.id,
                    bug_id=analysis.bug_id,
                    status=analysis.status.value,
                    current_stage=analysis.current_stage.value,
                    triage=triage_str,
                    log_analysis=log_str,
                    duplicate_detection=dup_str,
                    root_cause=rc_str,
                    remediation=rem_str,
                    risk_assessment=risk_str,
                    confidence_scoring=conf_str,
                    executive_summary=exec_str,
                    retrieved_context=context_str,
                    summary=analysis.summary,
                    created_at=analysis.created_at,
                    completed_at=analysis.completed_at
                )
                db.add(existing)

            for r in analysis.agent_results:
                db_res = DBAgentResult(
                    analysis_id=analysis.id,
                    agent_name=r.agent_name,
                    stage=r.stage.value,
                    output=json.dumps(r.output),
                    confidence=r.confidence,
                    duration_ms=r.duration_ms
                )
                db.add(db_res)
        return analysis

    def get_analysis(self, analysis_id: str) -> Optional[Analysis]:
        with get_db_session() as db:
            db_analysis = db.query(DBAnalysis).filter(DBAnalysis.id == analysis_id).first()
            if not db_analysis:
                return None
            return self._db_to_analysis(db_analysis)

    def get_analysis_by_bug(self, bug_id: str) -> Optional[Analysis]:
        with get_db_session() as db:
            db_analysis = db.query(DBAnalysis).filter(DBAnalysis.bug_id == bug_id).first()
            if not db_analysis:
                return None
            return self._db_to_analysis(db_analysis)

    def save_history(self, entry: HistoryEntry) -> HistoryEntry:
        with get_db_session() as db:
            existing = db.query(DBHistoryEntry).filter(DBHistoryEntry.id == entry.id).first()
            if existing:
                existing.title = entry.title
                existing.priority = entry.priority.value
                existing.component = entry.component
                existing.status = entry.status.value
                existing.summary = entry.summary
            else:
                db_entry = DBHistoryEntry(
                    id=entry.id,
                    bug_id=entry.bug_id,
                    analysis_id=entry.analysis_id,
                    title=entry.title,
                    priority=entry.priority.value,
                    component=entry.component,
                    status=entry.status.value,
                    summary=entry.summary,
                    created_at=entry.created_at
                )
                db.add(db_entry)
        return entry

    def list_history(self, limit: int = 50, offset: int = 0) -> List[HistoryEntry]:
        with get_db_session() as db:
            db_entries = db.query(DBHistoryEntry).order_by(DBHistoryEntry.created_at.desc()).offset(offset).limit(limit).all()
            return [
                HistoryEntry(
                    id=e.id,
                    bug_id=e.bug_id,
                    analysis_id=e.analysis_id,
                    title=e.title,
                    priority=BugPriority(e.priority),
                    component=e.component,
                    status=AnalysisStatus(e.status),
                    summary=e.summary,
                    created_at=e.created_at
                )
                for e in db_entries
            ]

    @property
    def bug_count(self) -> int:
        with get_db_session() as db:
            return db.query(DBBug).count()

    @property
    def active_analysis_count(self) -> int:
        with get_db_session() as db:
            return db.query(DBAnalysis).filter(DBAnalysis.status == "in_progress").count()

    @property
    def history_count(self) -> int:
        with get_db_session() as db:
            return db.query(DBHistoryEntry).count()


store = SQLStore()
