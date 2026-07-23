"""Confidence agent aggregating workflow execution scores."""

from typing import Any, Dict, List
from app.agents.base import BaseAgent
from app.models import AgentResult, WorkflowStage
from app.utils.logger import get_logger

logger = get_logger("agents.confidence")


class ConfidenceAgent(BaseAgent):
    stage = WorkflowStage.CONFIDENCE_SCORING
    prompt_file = "confidence.txt"

    def run(
        self,
        bug_content: str,
        agent_results: List[Dict[str, Any]],
        **_: Any,
    ) -> AgentResult:
        try:
            logger.info("Executing ConfidenceAgent using LLM")
            user_prompt = self.load_prompt(
                bug_content=bug_content,
                agent_results=agent_results,
            )
            system_prompt = "You are the AI-Smart-Bug-Analyzer-And-Fix-Advisor Confidence Agent. Assign an overall confidence score (0.0 to 1.0) and explain key factors."
            output = self.query_llm(system_prompt, user_prompt)
            
            # Validation
            if "confidence_score" not in output:
                raise ValueError("Missing confidence_score key in LLM response.")
            
            confidence = float(output.get("confidence_score", 0.85))
            
        except Exception as exc:
            logger.warning("ConfidenceAgent LLM query failed. Falling back to average. Error: %s", exc)
            output = self._heuristic_confidence(agent_results)
            confidence = output["confidence_score"]

        return AgentResult(
            agent_name="ConfidenceAgent",
            stage=self.stage,
            output=output,
            confidence=confidence,
        )

    def _heuristic_confidence(self, agent_results: List[Dict[str, Any]]) -> Dict[str, Any]:
        scores = []
        factors = []
        for r in agent_results:
            name = r.get("agent_name", "Unknown")
            conf = r.get("confidence", 0.5)
            scores.append(conf)
            factors.append(f"{name} returned confidence: {conf:.2f}")
            
        avg_score = sum(scores) / len(scores) if scores else 0.70
        
        return {
            "confidence_score": round(avg_score, 2),
            "rationale": "Average confidence calculated from preceding agent results.",
            "key_factors": factors[:5],
            "recommendations": ["Ensure all required log files and stack traces are attached to maximize signal accuracy."]
        }
