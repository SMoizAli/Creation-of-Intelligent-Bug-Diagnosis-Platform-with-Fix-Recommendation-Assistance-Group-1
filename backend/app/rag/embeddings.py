"""Embedding generation using sentence-transformers."""

from functools import lru_cache
from typing import List

from app.config.settings import get_settings
from app.utils.exceptions import EmbeddingError
from app.utils.logger import get_logger

logger = get_logger("rag.embeddings")


@lru_cache(maxsize=1)
def _load_model():
    """Lazy-load the embedding model (cached singleton)."""
    settings = get_settings()
    try:
        from sentence_transformers import SentenceTransformer

        logger.info("Loading embedding model: %s", settings.embedding_model)
        return SentenceTransformer(settings.embedding_model)
    except Exception as exc:
        logger.error("Failed to load embedding model: %s", exc)
        raise EmbeddingError(
            "Embedding model failed to load.",
            details={"model": settings.embedding_model, "error": str(exc)},
        ) from exc


_embedding_service_instance = None


class EmbeddingService:
    """Generates vector embeddings for text chunks."""

    def __new__(cls):
        global _embedding_service_instance
        if _embedding_service_instance is None:
            _embedding_service_instance = super(EmbeddingService, cls).__new__(cls)
            _embedding_service_instance._initialized = False
        return _embedding_service_instance

    def __init__(self) -> None:
        if self._initialized:
            return
        self._model = None
        self._initialized = True

    @property
    def model(self):
        if self._model is None:
            self._model = _load_model()
        return self._model

    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        try:
            embeddings = self.model.encode(texts, show_progress_bar=False)
            return embeddings.tolist()
        except Exception as exc:
            logger.error("Embedding generation failed: %s", exc)
            raise EmbeddingError(
                "Failed to generate embeddings.",
                details={"error": str(exc)},
            ) from exc

    def embed_query(self, query: str) -> List[float]:
        return self.embed_texts([query])[0]

    def is_available(self) -> bool:
        try:
            _load_model()
            return True
        except EmbeddingError:
            return False
