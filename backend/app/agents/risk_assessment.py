"""Risk Assessment agent evaluating business and technical impacts."""

from typing import Any, Dict, List
from app.agents.base import BaseAgent
from app.models import AgentResult, WorkflowStage
from app.utils.logger import get_logger

logger = get_logger("agents.risk_assessment")


class RiskAssessmentAgent(BaseAgent):
    stage = WorkflowStage.RISK_ASSESSMENT
    prompt_file = "risk_assessment.txt"

    def run(
        self,
        bug_content: str,
        root_cause_output: Dict[str, Any],
        triage_output: Dict[str, Any],
        **_: Any,
    ) -> AgentResult:
        try:
            logger.info("Executing RiskAssessmentAgent using LLM")
            user_prompt = self.load_prompt(
                bug_content=bug_content,
                root_cause_output=root_cause_output,
            )
            system_prompt = "You are the AI-Smart-Bug-Analyzer-And-Fix-Advisor Risk Assessment Agent. Predict production risk, business, customer, release, and security risks with an overall risk score."
            output = self.query_llm(system_prompt, user_prompt)
            
            # Validation
            if "production_risk" not in output:
                raise ValueError("Missing production_risk key in LLM response.")
            
            confidence = 0.85
            
        except Exception as exc:
            logger.warning("RiskAssessmentAgent LLM query failed. Falling back to rules. Error: %s", exc)
            output = self._heuristic_risk(triage_output)
            confidence = 0.70

        return AgentResult(
            agent_name="RiskAssessmentAgent",
            stage=self.stage,
            output=output,
            confidence=confidence,
        )

    def _heuristic_risk(self, triage: Dict[str, Any]) -> Dict[str, Any]:
        priority = triage.get("priority", "medium").lower()
        component = triage.get("component", "unknown").lower()
        
        # Calculate heuristics
        if priority == "critical":
            prod_risk = "critical"
            bus_risk = "critical"
            overall_score = 90
        elif priority == "high":
            prod_risk = "high"
            bus_risk = "high"
            overall_score = 75
        elif priority == "medium":
            prod_risk = "medium"
            bus_risk = "medium"
            overall_score = 50
        else:
            prod_risk = "low"
            bus_risk = "low"
            overall_score = 25

        # Critical components increase score
        if component in ["authentication", "database", "payment"]:
            prod_risk = "critical"
            overall_score = min(overall_score + 10, 100)

        return {
            "production_risk": prod_risk,
            "business_impact": bus_risk,
            "customer_impact": "high" if prod_risk in ["critical", "high"] else "medium",
            "release_impact": "medium" if prod_risk == "medium" else "low",
            "security_risk": "high" if component == "authentication" else "low",
            "overall_risk_score": overall_score,
            "rationale": f"Calculated based on priority classification '{priority}' and target component '{component}'."
        }
