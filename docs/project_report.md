# Project Report — Creation of Intelligent Bug Diagnosis Platform with Fix Recommendation Assistance

## 1. Introduction
This project is a multi-agent, LLM-powered system that takes a bug report,
stack trace, or error log and produces triage classification, root cause
analysis, duplicate detection, and a concrete fix recommendation — grounded
in a Retrieval-Augmented Generation (RAG) knowledge base of ~56,000 real
historical bugs (Mozilla, Eclipse, Apache), which grows over time as the
system's own recommendations are confirmed working.

## 2. Design

### 2.1 Core design principle
Every design decision in this project followed one rule: decide the
data-quality/business logic question first, write code second. Examples:
deciding how to handle unclassified ("Unknown") submissions before building
analytics; confirming the original KB's exact text-construction format before
writing the growth mechanism, rather than guessing.

### 2.2 Architecture
See `updated_02_architecture.md` for full detail. In summary: a sequential
6-step pipeline (Triage → Log Analysis → Retrieval → Root Cause → Duplicate
Detection → Remediation), followed by a human-confirmation step that decides
whether a resolved bug feeds back into the knowledge base.

### 2.3 Key design decisions and rationale
- **Unknown handling:** LLM classification failures are excluded from
  percentage breakdowns but reported separately as a pipeline-reliability
  metric — treating "the model failed to classify this" and "this bug's
  actual category" as two different kinds of information, not one.
- **Root-cause grouping via semantic clustering, not exact-text matching:**
  chosen specifically because it caught real label inconsistency (e.g. the
  same typo bug labeled both "Cosmetic Typo" and "Typographical Error" by
  the LLM) that exact matching would have missed.
- **KB growth text format matches the original KB exactly** (title-equivalent
  + description, fix text kept in metadata only) — verified against the
  original Milestone 1 notebook rather than assumed, to keep new and old
  entries in the same embedding space.
- **Three-state resolution status** (`resolved_added_to_kb`,
  `resolved_kb_append_failed`, `unresolved`) rather than a binary
  success/fail — because "the fix worked" and "the technical KB write
  succeeded" are independent facts that shouldn't be conflated.

## 3. Implementation Summary

- **Milestone 1:** Bug Submission Module, Historical Defect Knowledge Base
  (data cleaning, chunking, embedding, retrieval), all verified with
  retrieval testing.
- **Milestone 2/3:** Full 5-agent pipeline implemented (Triage, Log Analysis,
  Root Cause, Duplicate Detection, Remediation), wired end-to-end in
  Streamlit, with per-agent error handling so one agent's failure doesn't
  crash the app.
- **Milestone 4:**
  - **Task 1 — Defect Pattern Analytics:** severity/component breakdowns,
    semantic root-cause clustering (threshold chosen from the observed
    similarity distribution, not a default), submission activity tracking,
    full interactive dashboard.
  - **Task 2 — Knowledge Base Growth:** human-confirmed fix outcomes feed
    resolved bugs back into the KB; verified growing from 56,862 to 56,864
    rows with two live-resolved test bugs, cross-validated against an
    independent duplicate-detection result.
  - **Task 3 — End-to-End Testing:** 39-bug test set sampled reproducibly
    (seed=42) across 14 sources (11 languages + Mozilla/Eclipse/Apache);
    16 bugs completed full pipeline testing before hitting a documented
    LLM provider quota limitation (see Results, and full detail in the
    Testing Report).
  - **Task 4 — Documentation and demonstration** (this report and
    accompanying docs).

## 4. Results

Across 16 fully-completed test cases spanning Python, Java, Rust, Go,
TypeScript, PHP, and CSS:
- **0 of 16 showed evidence of hallucination** — every recommended fix
  logically followed from its actual input.
- **11 of 16 fix recommendations matched the expected fix exactly**; the
  remaining 5 were partial matches, none were wrong.
- Historical grounding was consistently weak-to-moderate (similarity scores
  mostly 0.4–0.7), suggesting the knowledge base, while broad, has thinner
  coverage for languages underrepresented in its original historical source
  data (Rust, Go, TypeScript) — a coverage gap that closes naturally over
  time as the KB growth mechanism adds more resolved bugs in those languages.

Full methodology, per-bug results table, and additional documented edge
cases are in the separate End-to-End Testing Report.

## 5. Limitations (disclosed)
- Testing coverage was constrained by the LLM provider's daily token quota
  (Groq on-demand tier, 100,000 tokens/day) — 16 of 39 planned test cases
  completed before quota exhaustion. This is a real operational constraint
  of building on a metered API, not a defect in the system itself.
- Compound bug submissions (multiple unrelated issues pasted as one report)
  can cause the Log Analysis Agent to return a compound, comma-separated
  error_type rather than cleanly separating the issues.
- The KB growth mechanism's load-full-array-then-save approach is adequate
  at current scale (~57,000 rows, seconds per append) but is not the
  approach a much larger production system would use long-term.

## 6. Future Work
- Add automated evaluation (not just manual judgment) for remediation
  quality, to scale testing beyond what a human can manually review.
- Explore chunked/incremental KB storage to remove the load-full-array
  scaling limitation.
- Add explicit handling for compound/multi-issue submissions rather than
  passing them through as one bug.
- With sustained real usage, revisit whether embedding the fix text
  alongside the problem text (rather than keeping it metadata-only) improves
  retrieval quality — this project deliberately did not attempt this without
  proper evaluation, given the timeline.