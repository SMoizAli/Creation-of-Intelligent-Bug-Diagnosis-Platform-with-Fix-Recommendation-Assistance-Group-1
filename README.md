# Creation of Intelligent Bug Diagnosis Platform with Fix Recommendation Assistance

*(Formerly: AI Smart Bug Analyzer & Fix Advisor — renamed per Milestone 4 guidance; no change to objectives, implementation, or deliverables.)*

- An AI-powered system that takes bug reports, stack traces, or error logs and uses a multi-agent pipeline combined with a RAG knowledge base of historical  defects to triage, analyze, detect duplicates, and suggest fixes for software bugs  and grows its own knowledge base over time as recommendations are confirmed working.

This is a solo InfosysSpringboard internship project, built entirely in Python by me.

---

## How it works (high level)

> User
>
>   ↓
>
>
> Bug Submission Module  (accepts text paste or file upload)
>
>   ↓
>
>
> [Bug report gets stored + embedded]
>
>   ↓
>
> Multi-Agent Pipeline ──────────────┐
>                                                                              
>   ├─ Triage Agent─────────────────                  │
>                                       
>   ├─ Log Analysis Agent─────────────        │  ←── queries ──→  Historical Defect Knowledge Base (Vector DB / RAG)
>                                       
>   ├─ Root Cause Agent──────────────                                │                                    
>                                       
>   ├─ Duplicate Detection Agent─────                    ←──┘                    
>
>   └─ Remediation Agent
>
>   ↓
>
>
> Structured Findings & Resolution Display
>
> 
>


---

The Multi-Agent Pipeline queries a **Historical Defect Knowledge Base** (built using public bug datasets from Mozilla, Apache, and Eclipse via Kaggle) to find similar past bugs and inform its analysis and fix suggestions.

---

## Tech Stack

- **Language:** Python
- **UI / Bug Submission:** Streamlit
- **Embedding Model:** sentence-transformers (`all-MiniLM-L6-v2`)
- **Vector Similarity Search:** in-memory cosine similarity (`scikit-learn`) over saved embeddings — *(ChromaDB is installed and was used/tested during development; the live app currently does not use it — see Known Limitations)*
- **Chunking:** LangChain text splitters
- **Data Processing:** pandas
- **Agent Orchestration:** Python (custom classes for Milestone 1; may adopt LangChain/CrewAI later)
- **LLM (future remediation generation):** TBD based on access

---

## Project Documentation

Design and research documentation for Milestone 1 (30 June – 9 July):

| Doc | Description |
|---|---|
| [`docs/01_concepts.md`](docs/01_concepts.md) | Study of defect analysis workflows, bug report structure, stack traces, RAG, and semantic similarity |
| [`docs/02_architecture.md`](docs/02_architecture.md) | Overall system architecture, data flow, and tech stack |
| [`docs/03_agents.md`](docs/03_agents.md) | Detailed responsibilities (input/process/output) of all 5 agents |
| [`docs/04_knowledge_base.md`](docs/04_knowledge_base.md) | Historical Defect Knowledge Base record structure and storage design |

---

## Project Structure

docs/         → design documentation and study notes
src/          → application source code (modules, agents)
data/         → datasets (raw and cleaned)
notebooks/    → exploration/testing notebooks (chunking, embeddings, retrieval testing)

---

## Known Limitations
- Historical grounding is weaker for languages underrepresented in the
  original historical dataset (Rust, Go, TypeScript) — improves as the KB
  grows from confirmed live fixes.
- Compound (multi-issue) submissions may produce a combined error_type
  rather than cleanly separated ones.
- Subject to the LLM provider's daily API quota under heavy testing volume.
---


## Status (as of Milestone 4)

- [x] Milestones 1–3: Knowledge base, all 5 agents, full pipeline — complete
- [x] Milestone 4, Task 1: Defect Pattern Analytics Dashboard — complete
- [x] Milestone 4, Task 2: Knowledge Base Growth Mechanism — complete, verified
- [x] Milestone 4, Task 3: End-to-End Testing — partially complete (16/39
      test cases; remainder blocked by LLM provider daily quota — see Testing
      Report for full detail)
- [x] Milestone 4, Task 4: Documentation, project report, final demo
