"""RAG pipeline unit tests."""

import pytest

from app.rag.chunker import TextChunker


def test_text_chunker_splits_content():
    chunker = TextChunker(chunk_size=100, chunk_overlap=10)
    text = "Line one.\n" * 50
    chunks = chunker.split_text(text)
    assert len(chunks) > 1
    for chunk in chunks:
        assert len(chunk) <= 120  # allow slight overflow from separator logic


def test_chunk_with_metadata():
    chunker = TextChunker(chunk_size=200, chunk_overlap=20)
    metadata = {
        "bug_id": "test-123",
        "priority": "high",
        "component": "api",
        "resolution": "",
        "source": "test",
        "date": "2024-01-01",
        "tags": ["error"],
    }
    chunks = chunker.split_with_metadata("Error in module X. " * 30, metadata)
    assert chunks
    assert chunks[0]["metadata"]["bug_id"] == "test-123"
    assert "chunk_index" in chunks[0]["metadata"]


def test_mmr_diversity():
    """MMR should return results without crashing on empty store."""
    pytest.importorskip("chromadb")
    from app.rag.retriever import Retriever

    retriever = Retriever()
    results = retriever.retrieve("NullPointerException login error", top_k=3, use_mmr=True)
    assert isinstance(results, list)


def test_similarity_search():
    pytest.importorskip("chromadb")
    from app.rag.retriever import Retriever

    retriever = Retriever()
    results = retriever.retrieve(
        "database connection timeout",
        top_k=3,
        use_mmr=False,
    )
    assert isinstance(results, list)
