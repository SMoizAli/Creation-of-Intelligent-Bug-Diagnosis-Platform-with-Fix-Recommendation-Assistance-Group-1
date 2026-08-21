"""Domain models for AI-Smart-Bug-Analyzer-And-Fix-Advisor."""

from enum import Enum
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, ConfigDict


class BugPriority(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    UNKNOWN = "unknown"


class BugStatus(str, Enum):
    SUBMITTED = "submitted"
    PROCESSING = "processing"
    ANALYZED = "analyzed"
    FAILED = "failed"


class AnalysisStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class WorkflowStage(str, Enum):
    TRIAGE = "triage"
    LOG_PARSING = "log_parsing"
    DUPLICATE_DETECTION = "duplicate_detection"
    ROOT_CAUSE = "root_cause"
    REMEDIATION = "remediation"
    RISK_ASSESSMENT = "risk_assessment"
    CONFIDENCE_SCORING = "confidence_scoring"
    EXECUTIVE_SUMMARY = "executive_summary"
    COMPLETE = "complete"


class BugMetadata(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    bug_id: str = ""
    priority: BugPriority = BugPriority.UNKNOWN
    component: str = ""
    resolution: str = ""
    source: str = ""
    date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    tags: List[str] = Field(default_factory=list)


class Bug(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    id: str = Field(default_factory=lambda: str(__import__("uuid").uuid4()))
    title: str
    description: str
    raw_content: str = ""
    file_path: Optional[str] = None
    file_name: Optional[str] = None
    status: BugStatus = BugStatus.SUBMITTED
    metadata: BugMetadata = Field(default_factory=BugMetadata)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AgentResult(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    agent_name: str
    stage: WorkflowStage
    output: Dict[str, Any] = Field(default_factory=dict)
    confidence: float = 0.0
    duration_ms: int = 0


class Analysis(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    id: str = Field(default_factory=lambda: str(__import__("uuid").uuid4()))
    bug_id: str
    status: AnalysisStatus = AnalysisStatus.PENDING
    current_stage: WorkflowStage = WorkflowStage.TRIAGE
    triage: Optional[Dict[str, Any]] = None
    log_analysis: Optional[Dict[str, Any]] = None
    duplicate_detection: Optional[Dict[str, Any]] = None
    root_cause: Optional[Dict[str, Any]] = None
    remediation: Optional[Dict[str, Any]] = None
    risk_assessment: Optional[Dict[str, Any]] = None
    confidence_scoring: Optional[Dict[str, Any]] = None
    executive_summary: Optional[Dict[str, Any]] = None
    retrieved_context: List[Dict[str, Any]] = Field(default_factory=list)
    agent_results: List[AgentResult] = Field(default_factory=list)
    summary: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    unified_analysis: Optional[Dict[str, Any]] = None


class HistoryEntry(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True)

    id: str = Field(default_factory=lambda: str(__import__("uuid").uuid4()))
    bug_id: str
    analysis_id: str
    title: str
    priority: BugPriority = BugPriority.UNKNOWN
    component: str = ""
    status: AnalysisStatus = AnalysisStatus.PENDING
    summary: str = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AppSettings(BaseModel):
    embedding_model: str
    chunk_size: int
    chunk_overlap: int
    retrieval_top_k: int
    mmr_lambda: float
    max_upload_size_mb: int
    allowed_extensions: List[str]
    llm_model: str
    enable_mmr: bool
