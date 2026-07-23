"""Retrieval strategies: Similarity Search and MMR."""

from typing import Any, Dict, List, Optional

from app.config.settings import get_settings
from app.rag.vector_store import VectorStore
from app.utils.logger import get_logger

logger = get_logger("rag.retriever")


class Retriever:
    """Unified retrieval interface for RAG pipeline."""

    def __init__(self, vector_store: Optional[VectorStore] = None) -> None:
        self._store = vector_store or VectorStore()
        self._settings = get_settings()

    @property
    def vector_store(self) -> VectorStore:
        return self._store

    def retrieve(
        self,
        query: str,
        top_k: Optional[int] = None,
        use_mmr: bool = True,
        filter_metadata: Optional[Dict[str, str]] = None,
    ) -> List[Dict[str, Any]]:
        k = top_k or self._settings.retrieval_top_k
        logger.info("Retrieving top-%d documents (mmr=%s)", k, use_mmr)

        if use_mmr:
            return self._store.mmr_search(
                query=query,
                top_k=k,
                lambda_param=self._settings.mmr_lambda,
            )
        return self._store.similarity_search(
            query=query,
            top_k=k,
            filter_metadata=filter_metadata,
        )

    def index_bug(
        self,
        bug_id: str,
        chunks: List[Dict[str, Any]],
    ) -> List[str]:
        texts = [c["text"] for c in chunks]
        metadatas = [c["metadata"] for c in chunks]
        return self._store.add_documents(texts, metadatas)
