"""Executive Summary agent creating management reviews."""

from typing import Any, Dict, List
from app.agents.base import BaseAgent
from app.models import AgentResult, WorkflowStage
from app.utils.logger import get_logger

logger = get_logger("agents.executive_summary")


class ExecutiveSummaryAgent(BaseAgent):
    stage = WorkflowStage.EXECUTIVE_SUMMARY
    prompt_file = "executive_summary.txt"

    def run(
        self,
        bug_content: str,
        triage_output: Dict[str, Any],
        root_cause_output: Dict[str, Any],
        remediation_output: Dict[str, Any],
        risk_output: Dict[str, Any],
        confidence_output: Dict[str, Any],
        **_: Any,
    ) -> AgentResult:
        try:
            logger.info("Executing ExecutiveSummaryAgent using LLM")
            user_prompt = self.load_prompt(
                bug_content=bug_content,
                triage_output=triage_output,
                root_cause_output=root_cause_output,
                remediation_output=remediation_output,
                risk_output=risk_output,
                confidence_output=confidence_output,
            )
            system_prompt = "You are the AI-Smart-Bug-Analyzer-And-Fix-Advisor Executive Summary Agent. Write a management-friendly summary outlining takeaways and immediate steps."
            output = self.query_llm(system_prompt, user_prompt)
            
            # Validation
            if "summary" not in output:
                raise ValueError("Missing summary key in LLM response.")
            
            confidence = 0.90
            
        except Exception as exc:
            logger.warning("ExecutiveSummaryAgent LLM query failed. Falling back to rules. Error: %s", exc)
            output = self._heuristic_summary(triage_output, root_cause_output, remediation_output, risk_output)
            confidence = 0.75

        return AgentResult(
            agent_name="ExecutiveSummaryAgent",
            stage=self.stage,
            output=output,
            confidence=confidence,
        )

    def _heuristic_summary(
        self,
        triage: Dict[str, Any],
        root_cause: Dict[str, Any],
        remediation: Dict[str, Any],
        risk: Dict[str, Any]
    ) -> Dict[str, Any]:
        component = triage.get("component", "unknown")
        priority = triage.get("priority", "medium")
        category = root_cause.get("root_cause_category", "defect")
        effort = remediation.get("effort_estimate", "medium")
        prod_risk = risk.get("production_risk", "medium")

        summary_text = (
            f"A {priority} priority bug affecting the '{component}' module has been detected. "
            f"Initial diagnostics trace the issue to a '{category}' root cause. "
            f"Remediation requires a '{effort}' effort permanent fix, with a production risk estimated as '{prod_risk}'."
        )

        return {
            "summary": summary_text,
            "business_impact_summary": f"Service degradation risk in {component} module, impacting client queries.",
            "recommended_action": f"Assign {component}-team to deploy hotfix and review code files.",
            "estimated_resolution_time": "4 hours" if priority == "high" else "1 day",
            "key_takeaways": [
                f"Issue localized to {component} component.",
                f"Requires regression testing: {', '.join(remediation.get('regression_tests', ['E2E checks']))}."
            ],
            "immediate_steps": [
                "1. Apply immediate mitigation steps suggested in Remediation report.",
                "2. Assign to lead developer on target component team."
            ]
        }
