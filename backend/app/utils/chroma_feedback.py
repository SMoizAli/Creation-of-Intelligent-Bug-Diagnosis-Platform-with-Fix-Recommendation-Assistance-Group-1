"""ChromaDB helper for the resolved-fixes knowledge-base collection.

This module initialises (or retrieves) the ``resolved_fixes`` collection inside
the existing PersistentClient and exposes a single :func:`upsert_resolved_fix`
helper used by the KB-feedback route.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional

import chromadb
from chromadb.config import Settings as ChromaSettings

from app.config.settings import get_settings
from app.utils.logger import get_logger

logger = get_logger("utils.chroma_feedback")

RESOLVED_FIXES_COLLECTION = "resolved_fixes"

_resolved_collection = None


def _get_client() -> chromadb.PersistentClient:
    """Return a ChromaDB PersistentClient pointed at the configured chroma_path."""
    settings = get_settings()
    return chromadb.PersistentClient(
        path=str(settings.chroma_path),
        settings=ChromaSettings(anonymized_telemetry=False),
    )


def get_resolved_fixes_collection():
    """Return (and cache) the ``resolved_fixes`` ChromaDB collection."""
    global _resolved_collection
    if _resolved_collection is not None:
        return _resolved_collection

    try:
        client = _get_client()
        _resolved_collection = client.get_or_create_collection(
            name=RESOLVED_FIXES_COLLECTION,
            metadata={"hnsw:space": "cosine"},
        )
        logger.info("ChromaDB collection '%s' ready.", RESOLVED_FIXES_COLLECTION)
    except Exception as exc:
        logger.error("Failed to initialise '%s' collection: %s", RESOLVED_FIXES_COLLECTION, exc)
        raise

    return _resolved_collection


def upsert_resolved_fix(
    bug_id: str,
    fix_summary: str,
    embedding: List[float],
    doc_id: Optional[str] = None,
    timestamp: Optional[str] = None,
) -> str:
    """Upsert a resolved-fix embedding into the ``resolved_fixes`` collection.

    Parameters
    ----------
    bug_id:
        The ID of the resolved bug.
    fix_summary:
        Human-readable description of the applied fix.
    embedding:
        Pre-computed vector embedding of *fix_summary*.
    doc_id:
        Optional document ID.  A UUID4 is generated if not provided.
    timestamp:
        ISO-8601 timestamp string.  Defaults to the current UTC time.

    Returns
    -------
    str
        The document ID that was upserted.
    """
    collection = get_resolved_fixes_collection()
    doc_id = doc_id or str(uuid.uuid4())
    ts = timestamp or datetime.now(timezone.utc).isoformat()

    collection.upsert(
        ids=[doc_id],
        documents=[fix_summary],
        embeddings=[embedding],
        metadatas=[
            {
                "bug_id": str(bug_id),
                "fix_summary": fix_summary[:500],  # keep metadata scalar & bounded
                "timestamp": ts,
            }
        ],
    )
    logger.info("Upserted resolved fix doc_id=%s for bug_id=%s", doc_id, bug_id)
    return doc_id
