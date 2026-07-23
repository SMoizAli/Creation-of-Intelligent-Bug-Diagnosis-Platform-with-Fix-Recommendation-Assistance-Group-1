# AI-Smart-Bug-Analyzer-And-Fix-Advisor System Architecture

## 1. Introduction

AI-Smart-Bug-Analyzer-And-Fix-Advisor (AI Smart Bug Analyzer and Fix Advisor) is an intelligent bug analysis platform that combines Retrieval-Augmented Generation (RAG) with a multi-agent orchestration pipeline to triage bugs, detect duplicates, identify root causes, and recommend remediation steps.

This document describes the system design, component interactions, data flows, and extension points for Milestones 2–4.

---

## 2. Architecture Overview

```mermaid
flowchart TB
    subgraph Client Layer
        UI[React Dashboard]
    end

    subgraph API Layer
        GW[FastAPI Gateway]
        EH[Error Handler]
        LOG[Custom Logger]
    end

    subgraph Service Layer
        BS[Bug Service]
        AS[Analysis Service]
        HS[History Service]
        RS[Report Service]
    end

    subgraph Agent Layer
        WO[Workflow Orchestrator]
        TA[Triage Agent]
        LP[Log Parser Agent]
        DA[Duplicate Agent]
        RC[Root Cause Agent]
        RM[Remediation Agent]
        RA[Risk Assessment Agent]
        CA[Confidence Agent]
        EA[Executive Summary Agent]
    end

    subgraph RAG Layer
        CH[Text Chunker]
        EM[Embedding Service]
        VS[Vector Store]
        RT[Retriever - Similarity + MMR]
    end

    subgraph Storage
        CHROMA[(ChromaDB)]
        UPLOADS[(Uploads FS)]
        SQLITE[(SQLite DB - SQLAlchemy)]
    end

    UI --> GW
    GW --> BS & AS & HS & RS
    AS --> WO
    WO --> TA --> LP --> DA --> RC --> RM --> RA --> CA --> EA
    WO --> RT
    RT --> VS --> CHROMA
    CH --> EM --> VS
    BS --> UPLOADS
    BS & AS & HS --> SQLITE
    GW --> EH & LOG
```

---

## 3. Component Design

### 3.1 API Layer (`backend/app/api/`)

| Endpoint | Method | Handler | Description |
|----------|--------|---------|-------------|
| `/submit-bug` | POST | `submit_bug` | Accepts multipart file or form content |
| `/analyze` | POST | `analyze_bug` | Triggers DAG workflow |
| `/history` | GET | `get_history` | Paginated history |
| `/health` | GET | `health_check` | Liveness |
| `/status` | GET | `system_status` | Dependency health |

**Cross-cutting concerns:**
- Centralized exception handling via `register_exception_handlers()`
- Structured logging via Python `logging` module with rotating file handler
- Configuration via `pydantic-settings` reading `.env`

### 3.2 Domain Models (`backend/app/models/`)

| Model | Key Fields |
|-------|------------|
| `Bug` | id, title, raw_content, metadata, status |
| `BugMetadata` | bug_id, priority, component, resolution, source, date, tags |
| `Analysis` | bug_id, triage, log_analysis, duplicate_detection, root_cause, remediation |
| `HistoryEntry` | bug_id, analysis_id, title, priority, summary |
| `AppSettings` | embedding_model, chunk_size, retrieval params |

### 3.3 RAG Pipeline (`backend/app/rag/`)

#### Embedding Model
- **Model:** `sentence-transformers/all-MiniLM-L6-v2`
- **Dimensions:** 384
- **Usage:** Query and document embedding for cosine similarity in ChromaDB

#### Text Chunking
- **Splitter:** `RecursiveCharacterTextSplitter`
- **chunk_size:** 512 (configurable via `.env`)
- **chunk_overlap:** 64

#### Metadata Schema (stored in ChromaDB)
| Field | Type | Description |
|-------|------|-------------|
| bug_id | string | Unique bug identifier |
| priority | string | critical/high/medium/low |
| component | string | Affected module |
| resolution | string | Historical fix description |
| source | string | user_upload, seed, integration |
| date | string | ISO timestamp |
| tags | string | Comma-separated tags |

#### Retrieval Strategies

1. **Similarity Search** – Standard cosine distance query, returns top-K nearest neighbors.
2. **MMR (Maximum Marginal Relevancy)** – Balances relevance vs. diversity using lambda parameter (default 0.7).

### 3.4 Agent Workflow (`backend/app/agents/`)

DAG execution order (strictly sequential):

```mermaid
flowchart LR
    A[Bug Upload] --> B[Triage]
    B --> C[Log Parsing]
    C --> D[Duplicate Detection]
    D --> E[Root Cause]
    E --> F[Remediation]
    F --> G[Complete]
```

| Agent | Prompt Template | Input | Output |
|-------|----------------|-------|--------|
| TriageAgent | `prompts/triage.txt` | bug content, RAG context | priority, component, tags |
| LogParserAgent | — (regex-based) | bug content | errors, stack traces, HTTP codes |
| DuplicateAgent | `prompts/duplicate.txt` | content, context, triage | is_duplicate, matches |
| RootCauseAgent | `prompts/rootcause.txt` | content, logs, context | hypothesis, category |
| RemediationAgent | `prompts/remediation.txt` | root cause, duplicates | fix plan, effort estimate |

### 3.5 Service Layer (`backend/app/services/`)

- **BugService** – Validation, file upload, preprocessing
- **AnalysisService** – Orchestrates workflow, records history
- **HistoryService** – Read-only history queries
- **InMemoryStore** – MVP persistence (replaceable in Milestone 2)

---

## 4. Data Flow

### 4.1 Submit & Analyze Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API
    participant BugSvc as Bug Service
    participant AnalysisSvc as Analysis Service
    participant RAG
    participant ChromaDB
    participant Workflow
    participant Agents

    User->>Frontend: Upload / paste bug
    Frontend->>API: POST /submit-bug
    API->>BugSvc: validate & store
    BugSvc-->>API: Bug + analysis_id
    API-->>Frontend: BugSubmitResponse

    Frontend->>API: POST /analyze
    API->>AnalysisSvc: run_analysis(bug_id)
    AnalysisSvc->>BugSvc: preprocess(bug)
    AnalysisSvc->>Workflow: run(bug, analysis)

    Workflow->>RAG: chunk & embed bug
    RAG->>ChromaDB: add documents
    Workflow->>RAG: retrieve (MMR)
    RAG->>ChromaDB: query
    ChromaDB-->>RAG: similar bugs
    RAG-->>Workflow: context

    loop Each Agent Stage
        Workflow->>Agents: execute(stage)
        Agents-->>Workflow: AgentResult
    end

    Workflow-->>AnalysisSvc: completed Analysis
    AnalysisSvc-->>API: AnalysisResponse
    API-->>Frontend: JSON results
    Frontend-->>User: Results panel
```

### 4.2 Agent Workflow Detail

```mermaid
sequenceDiagram
    participant WO as Orchestrator
    participant TA as Triage
    participant LP as Log Parser
    participant DA as Duplicate
    participant RC as Root Cause
    participant RM as Remediation

    WO->>TA: bug_content, context
    TA-->>WO: priority, component, tags

    WO->>LP: bug_content
    LP-->>WO: errors, stack traces

    WO->>DA: content, context, triage
    DA-->>WO: duplicate matches

    WO->>RC: content, logs, context, triage
    RC-->>WO: root cause hypothesis

    WO->>RM: root_cause, duplicates, context
    RM-->>WO: remediation plan

    WO->>WO: build summary
```

### 4.3 Result Generation Flow

```mermaid
sequenceDiagram
    participant WO as Orchestrator
    participant AS as Analysis Service
    participant Store
    participant API
    participant UI

    WO->>AS: Analysis (all agent outputs)
    AS->>Store: save analysis + history entry
    AS->>AS: build summary string
    AS-->>API: AnalysisResponse
    API-->>UI: JSON
    UI->>UI: Render sections
    UI->>UI: Enable Copy / Download
```

---

## 5. Error Handling Architecture

| Error Type | HTTP Code | error_code | Trigger |
|------------|-----------|------------|---------|
| ValidationError | 422 | VALIDATION_ERROR | Empty content, bad file type/size |
| NotFoundError | 404 | NOT_FOUND | Unknown bug/analysis ID |
| ServiceUnavailableError | 503 | SERVICE_UNAVAILABLE | ChromaDB down |
| EmbeddingError | 503 | EMBEDDING_ERROR | Model load/generation failure |
| LLMTimeoutError | 504 | LLM_TIMEOUT | LLM call exceeds timeout |
| Unhandled | 500 | INTERNAL_ERROR | Unexpected exceptions |

All errors return consistent JSON:

```json
{
  "success": false,
  "error_code": "VALIDATION_ERROR",
  "message": "Human-readable message",
  "details": {}
}
```

---

## 6. Configuration Management

All settings loaded from `.env` via `pydantic-settings`:

| Variable | Default | Purpose |
|----------|---------|---------|
| EMBEDDING_MODEL | all-MiniLM-L6-v2 | Sentence transformer model |
| CHUNK_SIZE | 512 | Text splitter chunk size |
| CHUNK_OVERLAP | 64 | Overlap between chunks |
| CHROMA_PERSIST_DIR | chroma_db | Vector store path |
| RETRIEVAL_TOP_K | 5 | Documents retrieved |
| MMR_LAMBDA | 0.7 | MMR diversity parameter |
| MAX_UPLOAD_SIZE_MB | 10 | File size limit |

---

## 7. Deployment Architecture

```mermaid
flowchart LR
    subgraph Docker Host
        FE[Frontend Container<br/>nginx:80]
        BE[Backend Container<br/>uvicorn:8000]
        VOL1[(uploads/)]
        VOL2[(chroma_db/)]
    end

    User --> FE
    FE -->|/api proxy| BE
    BE --> VOL1
    BE --> VOL2
```

- **Dockerfile:** `docker/Dockerfile` – Python 3.11 slim, installs requirements, runs uvicorn
- **docker-compose.yml:** Backend + frontend with health checks and volume mounts
- **CI:** GitHub Actions runs pytest on push/PR

---

## 8. Testing Strategy

| Suite | Location | Coverage |
|-------|----------|----------|
| API tests | `tests/test_api.py` | All endpoints, submit→analyze flow |
| RAG tests | `tests/test_rag.py` | Chunking, retrieval strategies |

Run: `cd backend && pytest tests/ -v`

---

## 9. Future Milestone Integration (No Structural Changes)

### Milestone 2 – Async + Database

```mermaid
flowchart LR
    API --> Queue[Redis Queue]
    Queue --> Worker[Analysis Worker]
    Worker --> WO[Workflow Orchestrator]
    API --> PG[(PostgreSQL)]
    Worker --> PG
```

- Replace `InMemoryStore` with SQLAlchemy repositories implementing same interface
- Move `run_analysis()` to background worker; add `GET /analysis/{id}/status`
- Agent and RAG modules unchanged

### Milestone 3 – Kubernetes + Observability

- Helm chart wraps existing Docker images
- OpenTelemetry spans injected at orchestrator stage boundaries
- ChromaDB → managed vector DB via config swap in `VectorStore`

### Milestone 4 – Enterprise Integrations

```mermaid
flowchart LR
    Jira --> Adapter[Integration Adapter]
    Adapter --> BugService
    WO --> Feedback[Feedback Loop]
    Feedback --> RAG
```

- New `/services/integrations/` adapters feed `BugService.create_bug_from_text()`
- SSO middleware added at API layer only
- Fine-tuned embeddings configured via `EMBEDDING_MODEL` env var

---

## 10. Security Considerations

- File upload validation (extension whitelist, size limit)
- CORS restricted to configured origins
- Secrets via `.env` (never committed)
- Upload directory outside web root
- Optional LLM API key for production agent reasoning

---

## 11. Directory Reference

| Path | Responsibility |
|------|----------------|
| `backend/app/api/` | HTTP routes |
| `backend/app/services/` | Business logic |
| `backend/app/models/` | Domain entities |
| `backend/app/schemas/` | API contracts |
| `backend/app/agents/` | Agent implementations + orchestrator |
| `backend/app/rag/` | Embeddings, chunking, vector store, retrieval |
| `backend/app/config/` | Settings |
| `backend/app/utils/` | Logging, exceptions |
| `backend/prompts/` | LLM prompt templates |
| `backend/tests/` | pytest |
| `frontend/` | React UI |
| `docs/` | Documentation |
| `docker/` | Container definitions |
| `scripts/` | Seed and utility scripts |
| `.github/` | CI workflows |
