"""Root cause analysis agent."""

import re
from typing import Any, Dict, List
from app.agents.base import BaseAgent
from app.models import AgentResult, WorkflowStage
from app.utils.logger import get_logger

logger = get_logger("agents.root_cause")


class RootCauseAgent(BaseAgent):
    stage = WorkflowStage.ROOT_CAUSE
    prompt_file = "rootcause.txt"

    def run(
        self,
        bug_content: str,
        context: List[Dict[str, Any]],
        triage_output: Dict[str, Any],
        log_analysis: Dict[str, Any],
        **_: Any,
    ) -> AgentResult:
        try:
            logger.info("Executing RootCauseAgent using LLM")
            user_prompt = self.load_prompt(
                bug_content=bug_content,
                context=self._format_context(context),
                triage_output=triage_output,
                log_analysis=log_analysis,
            )
            system_prompt = "You are the AI-Smart-Bug-Analyzer-And-Fix-Advisor Root Cause Agent. Predict root cause category, hypothesis, evidence, debugging steps, and files affected."
            output = self.query_llm(system_prompt, user_prompt)
            
            # Key checks
            if "root_cause_category" not in output:
                raise ValueError("Missing root_cause_category key in LLM response.")
            
            confidence = float(output.get("confidence", 0.80))
            
        except Exception as exc:
            logger.warning("RootCauseAgent LLM query failed. Falling back to rule-based cause logic. Error: %s", exc)
            output = self._heuristic_analysis(bug_content, context, triage_output, log_analysis)
            confidence = output["confidence"]

        return AgentResult(
            agent_name="RootCauseAgent",
            stage=self.stage,
            output=output,
            confidence=confidence,
        )

    def _heuristic_analysis(
        self,
        bug_content: str,
        context: List[Dict[str, Any]],
        triage_output: Dict[str, Any],
        log_analysis: Dict[str, Any],
    ) -> Dict[str, Any]:
        category = "unknown"
        lower = bug_content.lower()

        if log_analysis.get("has_stack_trace"):
            category = "code_defect"
        elif log_analysis.get("http_status_codes"):
            category = "integration"
        elif "config" in lower or "configuration" in lower:
            category = "configuration"
        elif "timeout" in lower or "connection" in lower:
            category = "infrastructure"
        elif "null" in lower or "undefined" in lower:
            category = "code_defect"

        historical_resolutions = [
            item.get("metadata", {}).get("resolution", "")
            for item in context
            if item.get("metadata", {}).get("resolution")
        ]

        # Extract file names dynamically from log analysis or patterns
        likely_files = log_analysis.get("file_names", [])
        if not likely_files:
            likely_files = re.findall(r"(\w+\.java|\w+\.py|\w+\.js|\w+\.go)", bug_content)

        return {
            "root_cause_category": category,
            "hypothesis": f"Likely {category.replace('_', ' ')} in {triage_output.get('component', 'unknown')} module.",
            "evidence": [
                f"Log errors count: {log_analysis.get('error_count', 0)}",
                f"Has Stack Trace: {log_analysis.get('has_stack_trace', False)}"
            ],
            "confidence": 0.70 if category != "unknown" else 0.40,
            "diagnostic_steps": self._diagnostic_steps(category),
            "historical_resolutions": list(set(historical_resolutions[:3])),
            "likely_source_files": list(set(likely_files[:3])),
            "rationale": f"Rule matching classification based on stack trace availability and error pattern keyword '{category}'."
        }

    @staticmethod
    def _diagnostic_steps(category: str) -> List[str]:
        steps_map = {
            "code_defect": ["Review stack trace", "Check recent commits in class files", "Run target unit tests"],
            "configuration": ["Verify environment variables", "Compare YAML/JSON configuration setups"],
            "infrastructure": ["Check API gateway and server health status", "Review network routes and firewalls"],
            "integration": ["Validate schema contracts", "Check payment or auth endpoints connectivity"],
        }
        return steps_map.get(category, ["Gather logs", "Reproduce bug in sandbox environment"])
