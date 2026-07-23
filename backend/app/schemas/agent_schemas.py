"""Pydantic schemas for Milestone 2 agent pipeline outputs."""

from datetime import datetime, timezone
from typing import List, Optional
from uuid import uuid4

from pydantic import BaseModel, Field

from app.models import BugPriority


class TriageResult(BaseModel):
    """Structured output from the Triage Agent."""

    priority: BugPriority = BugPriority.UNKNOWN
    component: str = "unknown"
    summary: str = ""
    tags: List[str] = Field(default_factory=list)
    severity_score: int = Field(default=5, ge=1, le=10)
    recommended_assignee_team: str = "general-team"
    business_impact: str = ""
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    reasoning: str = Field(default="", description="Explanation justifying the severity, priority, and component classifications.")


class LogAnalysisResult(BaseModel):
    """Structured output from the Log Analysis Agent."""

    error_count: int = 0
    error_samples: List[str] = Field(default_factory=list)
    has_stack_trace: bool = False
    stack_trace_lines: List[str] = Field(default_factory=list)
    timestamps_found: List[str] = Field(default_factory=list)
    http_status_codes: List[int] = Field(default_factory=list)
    log_format: str = "plain_text"
    detected_errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    
    # --- Critical Fields Added for Milestone 3 & 4 downstreams ---
    exception_type: str = Field(default="UnknownException", description="Primary exception or error class detected (e.g. NullPointerException).")
    failure_point: str = Field(default="unknown", description="The exact function, method, or line where the execution failed.")
    affected_code_path: str = Field(default="unknown", description="The target file or file path containing the failing code.")
    
    # Keep original arrays for backward compatibility
    exceptions: List[str] = Field(default_factory=list)
    file_names: List[str] = Field(default_factory=list)
    line_numbers: List[int] = Field(default_factory=list)
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class UnifiedBugAnalysis(BaseModel):
    """Combined Milestone 2 analysis artifact persisted to datasets/processed/."""

    analysis_id: str = Field(default_factory=lambda: str(uuid4()))
    source_file: str
    title: str = ""
    raw_input: str
    triage: TriageResult
    log_analysis: LogAnalysisResult
    processed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    pipeline_version: str = "milestone-2"
    overall_summary: str = ""
    overall_confidence: float = Field(default=0.0, ge=0.0, le=1.0)