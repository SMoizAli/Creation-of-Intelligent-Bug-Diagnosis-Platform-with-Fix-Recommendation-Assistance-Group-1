"""
DAG workflow orchestrator.

Flow: Bug Upload -> Retrieval -> Triage -> Log Parsing -> Duplicate -> Root Cause -> Remediation -> Risk -> Confidence -> Executive Summary -> Indexing
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from app.agents.duplicate import DuplicateAgent
from app.agents.log_parser import LogParserAgent
from app.agents.remediation import RemediationAgent
from app.agents.root_cause import RootCauseAgent
from app.agents.triage import TriageAgent
from app.agents.risk_assessment import RiskAssessmentAgent
from app.agents.confidence import ConfidenceAgent
from app.agents.executive_summary import ExecutiveSummaryAgent

from app.models import AgentResult, Analysis, AnalysisStatus, Bug, WorkflowStage
from app.rag.chunker import TextChunker
from app.rag.retriever import Retriever
from app.utils.logger import get_logger

logger = get_logger("agents.workflow")


class WorkflowOrchestrator:
    """Executes the multi-agent DAG pipeline with resilient stage completion."""

    STAGES = [
        WorkflowStage.TRIAGE,
        WorkflowStage.LOG_PARSING,
        WorkflowStage.DUPLICATE_DETECTION,
        WorkflowStage.ROOT_CAUSE,
        WorkflowStage.REMEDIATION,
        WorkflowStage.RISK_ASSESSMENT,
        WorkflowStage.CONFIDENCE_SCORING,
        WorkflowStage.EXECUTIVE_SUMMARY,
    ]

    def __init__(
        self,
        retriever: Optional[Retriever] = None,
        chunker: Optional[TextChunker] = None,
    ) -> None:
        self.retriever = retriever or Retriever()
        self.chunker = chunker or TextChunker()
        self.triage_agent = TriageAgent()
        self.log_parser_agent = LogParserAgent()
        self.duplicate_agent = DuplicateAgent()
        self.root_cause_agent = RootCauseAgent()
        self.remediation_agent = RemediationAgent()
        self.risk_assessment_agent = RiskAssessmentAgent()
        self.confidence_agent = ConfidenceAgent()
        self.executive_summary_agent = ExecutiveSummaryAgent()

    def run(
        self,
        bug: Bug,
        analysis: Analysis,
        use_mmr: bool = True,
        retrieval_top_k: Optional[int] = None,
    ) -> Analysis:
        import gc
        logger.info("Starting memory-optimized workflow for bug %s, analysis %s", bug.id, analysis.id)
        raw = bug.raw_content or bug.description or ""
        
        # Memory Protection: Keep agent evaluation string bounded to max 15,000 characters
        content = raw[:15000].strip() if len(raw) > 15000 else raw
        analysis.status = AnalysisStatus.IN_PROGRESS
        analysis.agent_results = []

        import concurrent.futures

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            # --- STEP 1: RAG Retrieval (Search First!) ---
            logger.info("Performing knowledge base vector retrieval before indexing.")
            future_context = executor.submit(
                self.retriever.retrieve,
                query=content[:2500],
                top_k=retrieval_top_k,
                use_mmr=use_mmr,
            )
            
            # --- LEVEL 1: Triage and Log Parsing (Independent) ---
            analysis.current_stage = WorkflowStage.TRIAGE
            
            try:
                context = future_context.result()
            except Exception as exc:
                logger.error("RAG retrieval failed. Continuing with empty context. Error: %s", exc)
                context = []
            analysis.retrieved_context = context

            future_triage = executor.submit(self.triage_agent.execute, bug_content=content, context=context)
            future_log = executor.submit(self.log_parser_agent.execute, bug_content=content)
            
            triage_result = future_triage.result()
            log_result = future_log.result()
            
            analysis.agent_results.extend([triage_result, log_result])
            analysis.triage = triage_result.output
            analysis.log_analysis = log_result.output

            # --- LEVEL 2: Duplicate Detection and Root Cause ---
            analysis.current_stage = WorkflowStage.ROOT_CAUSE
            future_dup = executor.submit(
                self.duplicate_agent.execute,
                bug_content=content, context=context, triage_output=triage_result.output
            )
            future_rc = executor.submit(
                self.root_cause_agent.execute,
                bug_content=content, context=context, triage_output=triage_result.output, log_analysis=log_result.output
            )

            dup_result = future_dup.result()
            rc_result = future_rc.result()
            
            analysis.agent_results.extend([dup_result, rc_result])
            analysis.duplicate_detection = dup_result.output
            analysis.root_cause = rc_result.output

            # --- LEVEL 3: Remediation and Risk Assessment ---
            analysis.current_stage = WorkflowStage.REMEDIATION
            future_rem = executor.submit(
                self.remediation_agent.execute,
                bug_content=content, context=context, root_cause_output=rc_result.output, duplicate_output=dup_result.output
            )
            future_risk = executor.submit(
                self.risk_assessment_agent.execute,
                bug_content=content, root_cause_output=rc_result.output, triage_output=triage_result.output
            )

            rem_result = future_rem.result()
            risk_result = future_risk.result()

            analysis.agent_results.extend([rem_result, risk_result])
            analysis.remediation = rem_result.output
            analysis.risk_assessment = risk_result.output

            # --- LEVEL 4: Confidence Scoring ---
            analysis.current_stage = WorkflowStage.CONFIDENCE_SCORING
            serialized_outputs = [
                {"agent_name": r.agent_name, "stage": r.stage.value, "confidence": r.confidence}
                for r in analysis.agent_results
            ]
            conf_result = self.confidence_agent.execute(bug_content=content, agent_results=serialized_outputs)
            analysis.agent_results.append(conf_result)
            analysis.confidence_scoring = conf_result.output

        # --- STEP 9: Executive Summary ---
        analysis.current_stage = WorkflowStage.EXECUTIVE_SUMMARY
        exec_result = self.executive_summary_agent.execute(
            bug_content=content,
            triage_output=triage_result.output,
            root_cause_output=rc_result.output,
            remediation_output=rem_result.output,
            risk_output=risk_result.output,
            confidence_output=conf_result.output,
        )
        analysis.agent_results.append(exec_result)
        analysis.executive_summary = exec_result.output

        # --- STEP 10: Index Bug in Vector Store ---
        logger.info("Indexing current bug into knowledge base after analysis completion.")
        try:
            metadata = {
                "bug_id": bug.id,
                "priority": triage_result.output.get("priority", "unknown"),
                "component": triage_result.output.get("component", "unknown"),
                "resolution": rem_result.output.get("permanent_fix", ""),
                "source": bug.metadata.source,
                "date": bug.metadata.date.isoformat(),
                "tags": ",".join(triage_result.output.get("tags", [])),
            }
            chunks = self.chunker.split_with_metadata(content, metadata)
            # Limit stored chunks per bug to max 10 to keep ChromaDB memory footprint tiny
            self.retriever.index_bug(bug.id, chunks[:10])
        except Exception as exc:
            logger.error("Failed to index bug into ChromaDB knowledge base: %s", exc)

        gc.collect()

        # --- STEP 11: Capture Combined Outputs (UnifiedBugAnalysis) ---
        logger.info("Capturing combined outputs into UnifiedBugAnalysis format.")
        try:
            from app.schemas.agent_schemas import UnifiedBugAnalysis
            from pathlib import Path

            unified_analysis = UnifiedBugAnalysis(
                analysis_id=analysis.id,
                source_file=bug.file_name or "pasted_text",
                title=bug.title,
                raw_input=content,
                triage=triage_result.output,
                log_analysis=log_result.output,
                overall_summary=self._build_summary(analysis),
                overall_confidence=conf_result.output.get("confidence_score", 0.0)
            )
            
            project_root = Path(__file__).resolve().parent.parent.parent.parent
            processed_dir = project_root / "datasets" / "processed"
            processed_dir.mkdir(parents=True, exist_ok=True)
            unified_file = processed_dir / f"{analysis.id}.json"
            
            with open(unified_file, "w") as f:
                f.write(unified_analysis.model_dump_json(indent=2))
        except Exception as exc:
            logger.error("Failed to save UnifiedBugAnalysis: %s", exc)

        # Complete Analysis
        analysis.current_stage = WorkflowStage.COMPLETE
        analysis.status = AnalysisStatus.COMPLETED
        analysis.completed_at = datetime.utcnow()
        analysis.summary = self._build_summary(analysis)
        logger.info("Workflow completed for analysis %s", analysis.id)
        return analysis

    @staticmethod
    def _build_summary(analysis: Analysis) -> str:
        triage = analysis.triage or {}
        root = analysis.root_cause or {}
        risk = analysis.risk_assessment or {}
        conf = analysis.confidence_scoring or {}
        return (
            f"Priority: {triage.get('priority', 'unknown')} | "
            f"Component: {triage.get('component', 'unknown')} | "
            f"Root Cause: {root.get('root_cause_category', 'unknown')} | "
            f"Risk: {risk.get('production_risk', 'unknown')} | "
            f"Confidence: {conf.get('confidence_score', 0.0)}"
        )
