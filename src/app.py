# import streamlit as st
# import uuid
# from datetime import datetime
# import numpy as np
# import pandas as pd
# import os
# import sys
# from sentence_transformers import SentenceTransformer
# from sklearn.metrics.pairwise import cosine_similarity
# import sqlite3
# import plotly.express as px


# sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# from agents import (
#     run_orchestration, build_simple_view, init_db, save_submission,
#     retrieve_similar_bugs, root_cause_agent,
#     duplicate_detection_agent, remediation_agent,
#     COMPONENT_MERGE_MAP, compute_defect_analytics, cluster_root_causes,
#     add_resolved_bug_to_kb
# )

# init_db()

# st.markdown(
#     """
#     <style>
#     .stApp {
#         border: 8px solid #2E7D32;
#     }
#     </style>
#     """,
#     unsafe_allow_html=True
# )

# tab1, tab2 = st.tabs(["Submit Bug", "Analytics Dashboard"])

# with tab1:
#     # ... ALL of your existing app.py content from st.title() down to the final
#     # "Similar Past Bugs" section goes here, indented one level inside this block

#     st.title("Creation of Intelligent Bug Diagnosis Platform with Fix Recommendation Assistance ")
#     st.write("Paste your bug report or stack trace below - analysis runs automatically.")


#     @st.cache_resource
#     def load_retrieval_components():
#         base_dir = os.path.dirname(os.path.abspath(__file__))
#         model = SentenceTransformer('all-MiniLM-L6-v2')
#         embeddings = np.load(os.path.join(base_dir, "embeddings_real.npy"))
#         metadata = pd.read_csv(os.path.join(base_dir, "chunks_metadata.csv"))
#         return model, embeddings, metadata


#     model, kb_embeddings, kb_metadata = load_retrieval_components()

#     bug_report = st.text_area("Bug Report / Stack Trace", height=200, key="bug_report_input")
#     uploaded_file = st.file_uploader("Or upload a bug report file", type=["txt", "log"], key="bug_file_uploader")

#     top_n = st.slider(
#         "Number of similar bugs to retrieve (used for Root Cause and Duplicate Detection)",
#         min_value=3, max_value=15, value=5, key="top_n_slider"
#     )

#     final_text = ""
#     if uploaded_file is not None:
#         final_text = uploaded_file.read().decode("utf-8")
#     elif bug_report.strip() != "":
#         final_text = bug_report.strip()

#     if "last_analyzed_text" not in st.session_state:
#         st.session_state.last_analyzed_text = ""
#     if "last_top_n" not in st.session_state:
#         st.session_state.last_top_n = top_n
#     if "combined_result" not in st.session_state:
#         st.session_state.combined_result = None
#     if "bug_record" not in st.session_state:
#         st.session_state.bug_record = None
#     if "retrieved_bugs" not in st.session_state:
#         st.session_state.retrieved_bugs = []
#     if "root_cause_result" not in st.session_state:
#         st.session_state.root_cause_result = None
#     if "duplicate_result" not in st.session_state:
#         st.session_state.duplicate_result = []
#     if "remediation_result" not in st.session_state:
#         st.session_state.remediation_result = None

#     should_analyze = (
#         final_text != "" and
#         (final_text != st.session_state.last_analyzed_text or top_n != st.session_state.last_top_n)
#     )

#     if final_text == "":
#         st.info("Waiting for a bug report to be pasted or uploaded...")

#     elif should_analyze:
#         st.session_state.last_analyzed_text = final_text
#         st.session_state.last_top_n = top_n

#         bug_record = {
#             "bug_id": "BUG-" + str(uuid.uuid4())[:8],
#             "description": final_text,
#             "stack_trace": final_text,
#             "timestamp": datetime.now().isoformat(),
#             "source": "user_submission"
#         }
#         st.session_state.bug_record = bug_record

#         # --- Step 1: Triage + Log Analysis (save_submission deliberately NOT called yet) ---
#         with st.spinner("Running Triage and Log Analysis..."):
#             combined_result = run_orchestration(
#                 title=final_text[:80],
#                 description=final_text,
#                 stack_trace=final_text,
#                 bug_id=bug_record["bug_id"]
#             )
#             st.session_state.combined_result = combined_result

#         triage_result = combined_result["triage"]
#         log_result = combined_result["log_analysis"]

#         # --- Step 2: Retrieve similar historical bugs (Milestone 1 KB) ---
#         with st.spinner("Retrieving similar historical bugs..."):
#             try:
#                 retrieved_bugs = retrieve_similar_bugs(
#                     final_text, model, kb_embeddings, kb_metadata, top_n=top_n
#                 )
#             except Exception as e:
#                 retrieved_bugs = []
#                 st.session_state.retrieval_error = str(e)
#             st.session_state.retrieved_bugs = retrieved_bugs

#         # --- Step 3: Root Cause Agent ---
#         with st.spinner("Analyzing root cause..."):
#             try:
#                 root_cause_result = root_cause_agent(
#                     bug_id=bug_record["bug_id"],
#                     severity=triage_result["severity"],
#                     component=triage_result["component"],
#                     error_type=log_result["error_type"],
#                     failure_location=log_result["failure_location"],
#                     code_path=log_result["code_path"],
#                     retrieved_bugs=retrieved_bugs
#                 )
#             except Exception as e:
#                 root_cause_result = {
#                     "root_cause_hypothesis": "Root cause analysis could not be completed due to a system error.",
#                     "confidence": 0.0,
#                     "supporting_evidence": [],
#                     "error": str(e)
#                 }
#             st.session_state.root_cause_result = root_cause_result

#         # --- Step 4: Duplicate Detection Agent (SQLite still does NOT contain this bug yet) ---
#         with st.spinner("Checking for duplicate submissions..."):
#             try:
#                 duplicate_result = duplicate_detection_agent(
#                     new_description=final_text,
#                     error_type=log_result["error_type"],
#                     component=triage_result["component"],
#                     reasoning=log_result["reasoning"],
#                     model=model,
#                     top_n=top_n
#                 )
#             except Exception as e:
#                 duplicate_result = []
#                 st.session_state.duplicate_error = str(e)
#             st.session_state.duplicate_result = duplicate_result

#         # --- Step 5: Remediation Agent ---
#         with st.spinner("Generating fix recommendation..."):
#             try:
#                 remediation_result = remediation_agent(
#                     bug_id=bug_record["bug_id"],
#                     severity=triage_result["severity"],
#                     component=triage_result["component"],
#                     error_type=log_result["error_type"],
#                     failure_location=log_result["failure_location"],
#                     code_path=log_result["code_path"],
#                     description=final_text,
#                     root_cause=root_cause_result["root_cause_hypothesis"],
#                     historical_references=root_cause_result["supporting_evidence"],
#                     duplicate_bug=duplicate_result if duplicate_result else None
#                 )
#             except Exception as e:
#                 remediation_result = {
#                     "recommended_fix": "A fix recommendation could not be generated due to a system error.",
#                     "fix_steps": [], "code_example": {}, "validation_steps": [],
#                     "prevention": "", "confidence": 0.0,
#                     "reasoning": "Remediation agent failed.", "references_used": [],
#                     "error": str(e)
#                 }
#             st.session_state.remediation_result = remediation_result

#         # --- Step 6: NOW save to SQLite — after duplicate detection, so this bug can't match itself ---
#         with st.spinner("Saving submission..."):
#             simple_view_for_db = build_simple_view(combined_result)
#             save_submission(
#                 simple_view_for_db,
#                 bug_record["description"],
#                 bug_record["timestamp"],
#                 root_cause_hypothesis=root_cause_result["root_cause_hypothesis"],
#                 recommended_fix=remediation_result["recommended_fix"]
#             )

#     # --- Display results (uses whatever was last analyzed, from session_state) ---
#     if st.session_state.combined_result is not None:
#         bug_record = st.session_state.bug_record
#         combined_result = st.session_state.combined_result
#         simple_view = build_simple_view(combined_result)
#         retrieved_bugs = st.session_state.retrieved_bugs
#         root_cause_result = st.session_state.root_cause_result
#         duplicate_result = st.session_state.duplicate_result
#         remediation_result = st.session_state.remediation_result

#         st.success("Bug report received and analyzed")

#         st.subheader("Analysis Summary")

#         col1, col2, col3 = st.columns(3)
#         col1.metric("Severity", simple_view["severity"])
#         col2.metric("Priority", simple_view["priority"])
#         col3.metric("Component", simple_view["component"])

#         st.write(f"**Error Type:** {simple_view['error_type']}")
#         st.write(f"**Failure Location:** {simple_view['failure_location']}")

#         if root_cause_result:
#             hyp = root_cause_result['root_cause_hypothesis']
#             st.write(f"**Root Cause (summary):** {hyp[:150]}{'...' if len(hyp) > 150 else ''}")

#         if duplicate_result:
#             st.write(f"**Duplicates Found:** {len(duplicate_result)} similar past submission(s)")
#         else:
#             st.write("**Duplicates Found:** None — this appears to be a new issue")

#         if remediation_result:
#             fix = remediation_result['recommended_fix']
#             st.write(f"**Recommended Fix (summary):** {fix[:150]}{'...' if len(fix) > 150 else ''}")

#         if st.button("Show full details (all agents)", key="show_full_details"):
#             st.subheader("Full Combined Result (Triage + Log Analysis)")
#             st.json(combined_result)
#             st.subheader("Full Root Cause Result")
#             st.json(root_cause_result)
#             st.subheader("Full Duplicate Detection Result")
#             st.json(duplicate_result)
#             st.subheader("Full Remediation Result")
#             st.json(remediation_result)

#         st.divider()

        

#         st.subheader("Root Cause Analysis")
#         if root_cause_result:
#             confidence = root_cause_result.get("confidence", 0.0)
#             st.write(f"**Hypothesis:** {root_cause_result['root_cause_hypothesis']}")
#             st.write(f"**Confidence:** {confidence:.2f}")
#             if confidence < 0.6:
#                 st.warning("Limited historical evidence available — this is a best-guess hypothesis, not a confirmed cause.")
#             if root_cause_result.get("supporting_evidence"):
#                 st.write("**Supporting Evidence:**")
#                 for ev in root_cause_result["supporting_evidence"]:
#                     st.write(f"- `{ev['bug_id']}` — {ev['summary']}")
#             else:
#                 st.write("No supporting historical evidence was found for this hypothesis.")

#         st.divider()

#         st.subheader("Duplicate Bugs")
#         if duplicate_result:
#             for d in duplicate_result:
#                 st.write(f"**`{d['bug_id']}`** — {d['label'].upper()} match ({d['similarity']*100:.1f}% similar)")
#                 st.write(d["explanation"])
#                 st.write("---")
#         else:
#             st.info("No similar past submissions found — this appears to be a new issue.")

#         st.divider()

#         st.subheader("Recommended Fix")
#         if remediation_result:
#             st.write(f"**{remediation_result['recommended_fix']}**")
#             st.write(f"**Confidence:** {remediation_result.get('confidence', 0.0):.2f}")

#             if remediation_result.get("fix_steps"):
#                 st.write("**Fix Steps:**")
#                 for i, step in enumerate(remediation_result["fix_steps"], 1):
#                     st.write(f"{i}. {step}")

#             if remediation_result.get("code_example"):
#                 ce = remediation_result["code_example"]
#                 if ce.get("before") or ce.get("after"):
#                     col_before, col_after = st.columns(2)
#                     with col_before:
#                         st.write("**Before:**")
#                         st.code(ce.get("before", ""))
#                     with col_after:
#                         st.write("**After:**")
#                         st.code(ce.get("after", ""))

#             if remediation_result.get("validation_steps"):
#                 st.write("**Validation Steps:**")
#                 for step in remediation_result["validation_steps"]:
#                     st.write(f"- {step}")

#             if remediation_result.get("prevention"):
#                 st.write(f"**Prevention Tip:** {remediation_result['prevention']}")

#             if remediation_result.get("reasoning"):
#                 st.write(f"**Reasoning:** {remediation_result['reasoning']}")

#             if remediation_result.get("references_used"):
#                 st.write("**References Used:**")
#                 for ref in remediation_result["references_used"]:
#                     match_info = f" ({ref['match']}, {ref['similarity']*100:.0f}%)" if "match" in ref else ""
#                     st.write(f"- `{ref['bug_id']}`{match_info} — {ref.get('summary', '')}")
                
#             import streamlit as st
# import uuid
# from datetime import datetime
# import numpy as np
# import pandas as pd
# import os
# import sys
# from sentence_transformers import SentenceTransformer
# from sklearn.metrics.pairwise import cosine_similarity
# import sqlite3
# import plotly.express as px


# sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# from agents import (
#     run_orchestration, build_simple_view, init_db, save_submission,
#     retrieve_similar_bugs, root_cause_agent,
#     duplicate_detection_agent, remediation_agent,
#     COMPONENT_MERGE_MAP, compute_defect_analytics, cluster_root_causes,
#     add_resolved_bug_to_kb
# )

# init_db()

# st.markdown(
#     """
#     <style>
#     .stApp {
#         border: 8px solid #2E7D32;
#     }
#     </style>
#     """,
#     unsafe_allow_html=True
# )

# tab1, tab2 = st.tabs(["Submit Bug", "Analytics Dashboard"])

# with tab1:
#     # ... ALL of your existing app.py content from st.title() down to the final
#     # "Similar Past Bugs" section goes here, indented one level inside this block

#     st.title("Creation of Intelligent Bug Diagnosis Platform with Fix Recommendation Assistance ")
#     st.write("Paste your bug report or stack trace below - analysis runs automatically.")


#     @st.cache_resource
#     def load_retrieval_components():
#         base_dir = os.path.dirname(os.path.abspath(__file__))
#         model = SentenceTransformer('all-MiniLM-L6-v2')
#         embeddings = np.load(os.path.join(base_dir, "embeddings_real.npy"))
#         metadata = pd.read_csv(os.path.join(base_dir, "chunks_metadata.csv"))
#         return model, embeddings, metadata


#     model, kb_embeddings, kb_metadata = load_retrieval_components()

#     bug_report = st.text_area("Bug Report / Stack Trace", height=200, key="bug_report_input")
#     uploaded_file = st.file_uploader("Or upload a bug report file", type=["txt", "log"], key="bug_file_uploader")

#     top_n = st.slider(
#         "Number of similar bugs to retrieve (used for Root Cause and Duplicate Detection)",
#         min_value=3, max_value=15, value=5, key="top_n_slider"
#     )

#     final_text = ""
#     if uploaded_file is not None:
#         final_text = uploaded_file.read().decode("utf-8")
#     elif bug_report.strip() != "":
#         final_text = bug_report.strip()

#     if "last_analyzed_text" not in st.session_state:
#         st.session_state.last_analyzed_text = ""
#     if "last_top_n" not in st.session_state:
#         st.session_state.last_top_n = top_n
#     if "combined_result" not in st.session_state:
#         st.session_state.combined_result = None
#     if "bug_record" not in st.session_state:
#         st.session_state.bug_record = None
#     if "retrieved_bugs" not in st.session_state:
#         st.session_state.retrieved_bugs = []
#     if "root_cause_result" not in st.session_state:
#         st.session_state.root_cause_result = None
#     if "duplicate_result" not in st.session_state:
#         st.session_state.duplicate_result = []
#     if "remediation_result" not in st.session_state:
#         st.session_state.remediation_result = None

#     should_analyze = (
#         final_text != "" and
#         (final_text != st.session_state.last_analyzed_text or top_n != st.session_state.last_top_n)
#     )

#     if final_text == "":
#         st.info("Waiting for a bug report to be pasted or uploaded...")

#     elif should_analyze:
#         st.session_state.last_analyzed_text = final_text
#         st.session_state.last_top_n = top_n

#         bug_record = {
#             "bug_id": "BUG-" + str(uuid.uuid4())[:8],
#             "description": final_text,
#             "stack_trace": final_text,
#             "timestamp": datetime.now().isoformat(),
#             "source": "user_submission"
#         }
#         st.session_state.bug_record = bug_record

#         # --- Step 1: Triage + Log Analysis (save_submission deliberately NOT called yet) ---
#         with st.spinner("Running Triage and Log Analysis..."):
#             combined_result = run_orchestration(
#                 title=final_text[:80],
#                 description=final_text,
#                 stack_trace=final_text,
#                 bug_id=bug_record["bug_id"]
#             )
#             st.session_state.combined_result = combined_result

#         triage_result = combined_result["triage"]
#         log_result = combined_result["log_analysis"]

#         # --- Step 2: Retrieve similar historical bugs (Milestone 1 KB) ---
#         with st.spinner("Retrieving similar historical bugs..."):
#             try:
#                 retrieved_bugs = retrieve_similar_bugs(
#                     final_text, model, kb_embeddings, kb_metadata, top_n=top_n
#                 )
#             except Exception as e:
#                 retrieved_bugs = []
#                 st.session_state.retrieval_error = str(e)
#             st.session_state.retrieved_bugs = retrieved_bugs

#         # --- Step 3: Root Cause Agent ---
#         with st.spinner("Analyzing root cause..."):
#             try:
#                 root_cause_result = root_cause_agent(
#                     bug_id=bug_record["bug_id"],
#                     severity=triage_result["severity"],
#                     component=triage_result["component"],
#                     error_type=log_result["error_type"],
#                     failure_location=log_result["failure_location"],
#                     code_path=log_result["code_path"],
#                     retrieved_bugs=retrieved_bugs
#                 )
#             except Exception as e:
#                 root_cause_result = {
#                     "root_cause_hypothesis": "Root cause analysis could not be completed due to a system error.",
#                     "confidence": 0.0,
#                     "supporting_evidence": [],
#                     "error": str(e)
#                 }
#             st.session_state.root_cause_result = root_cause_result

#         # --- Step 4: Duplicate Detection Agent (SQLite still does NOT contain this bug yet) ---
#         with st.spinner("Checking for duplicate submissions..."):
#             try:
#                 duplicate_result = duplicate_detection_agent(
#                     new_description=final_text,
#                     error_type=log_result["error_type"],
#                     component=triage_result["component"],
#                     reasoning=log_result["reasoning"],
#                     model=model,
#                     top_n=top_n
#                 )
#             except Exception as e:
#                 duplicate_result = []
#                 st.session_state.duplicate_error = str(e)
#             st.session_state.duplicate_result = duplicate_result

#         # --- Step 5: Remediation Agent ---
#         with st.spinner("Generating fix recommendation..."):
#             try:
#                 remediation_result = remediation_agent(
#                     bug_id=bug_record["bug_id"],
#                     severity=triage_result["severity"],
#                     component=triage_result["component"],
#                     error_type=log_result["error_type"],
#                     failure_location=log_result["failure_location"],
#                     code_path=log_result["code_path"],
#                     description=final_text,
#                     root_cause=root_cause_result["root_cause_hypothesis"],
#                     historical_references=root_cause_result["supporting_evidence"],
#                     duplicate_bug=duplicate_result if duplicate_result else None
#                 )
#             except Exception as e:
#                 remediation_result = {
#                     "recommended_fix": "A fix recommendation could not be generated due to a system error.",
#                     "fix_steps": [], "code_example": {}, "validation_steps": [],
#                     "prevention": "", "confidence": 0.0,
#                     "reasoning": "Remediation agent failed.", "references_used": [],
#                     "error": str(e)
#                 }
#             st.session_state.remediation_result = remediation_result

#         # --- Step 6: NOW save to SQLite — after duplicate detection, so this bug can't match itself ---
#         with st.spinner("Saving submission..."):
#             simple_view_for_db = build_simple_view(combined_result)
#             save_submission(
#                 simple_view_for_db,
#                 bug_record["description"],
#                 bug_record["timestamp"],
#                 root_cause_hypothesis=root_cause_result["root_cause_hypothesis"],
#                 recommended_fix=remediation_result["recommended_fix"]
#             )

#     # --- Display results (uses whatever was last analyzed, from session_state) ---
#     if st.session_state.combined_result is not None:
#         bug_record = st.session_state.bug_record
#         combined_result = st.session_state.combined_result
#         simple_view = build_simple_view(combined_result)
#         retrieved_bugs = st.session_state.retrieved_bugs
#         root_cause_result = st.session_state.root_cause_result
#         duplicate_result = st.session_state.duplicate_result
#         remediation_result = st.session_state.remediation_result

#         st.success("Bug report received and analyzed")

#         st.subheader("Analysis Summary")

#         col1, col2, col3 = st.columns(3)
#         col1.metric("Severity", simple_view["severity"])
#         col2.metric("Priority", simple_view["priority"])
#         col3.metric("Component", simple_view["component"])

#         st.write(f"**Error Type:** {simple_view['error_type']}")
#         st.write(f"**Failure Location:** {simple_view['failure_location']}")

#         if root_cause_result:
#             hyp = root_cause_result['root_cause_hypothesis']
#             st.write(f"**Root Cause (summary):** {hyp[:150]}{'...' if len(hyp) > 150 else ''}")

#         if duplicate_result:
#             st.write(f"**Duplicates Found:** {len(duplicate_result)} similar past submission(s)")
#         else:
#             st.write("**Duplicates Found:** None — this appears to be a new issue")

#         if remediation_result:
#             fix = remediation_result['recommended_fix']
#             st.write(f"**Recommended Fix (summary):** {fix[:150]}{'...' if len(fix) > 150 else ''}")

#         if st.button("Show full details (all agents)", key="show_full_details"):
#             st.subheader("Full Combined Result (Triage + Log Analysis)")
#             st.json(combined_result)
#             st.subheader("Full Root Cause Result")
#             st.json(root_cause_result)
#             st.subheader("Full Duplicate Detection Result")
#             st.json(duplicate_result)
#             st.subheader("Full Remediation Result")
#             st.json(remediation_result)

#         st.divider()

        

#         st.subheader("Root Cause Analysis")
#         if root_cause_result:
#             confidence = root_cause_result.get("confidence", 0.0)
#             st.write(f"**Hypothesis:** {root_cause_result['root_cause_hypothesis']}")
#             st.write(f"**Confidence:** {confidence:.2f}")
#             if confidence < 0.6:
#                 st.warning("Limited historical evidence available — this is a best-guess hypothesis, not a confirmed cause.")
#             if root_cause_result.get("supporting_evidence"):
#                 st.write("**Supporting Evidence:**")
#                 for ev in root_cause_result["supporting_evidence"]:
#                     st.write(f"- `{ev['bug_id']}` — {ev['summary']}")
#             else:
#                 st.write("No supporting historical evidence was found for this hypothesis.")

#         st.divider()

#         st.subheader("Duplicate Bugs")
#         if duplicate_result:
#             for d in duplicate_result:
#                 st.write(f"**`{d['bug_id']}`** — {d['label'].upper()} match ({d['similarity']*100:.1f}% similar)")
#                 st.write(d["explanation"])
#                 st.write("---")
#         else:
#             st.info("No similar past submissions found — this appears to be a new issue.")

#         st.divider()

#         st.subheader("Recommended Fix")
#         if remediation_result:
#             st.write(f"**{remediation_result['recommended_fix']}**")
#             st.write(f"**Confidence:** {remediation_result.get('confidence', 0.0):.2f}")

#             if remediation_result.get("fix_steps"):
#                 st.write("**Fix Steps:**")
#                 for i, step in enumerate(remediation_result["fix_steps"], 1):
#                     st.write(f"{i}. {step}")

#             if remediation_result.get("code_example"):
#                 ce = remediation_result["code_example"]
#                 if ce.get("before") or ce.get("after"):
#                     col_before, col_after = st.columns(2)
#                     with col_before:
#                         st.write("**Before:**")
#                         st.code(ce.get("before", ""))
#                     with col_after:
#                         st.write("**After:**")
#                         st.code(ce.get("after", ""))

#             if remediation_result.get("validation_steps"):
#                 st.write("**Validation Steps:**")
#                 for step in remediation_result["validation_steps"]:
#                     st.write(f"- {step}")

#             if remediation_result.get("prevention"):
#                 st.write(f"**Prevention Tip:** {remediation_result['prevention']}")

#             if remediation_result.get("reasoning"):
#                 st.write(f"**Reasoning:** {remediation_result['reasoning']}")

#             if remediation_result.get("references_used"):
#                 st.write("**References Used:**")
#                 for ref in remediation_result["references_used"]:
#                     match_info = f" ({ref['match']}, {ref['similarity']*100:.0f}%)" if "match" in ref else ""
#                     st.write(f"- `{ref['bug_id']}`{match_info} — {ref.get('summary', '')}")
#             st.divider()

#             st.subheader("Confirm Fix Outcome")

#             current_bug_id = bug_record["bug_id"]
#             status_key = f"fix_status_{current_bug_id}"

#             if status_key not in st.session_state:
#                 st.session_state[status_key] = None

#             if st.session_state[status_key] is None:
#                 col_worked, col_not_worked = st.columns(2)

#                 with col_worked:
#                     if st.button("✅ Fix Worked", key=f"worked_{current_bug_id}"):
#                         try:
#                             add_resolved_bug_to_kb(
#                                 bug_id=current_bug_id,
#                                 description=bug_record["description"],
#                                 error_type=simple_view["error_type"],
#                                 severity=simple_view["severity"],
#                                 recommended_fix=remediation_result["recommended_fix"]
#                             )

#                             conn = sqlite3.connect(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "bug_submissions.db"))
#                             cursor = conn.cursor()
#                             cursor.execute("UPDATE bug_submissions SET status = ? WHERE bug_id = ?", ("resolved_added_to_kb", current_bug_id))
#                             conn.commit()
#                             conn.close()

#                             st.cache_resource.clear()

#                             st.session_state[status_key] = "resolved_added_to_kb"
#                             st.success("Marked as resolved — added to knowledge base for future recommendations.")
#                             st.rerun()

#                         except Exception as e:
#                             conn = sqlite3.connect(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "bug_submissions.db"))
#                             cursor = conn.cursor()
#                             cursor.execute("UPDATE bug_submissions SET status = ? WHERE bug_id = ?", ("resolved_kb_append_failed", current_bug_id))
#                             conn.commit()
#                             conn.close()

#                             st.session_state[status_key] = "resolved_kb_append_failed"
#                             st.error(f"Fix marked as resolved, but adding it to the knowledge base failed: {e}")
#                             st.rerun()

#                 with col_not_worked:
#                     if st.button("❌ Fix Did Not Work", key=f"notworked_{current_bug_id}"):
#                         conn = sqlite3.connect(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "bug_submissions.db"))
#                         cursor = conn.cursor()
#                         cursor.execute("UPDATE bug_submissions SET status = ? WHERE bug_id = ?", ("unresolved", current_bug_id))
#                         conn.commit()
#                         conn.close()

#                         st.session_state[status_key] = "unresolved"
#                         st.info("Marked as unresolved — not added to the knowledge base.")
#                         st.rerun()

#             else:
#                 status_display = {
#                     "resolved_added_to_kb": "✅ Resolved — added to knowledge base",
#                     "resolved_kb_append_failed": "⚠️ Resolved, but knowledge base update failed",
#                     "unresolved": "❌ Marked as unresolved"
#                 }
#                 st.write(f"**Status:** {status_display.get(st.session_state[status_key], st.session_state[status_key])}")
                    
#                             st.divider()

#                             st.subheader("Confirm Fix Outcome")

#                             current_bug_id = bug_record["bug_id"]
#                             status_key = f"fix_status_{current_bug_id}"

#                             if status_key not in st.session_state:
#                                 st.session_state[status_key] = None

#                             if st.session_state[status_key] is None:
#                                 col_worked, col_not_worked = st.columns(2)

#                                 with col_worked:
#                                     if st.button("✅ Fix Worked", key=f"worked_{current_bug_id}"):
#                                         try:
#                                             add_resolved_bug_to_kb(
#                                                 bug_id=current_bug_id,
#                                                 description=bug_record["description"],
#                                                 error_type=simple_view["error_type"],
#                                                 severity=simple_view["severity"],
#                                                 recommended_fix=remediation_result["recommended_fix"]
#                                             )

#                                             conn = sqlite3.connect(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "bug_submissions.db"))
#                                             cursor = conn.cursor()
#                                             cursor.execute("UPDATE bug_submissions SET status = ? WHERE bug_id = ?", ("resolved_added_to_kb", current_bug_id))
#                                             conn.commit()
#                                             conn.close()

#                                             st.cache_resource.clear()

#                                             st.session_state[status_key] = "resolved_added_to_kb"
#                                             st.success("Marked as resolved — added to knowledge base for future recommendations.")
#                                             st.rerun()

#                                         except Exception as e:
#                                             conn = sqlite3.connect(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "bug_submissions.db"))
#                                             cursor = conn.cursor()
#                                             cursor.execute("UPDATE bug_submissions SET status = ? WHERE bug_id = ?", ("resolved_kb_append_failed", current_bug_id))
#                                             conn.commit()
#                                             conn.close()

#                                             st.session_state[status_key] = "resolved_kb_append_failed"
#                                             st.error(f"Fix marked as resolved, but adding it to the knowledge base failed: {e}")
#                                             st.rerun()

#                                 with col_not_worked:
#                                     if st.button("❌ Fix Did Not Work", key=f"notworked_{current_bug_id}"):
#                                         conn = sqlite3.connect(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "bug_submissions.db"))
#                                         cursor = conn.cursor()
#                                         cursor.execute("UPDATE bug_submissions SET status = ? WHERE bug_id = ?", ("unresolved", current_bug_id))
#                                         conn.commit()
#                                         conn.close()

#                                         st.session_state[status_key] = "unresolved"
#                                         st.info("Marked as unresolved — not added to the knowledge base.")
#                                         st.rerun()

#                             else:
#                                 status_display = {
#                                     "resolved_added_to_kb": "✅ Resolved — added to knowledge base",
#                                     "resolved_kb_append_failed": "⚠️ Resolved, but knowledge base update failed",
#                                     "unresolved": "❌ Marked as unresolved"
#                                 }
#                                 st.write(f"**Status:** {status_display.get(st.session_state[status_key], st.session_state[status_key])}")


#         st.divider()

#         st.subheader("Submitted Bug Record")
#         st.json(bug_record)

#         st.subheader(f"Similar Past Bugs (Historical Knowledge Base, Top {top_n})")
#         if retrieved_bugs:
#             for rank, r in enumerate(retrieved_bugs, 1):
#                 st.write(f"**{rank}. {r['title']}**")
#                 st.write(f"Severity: {r['severity']} | Source: {r['source_dataset']} | Similarity: {r['similarity']:.2f}")
#                 st.write("---")
#         else:
#             st.info("No similar historical bugs were retrieved.")


# with tab2:
#     st.subheader("Defect Pattern Analytics")

#     if st.button("Refresh Analytics"):
#         conn = sqlite3.connect(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "bug_submissions.db"))
#         analytics_df = pd.read_sql("SELECT * FROM bug_submissions", conn)
#         conn.close()

#         analytics_df['component_normalized'] = analytics_df['component'].replace(COMPONENT_MERGE_MAP)

#         analytics_result = compute_defect_analytics(analytics_df)
#         st.session_state.analytics_result = analytics_result

#     if "analytics_result" in st.session_state:
#         result = st.session_state.analytics_result

#         # --- Top metrics ---
#         col1, col2, col3 = st.columns(3)
#         col1.metric("Total Submissions", result["total_submissions"])
#         col2.metric("Classified", result["classified_count"])
#         col3.metric("Unknown Rate", f"{result['unknown_rate']}%")
#         st.caption(
#             f"{result['classified_count']} of {result['total_submissions']} submissions were fully classified. "
#             f"{result['unknown_count']} had an unclassified component due to a pipeline/LLM extraction issue — "
#             f"excluded from component percentages, tracked here as a reliability metric."
#         )

#         st.divider()

#         # --- Severity pie chart ---
#         st.write("**Severity Breakdown**")
#         severity_df = pd.DataFrame(result["severity_breakdown"])
#         fig_severity = px.pie(severity_df, names="label", values="count", hover_data=["percent"])
#         st.plotly_chart(fig_severity, use_container_width=True)

#         st.divider()

#         # --- Component pie chart ---
#         st.write("**Component Breakdown** (classified submissions only)")
#         component_df = pd.DataFrame(result["component_breakdown"])
#         fig_component = px.pie(component_df, names="label", values="count", hover_data=["percent"])
#         st.plotly_chart(fig_component, use_container_width=True)

#         st.divider()

#         # --- Root cause clusters, expandable ---
#         st.write("**Root Cause Patterns** (semantic clustering)")
#         st.caption(
#     "Note: some entries may reflect compound submissions containing multiple distinct issues "
#     "in a single bug report (e.g. a test bug describing several unrelated errors at once), "
#     "rather than a true single-cause pattern."
#         )
#         for cluster in result["root_cause_breakdown"]:
#             with st.expander(f"{cluster['label']} — {cluster['count']} bugs ({cluster['percent']}%)"):
#                 if len(cluster["distinct_error_types"]) > 1:
#                     st.caption(f"Note: this cluster merges multiple error_type labels: {', '.join(cluster['distinct_error_types'])}")
#                 st.write("Bug IDs:", ", ".join(cluster["bug_ids"]))

#         st.divider()

#         # --- Submission activity ---
#         st.write("**Submission Activity**")
#         activity_df = pd.DataFrame(result["submission_activity"])
#         fig_activity = px.bar(activity_df, x="date", y="count")
#         st.plotly_chart(fig_activity, use_container_width=True)
#         st.caption(
#             "Reflects testing activity during development, not a real-world temporal defect pattern — "
#             "sample size and submission window are too small/compressed for genuine trend analysis."
#         )
#     else:
#         st.info("Click 'Refresh Analytics' to compute the current defect pattern analytics.")    
#         st.divider()

#         st.subheader("Submitted Bug Record")
#         st.json(bug_record)

#         st.subheader(f"Similar Past Bugs (Historical Knowledge Base, Top {top_n})")
#         if retrieved_bugs:
#             for rank, r in enumerate(retrieved_bugs, 1):
#                 st.write(f"**{rank}. {r['title']}**")
#                 st.write(f"Severity: {r['severity']} | Source: {r['source_dataset']} | Similarity: {r['similarity']:.2f}")
#                 st.write("---")
#         else:
#             st.info("No similar historical bugs were retrieved.")


# with tab2:
#     st.subheader("Defect Pattern Analytics")

#     if st.button("Refresh Analytics"):
#         conn = sqlite3.connect(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "bug_submissions.db"))
#         analytics_df = pd.read_sql("SELECT * FROM bug_submissions", conn)
#         conn.close()

#         analytics_df['component_normalized'] = analytics_df['component'].replace(COMPONENT_MERGE_MAP)

#         analytics_result = compute_defect_analytics(analytics_df)
#         st.session_state.analytics_result = analytics_result

#     if "analytics_result" in st.session_state:
#         result = st.session_state.analytics_result

#         # --- Top metrics ---
#         col1, col2, col3 = st.columns(3)
#         col1.metric("Total Submissions", result["total_submissions"])
#         col2.metric("Classified", result["classified_count"])
#         col3.metric("Unknown Rate", f"{result['unknown_rate']}%")
#         st.caption(
#             f"{result['classified_count']} of {result['total_submissions']} submissions were fully classified. "
#             f"{result['unknown_count']} had an unclassified component due to a pipeline/LLM extraction issue — "
#             f"excluded from component percentages, tracked here as a reliability metric."
#         )

#         st.divider()

#         # --- Severity pie chart ---
#         st.write("**Severity Breakdown**")
#         severity_df = pd.DataFrame(result["severity_breakdown"])
#         fig_severity = px.pie(severity_df, names="label", values="count", hover_data=["percent"])
#         st.plotly_chart(fig_severity, use_container_width=True)

#         st.divider()

#         # --- Component pie chart ---
#         st.write("**Component Breakdown** (classified submissions only)")
#         component_df = pd.DataFrame(result["component_breakdown"])
#         fig_component = px.pie(component_df, names="label", values="count", hover_data=["percent"])
#         st.plotly_chart(fig_component, use_container_width=True)

#         st.divider()

#         # --- Root cause clusters, expandable ---
#         st.write("**Root Cause Patterns** (semantic clustering)")
#         st.caption(
#     "Note: some entries may reflect compound submissions containing multiple distinct issues "
#     "in a single bug report (e.g. a test bug describing several unrelated errors at once), "
#     "rather than a true single-cause pattern."
#         )
#         for cluster in result["root_cause_breakdown"]:
#             with st.expander(f"{cluster['label']} — {cluster['count']} bugs ({cluster['percent']}%)"):
#                 if len(cluster["distinct_error_types"]) > 1:
#                     st.caption(f"Note: this cluster merges multiple error_type labels: {', '.join(cluster['distinct_error_types'])}")
#                 st.write("Bug IDs:", ", ".join(cluster["bug_ids"]))

#         st.divider()

#         # --- Submission activity ---
#         st.write("**Submission Activity**")
#         activity_df = pd.DataFrame(result["submission_activity"])
#         fig_activity = px.bar(activity_df, x="date", y="count")
#         st.plotly_chart(fig_activity, use_container_width=True)
#         st.caption(
#             "Reflects testing activity during development, not a real-world temporal defect pattern — "
#             "sample size and submission window are too small/compressed for genuine trend analysis."
#         )
#     else:
#         st.info("Click 'Refresh Analytics' to compute the current defect pattern analytics.")




import streamlit as st
import uuid
from datetime import datetime
import numpy as np
import pandas as pd
import os
import sys
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import sqlite3
import plotly.express as px

st.set_page_config(layout="wide")

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from agents import (
    run_orchestration, build_simple_view, init_db, save_submission,
    retrieve_similar_bugs, root_cause_agent,
    duplicate_detection_agent, remediation_agent,
    COMPONENT_MERGE_MAP, compute_defect_analytics, cluster_root_causes,
    add_resolved_bug_to_kb
)

init_db()

st.markdown(
    """
    <style>
    .stApp {
        border: 8px solid #2E7D32;
    }
    </style>
    """,
    unsafe_allow_html=True
)

page = st.sidebar.radio("📚Menu", ["1️⃣Submit Bug", "2️⃣Analytics Dashboard"])

if page == "1️⃣Submit Bug":
    st.title("Creation of Intelligent 🐞 Diagnosis Platform with Fix Recommendation Assistance")
    st.write("Paste your bug report or stack trace below - analysis runs automatically.")

    @st.cache_resource
    def load_retrieval_components():
        base_dir = os.path.dirname(os.path.abspath(__file__))
        model = SentenceTransformer('all-MiniLM-L6-v2')
        embeddings = np.load(os.path.join(base_dir, "embeddings_real.npy"))
        metadata = pd.read_csv(os.path.join(base_dir, "chunks_metadata.csv"))
        return model, embeddings, metadata

    model, kb_embeddings, kb_metadata = load_retrieval_components()

    bug_report = st.text_area("Bug Report / Stack Trace", height=200, key="bug_report_input")
    uploaded_file = st.file_uploader("Or upload a bug report file", type=["txt", "log"], key="bug_file_uploader")

    top_n = st.slider(
        "Number of similar bugs to retrieve (used for Root Cause and Duplicate Detection)",
        min_value=3, max_value=15, value=5, key="top_n_slider"
    )

    final_text = ""
    if uploaded_file is not None:
        final_text = uploaded_file.read().decode("utf-8")
    elif bug_report.strip() != "":
        final_text = bug_report.strip()

    if "last_analyzed_text" not in st.session_state:
        st.session_state.last_analyzed_text = ""
    if "last_top_n" not in st.session_state:
        st.session_state.last_top_n = top_n
    if "combined_result" not in st.session_state:
        st.session_state.combined_result = None
    if "bug_record" not in st.session_state:
        st.session_state.bug_record = None
    if "retrieved_bugs" not in st.session_state:
        st.session_state.retrieved_bugs = []
    if "root_cause_result" not in st.session_state:
        st.session_state.root_cause_result = None
    if "duplicate_result" not in st.session_state:
        st.session_state.duplicate_result = []
    if "remediation_result" not in st.session_state:
        st.session_state.remediation_result = None

    should_analyze = (
        final_text != "" and
        (final_text != st.session_state.last_analyzed_text or top_n != st.session_state.last_top_n)
    )

    if final_text == "":
        st.info("Waiting for a bug report to be pasted or uploaded...")

    elif should_analyze:
        st.session_state.last_analyzed_text = final_text
        st.session_state.last_top_n = top_n

        bug_record = {
            "bug_id": "BUG-" + str(uuid.uuid4())[:8],
            "description": final_text,
            "stack_trace": final_text,
            "timestamp": datetime.now().isoformat(),
            "source": "user_submission"
        }
        st.session_state.bug_record = bug_record

        # --- Step 1: Triage + Log Analysis (save_submission deliberately NOT called yet) ---
        with st.spinner("Running Triage and Log Analysis..."):
            combined_result = run_orchestration(
                title=final_text[:80],
                description=final_text,
                stack_trace=final_text,
                bug_id=bug_record["bug_id"]
            )
            st.session_state.combined_result = combined_result

        triage_result = combined_result["triage"]
        log_result = combined_result["log_analysis"]

        # --- Step 2: Retrieve similar historical bugs (Milestone 1 KB) ---
        with st.spinner("Retrieving similar historical bugs..."):
            try:
                retrieved_bugs = retrieve_similar_bugs(
                    final_text, model, kb_embeddings, kb_metadata, top_n=top_n
                )
            except Exception as e:
                retrieved_bugs = []
                st.session_state.retrieval_error = str(e)
            st.session_state.retrieved_bugs = retrieved_bugs

        # --- Step 3: Root Cause Agent ---
        with st.spinner("Analyzing root cause..."):
            try:
                root_cause_result = root_cause_agent(
                    bug_id=bug_record["bug_id"],
                    severity=triage_result["severity"],
                    component=triage_result["component"],
                    error_type=log_result["error_type"],
                    failure_location=log_result["failure_location"],
                    code_path=log_result["code_path"],
                    retrieved_bugs=retrieved_bugs
                )
            except Exception as e:
                root_cause_result = {
                    "root_cause_hypothesis": "Root cause analysis could not be completed due to a system error.",
                    "confidence": 0.0,
                    "supporting_evidence": [],
                    "error": str(e)
                }
            st.session_state.root_cause_result = root_cause_result

        # --- Step 4: Duplicate Detection Agent (SQLite still does NOT contain this bug yet) ---
        with st.spinner("Checking for duplicate submissions..."):
            try:
                duplicate_result = duplicate_detection_agent(
                    new_description=final_text,
                    error_type=log_result["error_type"],
                    component=triage_result["component"],
                    reasoning=log_result["reasoning"],
                    model=model,
                    top_n=top_n
                )
            except Exception as e:
                duplicate_result = []
                st.session_state.duplicate_error = str(e)
            st.session_state.duplicate_result = duplicate_result

        # --- Step 5: Remediation Agent ---
        with st.spinner("Generating fix recommendation..."):
            try:
                remediation_result = remediation_agent(
                    bug_id=bug_record["bug_id"],
                    severity=triage_result["severity"],
                    component=triage_result["component"],
                    error_type=log_result["error_type"],
                    failure_location=log_result["failure_location"],
                    code_path=log_result["code_path"],
                    description=final_text,
                    root_cause=root_cause_result["root_cause_hypothesis"],
                    historical_references=root_cause_result["supporting_evidence"],
                    duplicate_bug=duplicate_result if duplicate_result else None
                )
            except Exception as e:
                remediation_result = {
                    "recommended_fix": "A fix recommendation could not be generated due to a system error.",
                    "fix_steps": [], "code_example": {}, "validation_steps": [],
                    "prevention": "", "confidence": 0.0,
                    "reasoning": "Remediation agent failed.", "references_used": [],
                    "error": str(e)
                }
            st.session_state.remediation_result = remediation_result

        # --- Step 6: NOW save to SQLite — after duplicate detection, so this bug can't match itself ---
        with st.spinner("Saving submission..."):
            simple_view_for_db = build_simple_view(combined_result)
            save_submission(
                simple_view_for_db,
                bug_record["description"],
                bug_record["timestamp"],
                root_cause_hypothesis=root_cause_result["root_cause_hypothesis"],
                recommended_fix=remediation_result["recommended_fix"]
            )

    # --- Display results (uses whatever was last analyzed, from session_state) ---
    if st.session_state.combined_result is not None:
        bug_record = st.session_state.bug_record
        combined_result = st.session_state.combined_result
        simple_view = build_simple_view(combined_result)
        retrieved_bugs = st.session_state.retrieved_bugs
        root_cause_result = st.session_state.root_cause_result
        duplicate_result = st.session_state.duplicate_result
        remediation_result = st.session_state.remediation_result

        st.success("Bug report received and analyzed")

        st.subheader("Analysis Summary")

        col1, col2, col3 = st.columns(3)
        col1.metric("Severity", simple_view["severity"])
        col2.metric("Priority", simple_view["priority"])
        col3.metric("Component", simple_view["component"])

        st.write(f"**Error Type:** {simple_view['error_type']}")
        st.write(f"**Failure Location:** {simple_view['failure_location']}")

        if root_cause_result:
            hyp = root_cause_result['root_cause_hypothesis']
            st.write(f"**Root Cause (summary):** {hyp[:150]}{'...' if len(hyp) > 150 else ''}")

        if duplicate_result:
            st.write(f"**Duplicates Found:** {len(duplicate_result)} similar past submission(s)")
        else:
            st.write("**Duplicates Found:** None — this appears to be a new issue")

        if remediation_result:
            fix = remediation_result['recommended_fix']
            st.write(f"**Recommended Fix (summary):** {fix[:150]}{'...' if len(fix) > 150 else ''}")

        if st.button("Show full details (all agents)", key="show_full_details"):
            st.subheader("Full Combined Result (Triage + Log Analysis)")
            st.json(combined_result)
            st.subheader("Full Root Cause Result")
            st.json(root_cause_result)
            st.subheader("Full Duplicate Detection Result")
            st.json(duplicate_result)
            st.subheader("Full Remediation Result")
            st.json(remediation_result)

        st.divider()

        st.subheader("Root Cause Analysis")
        if root_cause_result:
            confidence = root_cause_result.get("confidence", 0.0)
            st.write(f"**Hypothesis:** {root_cause_result['root_cause_hypothesis']}")
            st.write(f"**Confidence:** {confidence:.2f}")
            if confidence < 0.6:
                st.warning("Limited historical evidence available — this is a best-guess hypothesis, not a confirmed cause.")
            if root_cause_result.get("supporting_evidence"):
                st.write("**Supporting Evidence:**")
                for ev in root_cause_result["supporting_evidence"]:
                    st.write(f"- `{ev['bug_id']}` — {ev['summary']}")
            else:
                st.write("No supporting historical evidence was found for this hypothesis.")

        st.divider()

        st.subheader("Duplicate Bugs")
        if duplicate_result:
            for d in duplicate_result:
                st.write(f"**`{d['bug_id']}`** — {d['label'].upper()} match ({d['similarity']*100:.1f}% similar)")
                st.write(d["explanation"])
                st.write("---")
        else:
            st.info("No similar past submissions found — this appears to be a new issue.")

        st.divider()

        st.subheader("Recommended Fix")
        if remediation_result:
            st.write(f"**{remediation_result['recommended_fix']}**")
            st.write(f"**Confidence:** {remediation_result.get('confidence', 0.0):.2f}")

            if remediation_result.get("fix_steps"):
                st.write("**Fix Steps:**")
                for i, step in enumerate(remediation_result["fix_steps"], 1):
                    st.write(f"{i}. {step}")

            if remediation_result.get("code_example"):
                ce = remediation_result["code_example"]
                if ce.get("before") or ce.get("after"):
                    col_before, col_after = st.columns(2)
                    with col_before:
                        st.write("**Before:**")
                        st.code(ce.get("before", ""))
                    with col_after:
                        st.write("**After:**")
                        st.code(ce.get("after", ""))

            if remediation_result.get("validation_steps"):
                st.write("**Validation Steps:**")
                for step in remediation_result["validation_steps"]:
                    st.write(f"- {step}")

            if remediation_result.get("prevention"):
                st.write(f"**Prevention Tip:** {remediation_result['prevention']}")

            if remediation_result.get("reasoning"):
                st.write(f"**Reasoning:** {remediation_result['reasoning']}")

            if remediation_result.get("references_used"):
                st.write("**References Used:**")
                for ref in remediation_result["references_used"]:
                    match_info = f" ({ref['match']}, {ref['similarity']*100:.0f}%)" if "match" in ref else ""
                    st.write(f"- `{ref['bug_id']}`{match_info} — {ref.get('summary', '')}")

            # --- Confirm Fix Outcome (KB growth mechanism) ---
            # This sits at the same level as the "references_used" check above,
            # both as direct children of "if remediation_result:" — so it always
            # renders regardless of whether references_used happened to be empty.
            st.divider()

            st.subheader("Confirm Fix Outcome")

            current_bug_id = bug_record["bug_id"]
            status_key = f"fix_status_{current_bug_id}"

            if status_key not in st.session_state:
                st.session_state[status_key] = None

            if st.session_state[status_key] is None:
                col_worked, col_not_worked = st.columns(2)

                with col_worked:
                    if st.button("✅ Fix Worked", key=f"worked_{current_bug_id}"):
                        db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "bug_submissions.db")
                        try:
                            add_resolved_bug_to_kb(
                                bug_id=current_bug_id,
                                description=bug_record["description"],
                                error_type=simple_view["error_type"],
                                severity=simple_view["severity"],
                                recommended_fix=remediation_result["recommended_fix"]
                            )

                            conn = sqlite3.connect(db_path)
                            cursor = conn.cursor()
                            cursor.execute("UPDATE bug_submissions SET status = ? WHERE bug_id = ?", ("resolved_added_to_kb", current_bug_id))
                            conn.commit()
                            conn.close()

                            st.cache_resource.clear()

                            st.session_state[status_key] = "resolved_added_to_kb"
                            st.success("Marked as resolved — added to knowledge base for future recommendations.")
                            st.rerun()

                        except Exception as e:
                            conn = sqlite3.connect(db_path)
                            cursor = conn.cursor()
                            cursor.execute("UPDATE bug_submissions SET status = ? WHERE bug_id = ?", ("resolved_kb_append_failed", current_bug_id))
                            conn.commit()
                            conn.close()

                            st.session_state[status_key] = "resolved_kb_append_failed"
                            st.error(f"Fix marked as resolved, but adding it to the knowledge base failed: {e}")
                            st.rerun()

                with col_not_worked:
                    if st.button("❌ Fix Did Not Work", key=f"notworked_{current_bug_id}"):
                        db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "bug_submissions.db")
                        conn = sqlite3.connect(db_path)
                        cursor = conn.cursor()
                        cursor.execute("UPDATE bug_submissions SET status = ? WHERE bug_id = ?", ("unresolved", current_bug_id))
                        conn.commit()
                        conn.close()

                        st.session_state[status_key] = "unresolved"
                        st.info("Marked as unresolved — not added to the knowledge base.")
                        st.rerun()

            else:
                status_display = {
                    "resolved_added_to_kb": "✅ Resolved — added to knowledge base",
                    "resolved_kb_append_failed": "⚠️ Resolved, but knowledge base update failed",
                    "unresolved": "❌ Marked as unresolved"
                }
                st.write(f"**Status:** {status_display.get(st.session_state[status_key], st.session_state[status_key])}")

        st.divider()

        st.subheader("Submitted Bug Record")
        st.json(bug_record)

        st.subheader(f"Similar Past Bugs (Historical Knowledge Base, Top {top_n})")
        if retrieved_bugs:
            for rank, r in enumerate(retrieved_bugs, 1):
                st.write(f"**{rank}. {r['title']}**")
                st.write(f"Severity: {r['severity']} | Source: {r['source_dataset']} | Similarity: {r['similarity']:.2f}")
                st.write("---")
        else:
            st.info("No similar historical bugs were retrieved.")


elif page == "2️⃣Analytics Dashboard":
    st.subheader("Defect Pattern Analytics")

    if st.button("Refresh Analytics"):
        conn = sqlite3.connect(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "bug_submissions.db"))
        analytics_df = pd.read_sql("SELECT * FROM bug_submissions", conn)
        conn.close()

        analytics_df['component_normalized'] = analytics_df['component'].replace(COMPONENT_MERGE_MAP)

        analytics_result = compute_defect_analytics(analytics_df)
        st.session_state.analytics_result = analytics_result

    if "analytics_result" in st.session_state:
        result = st.session_state.analytics_result

        # --- Top metrics ---
        col1, col2, col3 = st.columns(3)
        col1.metric("Total Submissions", result["total_submissions"])
        col2.metric("Classified", result["classified_count"])
        col3.metric("Unknown Rate", f"{result['unknown_rate']}%")
        st.caption(
            f"{result['classified_count']} of {result['total_submissions']} submissions were fully classified. "
            f"{result['unknown_count']} had an unclassified component due to a pipeline/LLM extraction issue — "
            f"excluded from component percentages, tracked here as a reliability metric."
        )

        st.divider()

        # --- Severity pie chart ---
        st.write("**Severity Breakdown**")
        severity_df = pd.DataFrame(result["severity_breakdown"])
        fig_severity = px.pie(severity_df, names="label", values="count", hover_data=["percent"])
        st.plotly_chart(fig_severity, use_container_width=True)

        st.divider()

        # --- Component pie chart ---
        st.write("**Component Breakdown** (classified submissions only)")
        component_df = pd.DataFrame(result["component_breakdown"])
        fig_component = px.pie(component_df, names="label", values="count", hover_data=["percent"])
        st.plotly_chart(fig_component, use_container_width=True)

        st.divider()

        # --- Root cause clusters, expandable ---
        st.write("**Root Cause Patterns** (semantic clustering)")
        st.caption(
            "Note: some entries may reflect compound submissions containing multiple distinct issues "
            "in a single bug report (e.g. a test bug describing several unrelated errors at once), "
            "rather than a true single-cause pattern."
        )
        for cluster in result["root_cause_breakdown"]:
            with st.expander(f"{cluster['label']} — {cluster['count']} bugs ({cluster['percent']}%)"):
                if len(cluster["distinct_error_types"]) > 1:
                    st.caption(f"Note: this cluster merges multiple error_type labels: {', '.join(cluster['distinct_error_types'])}")
                st.write("Bug IDs:", ", ".join(cluster["bug_ids"]))

        st.divider()

        # --- Submission activity ---
        st.write("**Submission Activity**")
        activity_df = pd.DataFrame(result["submission_activity"])
        fig_activity = px.bar(activity_df, x="date", y="count")
        st.plotly_chart(fig_activity, use_container_width=True)
        st.caption(
            "Reflects testing activity during development, not a real-world temporal defect pattern — "
            "sample size and submission window are too small/compressed for genuine trend analysis."
        )
    else:
        st.info("Click 'Refresh Analytics' to compute the current defect pattern analytics.")