"""SQLAlchemy DB models for persistence."""

from datetime import datetime

from sqlalchemy import Column, String, Text, Float, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.config.database import Base


class DBBug(Base):
    __tablename__ = "bugs"

    id = Column(String(36), primary_key=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    raw_content = Column(Text, nullable=True)
    file_name = Column(String(255), nullable=True)
    file_path = Column(String(512), nullable=True)
    status = Column(String(50), nullable=False, default="submitted")
    priority = Column(String(50), nullable=True)
    component = Column(String(100), nullable=True)
    resolution = Column(Text, nullable=True)
    source = Column(String(255), nullable=True)
    date = Column(DateTime, nullable=True)
    tags = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class DBAnalysis(Base):
    __tablename__ = "analyses"

    id = Column(String(36), primary_key=True)
    bug_id = Column(String(36), ForeignKey("bugs.id"), nullable=False)
    status = Column(String(50), nullable=False, default="pending")
    current_stage = Column(String(50), nullable=False, default="triage")
    triage = Column(Text, nullable=True)
    log_analysis = Column(Text, nullable=True)
    duplicate_detection = Column(Text, nullable=True)
    root_cause = Column(Text, nullable=True)
    remediation = Column(Text, nullable=True)
    risk_assessment = Column(Text, nullable=True)
    confidence_scoring = Column(Text, nullable=True)
    executive_summary = Column(Text, nullable=True)
    retrieved_context = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    agent_results = relationship("DBAgentResult", back_populates="analysis", cascade="all, delete-orphan")


class DBAgentResult(Base):
    __tablename__ = "agent_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    analysis_id = Column(String(36), ForeignKey("analyses.id"), nullable=False)
    agent_name = Column(String(100), nullable=False)
    stage = Column(String(50), nullable=False)
    output = Column(Text, nullable=True)
    confidence = Column(Float, nullable=False, default=0.0)
    duration_ms = Column(Integer, nullable=False, default=0)

    analysis = relationship("DBAnalysis", back_populates="agent_results")


class DBHistoryEntry(Base):
    __tablename__ = "history_entries"

    id = Column(String(36), primary_key=True)
    bug_id = Column(String(36), nullable=False)
    analysis_id = Column(String(36), nullable=False)
    title = Column(String(255), nullable=False)
    priority = Column(String(50), nullable=False)
    component = Column(String(100), nullable=False)
    status = Column(String(50), nullable=False)
    summary = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
