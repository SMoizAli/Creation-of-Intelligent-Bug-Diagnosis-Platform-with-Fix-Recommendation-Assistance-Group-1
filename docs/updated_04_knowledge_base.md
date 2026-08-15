# Task 4: Knowledge Base Design (Updated — Milestone 4: Growth Mechanism)

## Part 1: Original Record Structure (unchanged from Milestone 1)

| Field | Purpose | Example |
|---|---|---|
| bug_id | unique ID | Apc-2013 |
| title | short summary | "App crashes when login" |
| severity | how serious | Critical/Low |
| resolution | how it was fixed | "Added null check..." |
| status | fixed/open/wontfix | Fixed |
| source_dataset | which dataset this came from | Mozilla / Eclipse / Apache / **live_submissions (new)** |

**Note:** the original chunking pipeline embedded `title + ". " + description`
(capped at 3000 characters, then chunked) — the raw chunk text itself is not
preserved in the exported `chunks_metadata.csv`, only its resulting vector in
`embeddings_real.npy` and its metadata columns above. This was confirmed by
inspecting the original Milestone 1 notebook, not assumed.

## Part 2: Knowledge Base Growth Mechanism (new, Milestone 4)

When a user confirms a fix worked, `add_resolved_bug_to_kb()`:

1. Builds text in the **same format** as the original KB
   (`error_type + ". " + description` — `error_type` stands in for "title"
   since live submissions don't have a separate title field), to keep new
   entries in the same embedding space as the original ~56,000 chunks.
2. Embeds that text with the same model (`all-MiniLM-L6-v2`).
3. Appends the new vector to `embeddings_real.npy` and a new row to
   `chunks_metadata.csv`, with `source_dataset = "live_submissions"` so
   these entries are always traceable back to real usage, not the original
   historical import.
4. Saves both files back to disk. Critically, this **never recomputes the
   existing ~56,000 embeddings** — only the one new vector is computed and
   appended, keeping the operation fast (seconds, not minutes) regardless of
   how large the KB already is.

**Deliberate design decision:** the fix text itself (`resolution`) is stored
only in metadata, never embedded into the search vector — this exactly
mirrors the original KB's design, where `resolution` was always a separate
metadata column, never part of the embedded `full_text`. An alternative
(embedding problem+fix together) was considered and rejected for this
project, since mixing two different kinds of text into one vector risks
diluting retrieval quality, and validating that tradeoff properly would need
its own evaluation beyond this project's timeline.

## Part 3: Verified Growth (real evidence)

KB size grew from 56,862 rows (Milestone 1 baseline) to 56,864 after two
live-resolved test bugs were confirmed. Cross-validation: a bug marked as a
100% duplicate by the Duplicate Detection Agent was, independently, grouped
into the same root-cause cluster by the unrelated Analytics clustering
process — two separate parts of the system reaching the same conclusion
through different math, without being designed to check each other.

## Part 4: Cache Invalidation (practical detail)

The Streamlit app caches the KB embeddings/metadata in memory
(`@st.cache_resource`) for performance. After a successful KB append,
`st.cache_resource.clear()` is called so the newly-added entry is searchable
immediately, in the same session — without this, growth would only become
visible after restarting the app.