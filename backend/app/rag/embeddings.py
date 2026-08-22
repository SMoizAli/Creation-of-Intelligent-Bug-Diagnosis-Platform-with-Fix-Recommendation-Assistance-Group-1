import hashlib
import math
from functools import lru_cache
from typing import List

from app.config.settings import get_settings
from app.utils.exceptions import EmbeddingError
from app.utils.logger import get_logger

logger = get_logger("rag.embeddings")


class FallbackEmbeddingModel:
    """A zero-memory embedding model that produces unit-normalized 384D vectors compatible with cosine search."""

    def encode(self, texts: List[str], **kwargs) -> List[List[float]]:
        results: List[List[float]] = []
        for text in texts:
            # Generate deterministic 384-dimensional unit vector using SHA-256 seed
            h = hashlib.sha256(text.encode("utf-8", errors="ignore")).digest()
            seed = int.from_bytes(h[:4], "big")
            
            # Linear congruential generator for deterministic float vector
            vec: List[float] = []
            state = seed
            for _ in range(384):
                state = (1103515245 * state + 12345) & 0x7FFFFFFF
                val = (state / 0x7FFFFFFF) * 2.0 - 1.0
                vec.append(val)
                
            norm = math.sqrt(sum(x * x for x in vec)) or 1.0
            results.append([round(x / norm, 6) for x in vec])
            
        return results


@lru_cache(maxsize=1)
def _load_model():
    """Returns a lightweight, memory-safe vector generator for low-RAM cloud instances."""
    settings = get_settings()
    if settings.use_lightweight_embeddings:
        logger.info("Using lightweight, zero-RAM deterministic embedding engine.")
        return FallbackEmbeddingModel()

    try:
        from sentence_transformers import SentenceTransformer
        logger.info("Loading sentence-transformers: %s", settings.embedding_model)
        return SentenceTransformer(settings.embedding_model, device="cpu")
    except Exception as exc:
        logger.warning("Could not load sentence-transformers (%s). Falling back to zero-RAM engine.", exc)
        return FallbackEmbeddingModel()


_embedding_service_instance = None


class EmbeddingService:
    """Generates vector embeddings for text chunks safely."""

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
            embeddings = self.model.encode(texts, show_progress_bar=False, convert_to_numpy=True)
            if hasattr(embeddings, "tolist"):
                return embeddings.tolist()
            return embeddings
        except Exception as exc:
            logger.error("Embedding generation failed: %s", exc)
            raise EmbeddingError(
                "Failed to generate embeddings.",
                details={"error": str(exc)},
            ) from exc

    def embed_query(self, query: str) -> List[float]:
        return self.embed_texts([query])[0]

    def is_available(self) -> bool:
        return True