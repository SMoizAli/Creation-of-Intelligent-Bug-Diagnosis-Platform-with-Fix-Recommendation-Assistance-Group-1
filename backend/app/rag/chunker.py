"""Text chunking with RecursiveCharacterTextSplitter."""

from typing import Any, Dict, List

from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.config.settings import get_settings
from app.utils.logger import get_logger

logger = get_logger("rag.chunker")


class TextChunker:
    """Splits bug reports into overlapping chunks for embedding."""

    def __init__(
        self,
        chunk_size: int | None = None,
        chunk_overlap: int | None = None,
    ) -> None:
        settings = get_settings()
        self.chunk_size = chunk_size or settings.chunk_size
        self.chunk_overlap = chunk_overlap or settings.chunk_overlap
        self._splitter = RecursiveCharacterTextSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
            length_function=len,
            separators=["\n\n", "\n", ". ", " ", ""],
        )

    def split_text(self, text: str, max_chunks: int = 12) -> List[str]:
        if not text.strip():
            return []
        chunks = self._splitter.split_text(text)
        if len(chunks) > max_chunks:
            chunks = chunks[:max_chunks]
        logger.debug("Split text into %d chunks", len(chunks))
        return chunks

    def split_with_metadata(
        self,
        text: str,
        metadata: Dict[str, Any],
        max_chunks: int = 12,
    ) -> List[Dict[str, Any]]:
        """Return chunks enriched with bug metadata."""
        chunks = self.split_text(text, max_chunks=max_chunks)
        return [
            {
                "text": chunk,
                "metadata": {
                    **metadata,
                    "chunk_index": idx,
                    "total_chunks": len(chunks),
                },
            }
            for idx, chunk in enumerate(chunks)
        ]
