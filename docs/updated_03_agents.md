# Task 3: Agent Responsibilities (Updated — Milestone 4, as actually implemented)

All 5 agents below are fully coded in `agents.py` and wired into the live
Streamlit pipeline — this is no longer design-only, as it was after Milestone 1.

## Agent 1: Triage Agent
- **Input:** title, description, stack_trace, bug_id
- **What it does:** LLM call (Groq) classifies severity (Critical/High/
  Medium/Low), priority (Immediate/High/Medium/Low), and component, with a
  confidence score and reasoning. The system prompt includes explicit
  calibration examples so the model doesn't over-classify routine bugs as
  urgent just because they contain words like "error."
- **Output:** `{severity, confidence, reasoning, priority, component, bug_id}`
- **Failure handling:** falls back to `{severity: Medium, component: Unknown,
  confidence: 0.0}` if the LLM call fails after retries — this fallback is
  what the Analytics Dashboard's "Unknown rate" metric tracks.

## Agent 2: Log Analysis Agent
- **Input:** raw stack trace / error text (optionally with code context)
- **What it does:** LLM call extracts a specific error_type (not a generic
  category), failure_location, code_path, confidence, and reasoning. The
  system prompt includes 10 few-shot examples covering multiple languages
  (Python, JS, C, C++, Java, CSS, HTML, TypeScript, Go) to keep extraction
  format consistent across languages.
- **Output:** `{error_type, failure_location, code_path, confidence,
  reasoning}`
- **Known edge case (documented from testing):** if a single submission
  contains multiple unrelated bugs concatenated together, this agent may
  return a compound, comma-separated error_type rather than a single value
  — a disclosed limitation, not a crash.

## Agent 3: Root Cause Agent
- **Input:** bug_id, severity, component, error_type, failure_location,
  code_path, plus the top-N historical bugs retrieved from the Knowledge Base
- **What it does:** RAG-based reasoning — generates a root cause hypothesis
  grounded in retrieved historical resolutions, with a confidence score that
  varies realistically (not defaulted to a high value) and supporting
  evidence as a list of `{bug_id, summary}` objects.
- **Output:** `{root_cause_hypothesis, confidence, supporting_evidence}`

## Agent 4: Duplicate Detection Agent
- **Input:** the new bug's description, plus all previously-submitted live
  bugs (SQLite, not the historical KB)
- **What it does:** cosine similarity between the new bug's embedding and
  every stored submission's embedding. Fixed thresholds decide the label:
  ≥0.90 = "same", 0.75–0.89 = "similar", below 0.75 = not flagged. A small
  separate LLM call then writes one human-readable sentence explaining *why*
  two bugs match — it does not decide the label itself, only explains a
  decision already made mathematically.
- **Output:** list of `{bug_id, similarity, label, explanation}`

## Agent 5: Remediation Agent
- **Input:** severity, component, error_type, root_cause, historical
  references, and duplicate_bug info (if any)
- **What it does:** synthesizes everything upstream into a structured fix:
  recommended_fix, fix_steps, a before/after code_example, validation_steps,
  a prevention tip, confidence, reasoning, and references_used. If a
  duplicate was found, it may recommend reusing the already-known fix instead
  of generating a new one from scratch.
- **Output:** full structured remediation object (see `agents.py` for exact
  schema)

## New in Milestone 4: Confirm Fix Outcome (feedback loop)
After Remediation runs, the user is shown two buttons: "Fix Worked" and
"Fix Did Not Work." This isn't a 6th agent — it's a human-in-the-loop
checkpoint that decides whether a bug's data feeds back into the Knowledge
Base:
- **Fix Worked** → the bug's embedding + resolution is appended to the KB
  (`add_resolved_bug_to_kb()`), status recorded as `resolved_added_to_kb`
- **Fix Did Not Work** → status recorded as `unresolved`, nothing added to
  the KB (an unconfirmed fix should never pollute future recommendations)
- **KB append technically fails** (rare, e.g. file write error) → status
  recorded as `resolved_kb_append_failed` — the human confirmation that the
  fix worked is preserved even if the technical write step failed, since
  those are two independent facts.