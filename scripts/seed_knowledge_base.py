"""Seed sample bug reports into ChromaDB and setup dataset folders."""

import json
import sys
from datetime import datetime
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1] / "backend"
PROJECT_ROOT = BACKEND_ROOT.parent
sys.path.insert(0, str(BACKEND_ROOT))

from app.rag.chunker import TextChunker
from app.rag.retriever import Retriever
from app.config.settings import get_settings

# Setup Paths
DATASETS_DIR = PROJECT_ROOT / "datasets"
RAW_DIR = DATASETS_DIR / "raw"
PROCESSED_DIR = DATASETS_DIR / "processed"
UPLOADS_DIR = DATASETS_DIR / "sample_uploads"

# Module directories
MODULES = ["authentication", "payment", "api", "database", "network", "ui"]

SAMPLE_BUGS = [
    {
        "bug_id": "BUG-101",
        "priority": "critical",
        "component": "authentication",
        "resolution": "Fixed null check in token validation helper class.",
        "source": "seed",
        "date": "2024-06-01",
        "tags": ["login", "crash"],
        "filename": "auth_npe.log",
        "text": "ERROR: NullPointerException in AuthService.java line 142 during token parsing. Critical production outage. JWT parsing failed."
    },
    {
        "bug_id": "BUG-102",
        "priority": "high",
        "component": "payment",
        "resolution": "Added auto-retry mechanisms with exponential backoff.",
        "source": "seed",
        "date": "2024-06-15",
        "tags": ["timeout", "gateway"],
        "filename": "pay_timeout.txt",
        "text": "PaymentService processPayment returned HTTP 503. payment-gateway took too long to respond. Intermittent checkout failures."
    },
    {
        "bug_id": "BUG-103",
        "priority": "medium",
        "component": "api",
        "resolution": "Corrected XML payload schema tags mapping.",
        "source": "seed",
        "date": "2024-07-01",
        "tags": ["schema", "parsing"],
        "filename": "api_schema.xml",
        "text": "XML Parsing Error on POST /api/v1/users. Invalid character in payload parsing context. Schema mismatches."
    },
    {
        "bug_id": "BUG-104",
        "priority": "high",
        "component": "database",
        "resolution": "Increased pool max size from 15 to 60.",
        "source": "seed",
        "date": "2024-07-10",
        "tags": ["pool", "exhaustion"],
        "filename": "db_pool.json",
        "text": "java.sql.SQLTransientConnectionException: connection pool exhausted. HikariCP max limit reached under dashboard load."
    },
    {
        "bug_id": "BUG-105",
        "priority": "critical",
        "component": "network",
        "resolution": "Updated certificate authorities and cipher list.",
        "source": "seed",
        "date": "2024-08-01",
        "tags": ["ssl", "security"],
        "filename": "ssl_handshake.txt",
        "text": "javax.net.ssl.SSLHandshakeException: Remote host closed handshake on API Gateway. Production outage affecting iOS clients."
    },
    {
        "bug_id": "BUG-106",
        "priority": "medium",
        "component": "ui",
        "resolution": "Added clearInterval cleanup to useEffect hooks.",
        "source": "seed",
        "date": "2024-08-10",
        "tags": ["react", "memory"],
        "filename": "memory_leak.md",
        "text": "React memory leak in workspace card render. useEffect hook lacks cleanup. DOM node allocations grow unbounded in Chrome."
    },
    {
        "bug_id": "BUG-201",
        "priority": "critical",
        "component": "database",
        "resolution": "Updated SQLite indexing to prevent lock contention.",
        "source": "mozilla",
        "date": "2023-01-15",
        "tags": ["sqlite", "lock", "performance"],
        "filename": "mozilla_db_lock.txt",
        "text": "Database is locked error on sqlite3. OperationalError: database is locked when writing to places.sqlite."
    },
    {
        "bug_id": "BUG-202",
        "priority": "high",
        "component": "ui",
        "resolution": "Fixed SWT widget disposal leak in main loop.",
        "source": "eclipse",
        "date": "2023-03-22",
        "tags": ["swt", "leak", "ui"],
        "filename": "eclipse_swt_leak.txt",
        "text": "org.eclipse.swt.SWTException: Widget is disposed. Stack trace shows failure in display.readAndDispatch()."
    },
    {
        "bug_id": "BUG-203",
        "priority": "medium",
        "component": "api",
        "resolution": "Updated notebook parser to handle newer JSON format versions.",
        "source": "kaggle",
        "date": "2023-08-10",
        "tags": ["notebook", "json", "parser"],
        "filename": "kaggle_notebook.txt",
        "text": "Failed to parse notebook JSON. Unexpected token in JSON at position 1204. Notebook viewer throws 500."
    },
    {
        "bug_id": "BUG-204",
        "priority": "high",
        "component": "network",
        "resolution": "Added retry logic for fetching Git packfiles over HTTP.",
        "source": "software_heritage",
        "date": "2023-11-05",
        "tags": ["git", "network", "timeout"],
        "filename": "swh_git_timeout.txt",
        "text": "Git fetch failed with early EOF. Connection reset by peer during packfile download. Repository mirroring task failed."
    }
]


def create_directories() -> None:
    """Create directory structure for datasets."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    
    for module in MODULES:
        (RAW_DIR / module).mkdir(parents=True, exist_ok=True)
        
    print("Dataset directory structure initialized.")


def write_sample_raw_files() -> None:
    """Write sample raw bug files into module folders."""
    for bug in SAMPLE_BUGS:
        module = bug["component"]
        filename = bug["filename"]
        dest = RAW_DIR / module / filename
        
        # Write text content
        dest.write_text(bug["text"], encoding="utf-8")
        print(f"Created raw bug file: {dest.relative_to(PROJECT_ROOT)}")


def sanitize_text(text: str) -> str:
    """Strip raw JSON syntax to leave clean human-readable text."""
    import re
    # Remove json-like blocks if they exist
    clean = re.sub(r'\{.*?\}|\[.*?\]', '', text, flags=re.DOTALL)
    # If it becomes empty, return original
    if not clean.strip():
        return text
    return " ".join(clean.split())

def main() -> None:
    create_directories()
    write_sample_raw_files()

    print("\nStarting indexing to ChromaDB...")
    settings = get_settings()
    
    chunker = TextChunker()
    retriever = Retriever()
    
    # Clear existing ChromaDB collection safely via API
    try:
        print(f"Clearing existing ChromaDB collection: {settings.chroma_collection}")
        if retriever.vector_store._client:
            try:
                retriever.vector_store._client.delete_collection(settings.chroma_collection)
            except ValueError:
                pass # collection might not exist
            # Re-create it
            retriever.vector_store._collection = retriever.vector_store._client.create_collection(
                name=settings.chroma_collection,
                metadata={"hnsw:space": "cosine"},
            )
    except Exception as e:
        print(f"Failed to clear collection: {e}")

    categories = {}
    for bug in SAMPLE_BUGS:
        text = sanitize_text(bug["text"])
        metadata = {
            "bug_id": bug["bug_id"],
            "priority": bug["priority"],
            "component": bug["component"],
            "resolution": bug["resolution"],
            "source": bug["source"],
            "date": bug["date"],
            "tags": ",".join(bug["tags"]) if isinstance(bug["tags"], list) else bug["tags"],
        }
        
        # Keep track of categories
        comp = bug["component"]
        categories[comp] = categories.get(comp, 0) + 1
        
        chunks = chunker.split_with_metadata(text, metadata)
        retriever.index_bug(bug["bug_id"], chunks)
        print(f"Indexed {bug['bug_id']} into ChromaDB")

    # Persist database and knowledge base status metadata
    status_file = PROJECT_ROOT / "chroma_db" / "status.json"
    status_data = {
        "embedding_model": settings.embedding_model,
        "database_status": "ready",
        "last_indexing_time": datetime.utcnow().isoformat(),
        "total_indexed_bugs": len(SAMPLE_BUGS),
        "collection_size_mb": 0.05,  # small mock
        "storage_used": "51.2 KB",
        "model_version": "v2.0",
        "category_distribution": categories
    }
    
    # Save status
    status_file.parent.mkdir(parents=True, exist_ok=True)
    with status_file.open("w", encoding="utf-8") as f:
        json.dump(status_data, f, indent=2)
        
    print(f"\nSeed complete. Status persisted to {status_file.relative_to(PROJECT_ROOT)}")


if __name__ == "__main__":
    main()
