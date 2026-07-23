"""ChromaDB vector store with metadata persistence."""

import uuid
from typing import Any, Dict, List, Optional

import chromadb
from chromadb.config import Settings as ChromaSettings

from app.config.settings import get_settings
from app.rag.embeddings import EmbeddingService
from app.utils.logger import get_logger

logger = get_logger("rag.vector_store")

METADATA_FIELDS = [
    "bug_id",
    "priority",
    "component",
    "resolution",
    "source",
    "date",
    "tags",
]


_vector_store_instance = None


class VectorStore:
    """Manages ChromaDB collection for bug knowledge base."""

    def __new__(cls):
        global _vector_store_instance
        if _vector_store_instance is None:
            _vector_store_instance = super(VectorStore, cls).__new__(cls)
            _vector_store_instance._initialized = False
        return _vector_store_instance

    def __init__(self) -> None:
        if self._initialized:
            return
        settings = get_settings()
        self._settings = settings
        self._embedding_service = EmbeddingService()
        self._client = None
        self._collection = None
        self._available = False
        try:
            self._client = chromadb.PersistentClient(
                path=str(settings.chroma_path),
                settings=ChromaSettings(anonymized_telemetry=False),
            )
            self._collection = self._client.get_or_create_collection(
                name=settings.chroma_collection,
                metadata={"hnsw:space": "cosine"},
            )
            self._available = True
            logger.info("ChromaDB initialized at %s", settings.chroma_path)
        except Exception as exc:
            logger.error("ChromaDB initialization failed: %s", exc)
            if "malformed" in str(exc).lower() or "sqlite" in str(exc).lower() or "bindings" in str(exc).lower():
                logger.warning("Attempting to recover from malformed database by clearing the persist directory...")
                try:
                    import shutil
                    if settings.chroma_path.exists():
                        shutil.rmtree(settings.chroma_path)
                    settings.chroma_path.mkdir(parents=True, exist_ok=True)
                    # Retry once
                    self._client = chromadb.PersistentClient(
                        path=str(settings.chroma_path),
                        settings=ChromaSettings(anonymized_telemetry=False),
                    )
                    self._collection = self._client.get_or_create_collection(
                        name=settings.chroma_collection,
                        metadata={"hnsw:space": "cosine"},
                    )
                    self._available = True
                    logger.info("ChromaDB recovered and initialized successfully after clearing persist directory.")
                except Exception as retry_exc:
                    logger.error("ChromaDB recovery failed: %s", retry_exc)
            
            if not self._available:
                logger.warning("Vector store running in degraded mode without ChromaDB persistence.")
        self._initialized = True

    @property
    def document_count(self) -> int:
        if not self._available or self._collection is None:
            return 0
        return self._collection.count()

    def is_available(self) -> bool:
        if not self._available or self._collection is None:
            return False
        try:
            _ = self._collection.count()
            return True
        except Exception:
            self._available = False
            return False

    def _sanitize_metadata(self, metadata: Dict[str, Any]) -> Dict[str, Any]:
        """ChromaDB requires scalar metadata values."""
        sanitized: Dict[str, Any] = {}
        for key in METADATA_FIELDS:
            value = metadata.get(key, "")
            if key == "tags" and isinstance(value, list):
                sanitized[key] = ",".join(str(t) for t in value)
            elif value is not None:
                sanitized[key] = str(value)
            else:
                sanitized[key] = ""
        return sanitized

    def add_documents(
        self,
        texts: List[str],
        metadatas: List[Dict[str, Any]],
        ids: Optional[List[str]] = None,
    ) -> List[str]:
        if not texts or not self.is_available() or self._collection is None:
            return []
        doc_ids = ids or [str(uuid.uuid4()) for _ in texts]
        embeddings = self._embedding_service.embed_texts(texts)
        sanitized = [self._sanitize_metadata(m) for m in metadatas]
        self._collection.add(
            ids=doc_ids,
            documents=texts,
            embeddings=embeddings,
            metadatas=sanitized,
        )
        logger.info("Added %d documents to ChromaDB", len(texts))
        return doc_ids

    def similarity_search(
        self,
        query: str,
        top_k: int = 5,
        filter_metadata: Optional[Dict[str, str]] = None,
    ) -> List[Dict[str, Any]]:
        if not self.is_available() or self._collection is None:
            return []
        query_embedding = self._embedding_service.embed_query(query)
        results = self._collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            where=filter_metadata,
            include=["documents", "metadatas", "distances"],
        )
        return self._format_results(results)

    def mmr_search(
        self,
        query: str,
        top_k: int = 5,
        lambda_param: float = 0.7,
        fetch_k: int = 20,
    ) -> List[Dict[str, Any]]:
        """Maximum Marginal Relevancy retrieval for diverse results."""
        if not self.is_available() or self._collection is None:
            return []
        query_embedding = self._embedding_service.embed_query(query)
        results = self._collection.query(
            query_embeddings=[query_embedding],
            n_results=min(fetch_k, max(top_k * 3, 10)),
            include=["documents", "metadatas", "distances", "embeddings"],
        )

        candidates = self._format_results(results, include_embeddings=True)
        if not candidates:
            return []

        selected: List[Dict[str, Any]] = []
        selected_embeddings: List[List[float]] = []

        while len(selected) < top_k and candidates:
            best_score = float("-inf")
            best_idx = 0
            for idx, candidate in enumerate(candidates):
                relevance = 1.0 - candidate.get("distance", 1.0)
                diversity_penalty = 0.0
                if selected_embeddings:
                    emb = candidate.get("embedding", [])
                    for sel_emb in selected_embeddings:
                        diversity_penalty = max(
                            diversity_penalty,
                            self._cosine_similarity(emb, sel_emb),
                        )
                mmr_score = lambda_param * relevance - (1 - lambda_param) * diversity_penalty
                if mmr_score > best_score:
                    best_score = mmr_score
                    best_idx = idx

            chosen = candidates.pop(best_idx)
            embedding = chosen.pop("embedding", None)
            chosen["mmr_score"] = best_score
            selected.append(chosen)
            if embedding is not None:
                selected_embeddings.append(self._to_float_list(embedding))

        return selected

    @staticmethod
    def _to_float_list(value: Any) -> List[float]:
        if value is None:
            return []
        if hasattr(value, "tolist"):
            return value.tolist()
        return list(value)

    @staticmethod
    def _cosine_similarity(a: Any, b: Any) -> float:
        vec_a = VectorStore._to_float_list(a)
        vec_b = VectorStore._to_float_list(b)
        if not vec_a or not vec_b or len(vec_a) != len(vec_b):
            return 0.0
        dot = sum(x * y for x, y in zip(vec_a, vec_b))
        norm_a = sum(x * x for x in vec_a) ** 0.5
        norm_b = sum(x * x for x in vec_b) ** 0.5
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)

    @staticmethod
    def _format_results(
        results: Dict[str, Any],
        include_embeddings: bool = False,
    ) -> List[Dict[str, Any]]:
        formatted: List[Dict[str, Any]] = []
        if not results.get("ids") or not results["ids"][0]:
            return formatted

        for idx, doc_id in enumerate(results["ids"][0]):
            item: Dict[str, Any] = {
                "id": doc_id,
                "text": results["documents"][0][idx] if results.get("documents") else "",
                "metadata": results["metadatas"][0][idx] if results.get("metadatas") else {},
                "distance": results["distances"][0][idx] if results.get("distances") else 0.0,
            }
            if include_embeddings and results.get("embeddings"):
                item["embedding"] = VectorStore._to_float_list(results["embeddings"][0][idx])
            formatted.append(item)
        return formatted
