# Creation of Intelligent Bug Diagnosis Platform with Fix Recommendation Assistance

An intelligent, enterprise-grade multi-agent platform that automatically triages, analyzes, and provides root cause and fix suggestions for software bugs.

---

## Project Overview

When a developer or QA engineer submits a bug (via text or file upload), the system:
1. **Ingests & Triages** raw bug content to classify priority, component, and business impact using multi-agent logic.
2. **Parses Logs** for errors, stack traces, and HTTP signals using dedicated diagnostic agents.
3. **Applies Vector Search & Knowledge Base (Milestone 3)**: Indexes historical bugs into ChromaDB for similarity matching and closed-loop learning.
4. **Performs Defect Pattern Analytics & Business Impact Analysis (Milestone 4)**: Identifies recurring bug themes, high-frequency components, systemic issue patterns, and financial/operational business risks.
5. **Generates Fix Recommendations**: Provides automated code diff previews and hotfix workflows.

---

## Feature Table & Milestones

| Module / Milestone | Location | Function |
|---|---|---|
| **Submission & Triage** | `backend/app/api/`, `backend/app/agents/triage_agent.py` | Accepts bug inputs, validates structures, and runs AI-powered triage. |
| **Log Analysis Agent** | `backend/app/agents/log_analysis_agent.py` | Extracts stack traces, error patterns, and system signals. |
| **Milestone 3: Knowledge Base & RAG** | `backend/app/rag/`, ChromaDB integration | Vectorizes resolved defects, runs similarity searches, and manages historical logs. |
| **Milestone 4: Defect Analytics & BIA** | Frontend Analytics Insights / Backend Metrics | Tracks recurring bug themes, high-frequency components, and Business Impact Analysis (BIA) risks. |
| **API & React Frontend** | `backend/app/main.py`, `frontend/` | Full-stack architecture with interactive dashboards, dark-mode glassmorphic UI, and real-time upload charts. |

---

## Repository Structure

AI-Smart-Bug-Analyzer-And-Fix-Advisor/
├── backend/
│   ├── app/
│   │   ├── agents/          # Triage, log analysis, orchestrator, workflow
│   │   ├── api/             # FastAPI REST endpoints
│   │   ├── config/          # Settings and database configurations
│   │   ├── models/          # Domain and SQLAlchemy models
│   │   ├── rag/             # ChromaDB vector store and MMR retrieval
│   │   ├── schemas/         # Pydantic schemas
│   │   └── services/        # Business logic and processing
│   ├── prompts/             # LLM prompt templates
│   ├── scripts/             # Evaluation and batch scripts
│   └── tests/               # Pytest suite
├── datasets/
│   ├── raw/                 # Raw bug samples
│   └── processed/           # Processed JSON outputs
├── docs/                    # Architecture and user manual
├── frontend/                # React Vite dashboard
└── docker/                  # Docker Compose setup


---

## Setup & Running Guide

### 1. Backend Setup
```bash
cd backend
python -m venv .venv
# Windows
.venv\Scripts\activate
pip install -r requirements.txt
2. Configure Environment
Copy .env.example to .env and configure your LLM provider and database URL.

3. Run Backend Server
Bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
4. Run Frontend Dashboard
Bash
cd frontend
npm install
npm run dev
Dashboard available at: http://localhost:5173

License
Copyright (c) 2025 Vidzai Digital. Licensed under the MIT License.
