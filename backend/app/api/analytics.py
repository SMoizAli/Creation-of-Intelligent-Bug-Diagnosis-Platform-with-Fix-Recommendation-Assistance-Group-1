"""Analytics routes – Defect Pattern Aggregation.

Exposes:
    GET /analytics/defect-patterns
        Returns aggregated statistics derived from the SQLite ``bugs`` and
        ``analyses`` tables:
            - top_components      : list[{component, count}]
            - severity_distribution : list[{severity, count}]
            - root_cause_themes   : list[{theme, count}]
"""

from __future__ import annotations

import json
from collections import Counter
from typing import Any, Dict, List

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config.database import SessionLocal
from app.models.db_models import DBAnalysis, DBBug
from app.utils.logger import get_logger

logger = get_logger("api.analytics")

analytics_router = APIRouter(prefix="/analytics", tags=["Analytics"])


# ── Dependency ────────────────────────────────────────────────────────────────

def _get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Response schema ───────────────────────────────────────────────────────────

class ComponentCount(BaseModel):
    component: str
    count: int


class SeverityCount(BaseModel):
    severity: str
    count: int


class ThemeCount(BaseModel):
    theme: str
    count: int


class DefectPatternsResponse(BaseModel):
    success: bool = True
    top_components: List[ComponentCount]
    severity_distribution: List[SeverityCount]
    root_cause_themes: List[ThemeCount]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _extract_root_cause_themes(db: Session, top_n: int = 15) -> List[ThemeCount]:
    """Mine ``root_cause`` JSON column in *analyses* for keyword themes."""
    rows = db.query(DBAnalysis.root_cause).filter(DBAnalysis.root_cause.isnot(None)).all()

    # Keywords that signal distinct root-cause categories
    THEME_KEYWORDS: Dict[str, List[str]] = {
        "Null / Undefined Reference": ["null", "nullpointer", "undefined", "nonetype", "none"],
        "Memory Issues": ["memory", "leak", "heap", "out of memory", "oom", "buffer", "overflow"],
        "Concurrency / Race Condition": ["race", "deadlock", "thread", "concurrent", "synchroni", "mutex"],
        "Network / Timeout": ["timeout", "connection", "network", "socket", "http", "refused"],
        "Database / Query Error": ["database", "query", "sql", "constraint", "foreign key", "transaction"],
        "Authentication / Auth": ["auth", "permission", "token", "credential", "unauthori"],
        "Configuration / Environment": ["config", "env", "environment", "variable", "missing key"],
        "Type / Schema Mismatch": ["type", "schema", "cast", "mismatch", "invalid format", "json"],
        "File / IO Error": ["file", "io", "disk", "path", "permission denied", "not found"],
        "Dependency / Import Error": ["import", "module", "package", "dependency", "version"],
    }

    theme_counter: Counter = Counter()
    for (raw_json,) in rows:
        try:
            data: Any = json.loads(raw_json) if isinstance(raw_json, str) else raw_json or {}
        except (json.JSONDecodeError, TypeError):
            data = {}

        # Flatten all string values into a single searchable blob
        blob = " ".join(
            str(v).lower() for v in (data.values() if isinstance(data, dict) else [str(data)])
        )

        matched_any = False
        for theme, keywords in THEME_KEYWORDS.items():
            if any(kw in blob for kw in keywords):
                theme_counter[theme] += 1
                matched_any = True

        if not matched_any:
            theme_counter["Other"] += 1

    return [
        ThemeCount(theme=theme, count=count)
        for theme, count in theme_counter.most_common(top_n)
    ]


# ── Route ─────────────────────────────────────────────────────────────────────

@analytics_router.get("/defect-patterns", response_model=DefectPatternsResponse)
def get_defect_patterns(db: Session = Depends(_get_db)):
    """Aggregate defect patterns from bugs and analyses tables.

    Returns the top affected components, severity distribution, and inferred
    root-cause themes derived from triage/root_cause agent outputs.
    """
    # 1. Top affected components
    all_bugs: List[DBBug] = db.query(DBBug).all()
    component_counter: Counter = Counter()
    severity_counter: Counter = Counter()

    for bug in all_bugs:
        comp = (bug.component or "Unknown").strip() or "Unknown"
        component_counter[comp] += 1

        sev = (bug.priority or "unknown").strip().lower() or "unknown"
        severity_counter[sev] += 1

    top_components = [
        ComponentCount(component=comp, count=cnt)
        for comp, cnt in component_counter.most_common(10)
    ]

    severity_distribution = [
        SeverityCount(severity=sev.capitalize(), count=cnt)
        for sev, cnt in severity_counter.most_common()
    ]

    # 2. Root-cause themes extracted from analyses
    root_cause_themes = _extract_root_cause_themes(db)

    logger.info(
        "Defect-patterns: %d components, %d severity levels, %d themes",
        len(top_components),
        len(severity_distribution),
        len(root_cause_themes),
    )

    return DefectPatternsResponse(
        top_components=top_components,
        severity_distribution=severity_distribution,
        root_cause_themes=root_cause_themes,
    )
