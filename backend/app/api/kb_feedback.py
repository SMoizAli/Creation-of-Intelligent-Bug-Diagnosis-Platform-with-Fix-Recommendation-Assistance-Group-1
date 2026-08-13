"""Knowledge-Base Feedback Route.

Exposes:
    POST /kb/feedback
        Accepts a JSON body ``{ bug_id, fix_summary }`` and stores a vector
        embedding of the fix summary in the ChromaDB ``resolved_fixes``
        collection so that future RAG retrievals can surface proven fixes.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config.database import SessionLocal
from app.models.db_models import DBBug
from app.rag.embeddings import EmbeddingService
from app.utils.chroma_feedback import upsert_resolved_fix
from app.utils.logger import get_logger

logger = get_logger("api.kb_feedback")

kb_router = APIRouter(prefix="/kb", tags=["Knowledge-Base"])


# ── Request / Response schemas ────────────────────────────────────────────────

class KBFeedbackRequest(BaseModel):
    bug_id: str = Field(..., description="ID of the resolved bug")
    fix_summary: str = Field(..., min_length=5, description="Plain-text description of the applied fix")


class KBFeedbackResponse(BaseModel):
    success: bool = True
    message: str
    doc_id: str
    bug_id: str
    timestamp: str


# ── Route ─────────────────────────────────────────────────────────────────────

@kb_router.post("/feedback", response_model=KBFeedbackResponse)
def submit_kb_feedback(request: KBFeedbackRequest):
    """Store a resolved-bug fix embedding in the ChromaDB knowledge base.

    The endpoint:
    1. Verifies the referenced ``bug_id`` exists in the SQL database.
    2. Embeds the ``fix_summary`` using the shared :class:`EmbeddingService`.
    3. Upserts the vector into the ``resolved_fixes`` ChromaDB collection.

    Returns the generated document ID for confirmation.
    """
    # 1. Verify bug exists
    db: Session = SessionLocal()
    try:
        bug = db.query(DBBug).filter(DBBug.id == request.bug_id).first()
        if bug is None:
            raise HTTPException(
                status_code=404,
                detail=f"Bug with id '{request.bug_id}' not found.",
            )
        bug_title = bug.title  # capture before session closes
    finally:
        db.close()

    # 2. Generate embedding
    try:
        embedding_svc = EmbeddingService()
        embedding = embedding_svc.embed_query(request.fix_summary)
    except Exception as exc:
        logger.error("Embedding generation failed for KB feedback: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Embedding service unavailable. Please retry later.",
        ) from exc

    # 3. Upsert into ChromaDB resolved_fixes collection
    try:
        timestamp = datetime.now(timezone.utc).isoformat()
        doc_id = upsert_resolved_fix(
            bug_id=request.bug_id,
            fix_summary=request.fix_summary,
            embedding=embedding,
            timestamp=timestamp,
        )
    except Exception as exc:
        logger.error("ChromaDB upsert failed for bug '%s': %s", request.bug_id, exc)
        raise HTTPException(
            status_code=503,
            detail="Knowledge-base storage unavailable. Please retry later.",
        ) from exc

    logger.info(
        "KB feedback stored: bug_id=%s title='%s' doc_id=%s",
        request.bug_id,
        bug_title,
        doc_id,
    )

    return KBFeedbackResponse(
        message=f"Fix embedding stored successfully for bug '{bug_title}'.",
        doc_id=doc_id,
        bug_id=request.bug_id,
        timestamp=timestamp,
    )
