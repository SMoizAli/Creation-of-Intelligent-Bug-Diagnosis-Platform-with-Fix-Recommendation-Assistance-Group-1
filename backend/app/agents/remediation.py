"""Remediation agent – proposes fixes and regression test plans."""

from typing import Any, Dict, List
from app.agents.base import BaseAgent
from app.models import AgentResult, WorkflowStage
from app.utils.logger import get_logger

logger = get_logger("agents.remediation")


class RemediationAgent(BaseAgent):
    stage = WorkflowStage.REMEDIATION
    prompt_file = "remediation.txt"

    def run(
        self,
        bug_content: str,
        context: List[Dict[str, Any]],
        root_cause_output: Dict[str, Any],
        duplicate_output: Dict[str, Any],
        **_: Any,
    ) -> AgentResult:
        try:
            logger.info("Executing RemediationAgent using LLM")
            user_prompt = self.load_prompt(
                bug_content=bug_content,
                context=self._format_context(context),
                root_cause_output=root_cause_output,
                duplicate_output=duplicate_output,
            )
            system_prompt = "You are the AI-Smart-Bug-Analyzer-And-Fix-Advisor Remediation Agent. Propose immediate fix, permanent fix, effort estimate, and regression tests."
            output = self.query_llm(system_prompt, user_prompt)
            
            # Validation
            if "permanent_fix" not in output:
                raise ValueError("Missing permanent_fix key in LLM response.")
            
            confidence = float(output.get("confidence", 0.85))
            
        except Exception as exc:
            logger.warning("RemediationAgent LLM query failed. Falling back to heuristic rules. Error: %s", exc)
            output = self._heuristic_remediation(root_cause_output, duplicate_output)
            confidence = output["confidence"]

        return AgentResult(
            agent_name="RemediationAgent",
            stage=self.stage,
            output=output,
            confidence=confidence,
        )

    def _heuristic_remediation(
        self,
        root_cause_output: Dict[str, Any],
        duplicate_output: Dict[str, Any],
    ) -> Dict[str, Any]:
        category = root_cause_output.get("root_cause_category", "unknown")
        is_duplicate = duplicate_output.get("is_duplicate", False)

        if is_duplicate:
            return {
                "immediate_mitigation": ["Link to existing bug ticket", "Apply known workaround from duplicate"],
                "permanent_fix": "Merge with duplicate bug ticket and apply existing resolution.",
                "effort_estimate": "small",
                "regression_tests": ["Verify duplicate fix still applies"],
                "remediation_plan": [
                    "Confirm duplicate match ID",
                    "Apply resolution from duplicate",
                    "Close current bug ticket"
                ],
                "confidence": 0.90,
                "risk_level": "low",
                "recommended_validation": "Check matching duplicate test cases."
            }
        else:
            return {
                "immediate_mitigation": self._mitigation_steps(category),
                "permanent_fix": f"Address {category}: {root_cause_output.get('hypothesis', 'Investigate and resolve.')}",
                "effort_estimate": self._effort_estimate(category),
                "regression_tests": self._regression_tests(category),
                "remediation_plan": self._remediation_plan(category),
                "confidence": root_cause_output.get("confidence", 0.50),
                "risk_level": "medium" if category in ["code_defect", "integration"] else "low",
                "recommended_validation": "Verify fixes in sandbox deployment environment."
            }

    @staticmethod
    def _mitigation_steps(category: str) -> List[str]:
        return {
            "code_defect": ["Add null pointer checks", "Deploy hotfix class file"],
            "configuration": ["Revert environment variable config", "Restart service container"],
            "infrastructure": ["Scale container instances", "Trigger load balancer failover"],
            "integration": ["Enable exponential backoff retries", "Switch connection to backup endpoint"],
        }.get(category, ["Monitor logs closely", "Run sandbox replication tests"])

    @staticmethod
    def _effort_estimate(category: str) -> str:
        return {"code_defect": "medium", "configuration": "small", "infrastructure": "large"}.get(
            category, "medium"
        )

    @staticmethod
    def _regression_tests(category: str) -> List[str]:
        return {
            "code_defect": ["Unit test matching edge case", "Integration test for module flows"],
            "configuration": ["Config validation parsing test", "Service start smoke tests"],
        }.get(category, ["End-to-end user smoke tests"])

    @staticmethod
    def _remediation_plan(category: str) -> List[str]:
        return [
            f"1. Validate root cause: {category}",
            "2. Implement fix branch",
            "3. Run regression tests",
            "4. Verify in staging environment",
            "5. Apply production release with diagnostics"
        ]
