# Task 2: System Architecture Design (Updated — Milestone 4)

## 2.1 Overall System Architecture (current, as built)

> User
>   ↓
> Bug Submission Module (Streamlit UI — text paste or file upload)
>   ↓
> [Bug report structured + timestamped]
>   ↓
> Multi-Agent Pipeline (sequential):
>   1. Triage Agent
>   2. Log Analysis Agent
>   3. Retrieval (query Historical Defect Knowledge Base)
>   4. Root Cause Agent (uses retrieved bugs as evidence)
>   5. Duplicate Detection Agent (checks against live SQLite submissions only)
>   6. Remediation Agent (uses root cause + duplicate match + historical refs)
>   ↓
> Save to SQLite (bug_submissions.db) — happens AFTER duplicate check,
> so a bug can never match itself
>   ↓
> Structured Findings Display (Streamlit)
>   ↓
> User confirms outcome: "Fix Worked" or "Fix Did Not Work"
>   ↓
> If worked → Knowledge Base Growth Mechanism appends the resolved
> bug's embedding + metadata back into the KB for future retrieval

This differs from the Milestone 1 design in one key way: the 5-agent pipeline,
originally design-only, is now fully implemented and wired end-to-end, and a
feedback loop (KB growth) has been added that didn't exist in the original
architecture.

## 2.2 Data Flow (updated)

1. **Input** — user pastes bug text or uploads a .txt/.log file via Streamlit.
2. **Structuring** — wrapped into a bug_record dict with a generated bug_id,
   description, stack_trace, and timestamp.
3. **Triage + Log Analysis** — run together via `run_orchestration()`; both
   are independent LLM calls (Groq, llama-3.3-70b-versatile) but bundled into
   one combined result for convenience.
4. **Retrieval** — the submitted text is embedded (sentence-transformers,
   all-MiniLM-L6-v2) and compared via cosine similarity against the full
   Historical Defect Knowledge Base (56,000+ chunks from Mozilla/Eclipse/Apache,
   plus any live-resolved bugs added since).
5. **Root Cause Agent** — takes Triage + Log Analysis output plus the top-N
   retrieved historical bugs, and generates a root cause hypothesis with
   confidence and supporting evidence.
6. **Duplicate Detection Agent** — separately compares the new submission
   against previously-submitted live bugs only (not the historical KB) using
   the same embedding/cosine-similarity approach, with fixed thresholds
   (0.90 = "same", 0.75 = "similar").
7. **Remediation Agent** — synthesizes severity, root cause, duplicate status,
   and historical references into a structured fix recommendation (fix steps,
   before/after code example, validation steps, prevention tip).
8. **Persistence** — the bug is saved to `bug_submissions.db` only after
   duplicate detection has run, specifically so a new bug can never appear as
   its own duplicate.
9. **User feedback loop (new in Milestone 4)** — once a fix is shown, the user
   marks it "Fix Worked" or "Fix Did Not Work." A confirmed working fix is
   embedded and appended to `embeddings_real.npy` / `chunks_metadata.csv`,
   growing the knowledge base for future retrievals — without ever needing to
   recompute the existing ~56,000 embeddings already on disk.

## 2.3 Tech Stack (current)

- **Language:** Python
- **UI:** Streamlit (multi-tab: Submit Bug / Analytics Dashboard, sidebar nav)
- **LLM:** Groq API, model `llama-3.3-70b-versatile`
- **Embedding Model:** sentence-transformers (`all-MiniLM-L6-v2`)
- **Vector Similarity:** in-memory cosine similarity (`scikit-learn`) —
  ChromaDB tested during Milestone 1, not used in the live app (see Known
  Limitations)
- **Clustering (root-cause pattern detection):** `AgglomerativeClustering`
  (scikit-learn), threshold chosen empirically from the observed similarity
  distribution, not a default
- **Persistence:** SQLite (`bug_submissions.db`) for live submissions;
  `.npy` + `.csv` pair for the growing Knowledge Base
- **Visualization:** Plotly (Analytics Dashboard — severity/component pie
  charts, submission activity bar chart)
- **Data Processing:** pandas, numpy

## 2.4 Known Architectural Limitation (disclosed)

`add_resolved_bug_to_kb()` uses a load-full-array → append → save-full-array
approach for growing the KB. At the current scale (~57,000 rows, ~384-dim
vectors) this completes in a few seconds and is not a practical problem, but
it is not the approach a production system at much larger scale would use —
flagged here as known technical debt rather than a hidden limitation.