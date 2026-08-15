# User Guide — Intelligent Bug Diagnosis Platform with Fix Recommendation Assistance

## What this tool does
Paste a bug report, stack trace, or error log, and the system will analyze
it through five specialized AI agents, tell you how serious it is, why it
likely happened, whether it's a duplicate of something already reported, and
what to do to fix it — grounded in a knowledge base of ~56,000 real historical
bugs from Mozilla, Eclipse, and Apache, plus every bug this system has itself
helped resolve.

## Getting started

1. Open the app. You'll see two sections in the left sidebar: **Submit Bug**
   and **Analytics Dashboard**.

2. **Submit Bug tab:**
   - Paste your bug report, stack trace, or error log into the text box (or
     upload a .txt/.log file instead).
   - Adjust the "Number of similar bugs to retrieve" slider if you want more
     or fewer historical comparisons (default: 5).
   - Analysis runs automatically once you paste something — no submit button
     needed.
   - Wait a few seconds while each agent runs (you'll see a spinner for each
     step: Triage, Log Analysis, Retrieval, Root Cause, Duplicate Detection,
     Remediation).

3. **Reading the results:**
   - **Analysis Summary** — severity, priority, and affected component at a
     glance.
   - **Root Cause Analysis** — the system's hypothesis for *why* the bug
     happened, with a confidence score and any historical bugs it used as
     evidence. If confidence is below 0.6, a warning appears — treat this as
     a best guess, not a confirmed diagnosis.
   - **Duplicate Bugs** — any past submissions that closely match this one.
   - **Recommended Fix** — the suggested fix, step-by-step instructions, a
     before/after code example (where applicable), validation steps, and a
     prevention tip.

4. **Confirming the outcome:**
   - After trying the recommended fix, click **✅ Fix Worked** or
     **❌ Fix Did Not Work**.
   - If it worked, the bug is automatically added to the knowledge base —
     future similar bugs will be able to find and learn from it.
   - If it didn't work, nothing is added to the knowledge base — this keeps
     future recommendations from being built on unconfirmed fixes.
   - This choice is permanent per bug — once confirmed, the buttons are
     replaced with a status message.

5. **Analytics Dashboard tab:**
   - Click **Refresh Analytics** to compute current statistics across every
     bug ever submitted.
   - View severity and component breakdowns as pie charts.
   - Expand any **Root Cause Pattern** to see which specific bugs were
     grouped together and why (based on similar underlying causes, not just
     matching error names).
   - Submission Activity shows a simple timeline of when bugs were
     submitted — note this reflects testing/usage activity, not a
     real-world seasonal defect trend, given the current sample size.

## Known limitations (disclosed)
- If a single submission describes multiple unrelated bugs at once, the
  system may return a compound error classification rather than cleanly
  separating them — submit one bug at a time for best results.
- Historical grounding (how closely a new bug matches past ones) tends to be
  weaker for languages less represented in the original historical dataset
  (e.g., Rust, Go) — this improves over time as more bugs in those languages
  are confirmed-fixed and added to the knowledge base.
- The system depends on a metered third-party LLM API; very high submission
  volume in a short window may be temporarily rate-limited.