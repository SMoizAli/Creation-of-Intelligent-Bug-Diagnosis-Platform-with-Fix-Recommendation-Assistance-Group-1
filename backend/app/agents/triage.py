"""Triage agent – classifies bug priority, component, and impact."""

from typing import Any, Dict, List
from app.agents.base import BaseAgent
from app.models import AgentResult, BugPriority, WorkflowStage
from app.utils.logger import get_logger

logger = get_logger("agents.triage")


class TriageAgent(BaseAgent):
    stage = WorkflowStage.TRIAGE
    prompt_file = "triage.txt"

    def run(
        self,
        bug_content: str,
        context: List[Dict[str, Any]],
        **_: Any,
    ) -> AgentResult:
        try:
            logger.info("Executing TriageAgent using LLM")
            user_prompt = self.load_prompt(
                bug_content=bug_content,
                context=self._format_context(context),
            )
            system_prompt = "You are the AI-Smart-Bug-Analyzer-And-Fix-Advisor Triage Agent. Classify priority, severity, component, business impact, and assigned team."
            output = self.query_llm(system_prompt, user_prompt)
            
            required_keys = ["priority", "component", "severity_score", "reasoning"]
            if not all(k in output for k in required_keys):
                raise ValueError("LLM output is missing required fields.")
                
            if output.get("component", "unknown").lower() == "unknown":
                heuristic = self._heuristic_triage(bug_content, context)
                output["component"] = heuristic["component"]

            confidence = float(output.get("confidence", 0.90))
            
        except Exception as exc:
            logger.warning("TriageAgent LLM query failed. Falling back to heuristic rules. Error: %s", exc)
            output = self._heuristic_triage(bug_content, context)
            confidence = 0.70

        return AgentResult(
            agent_name="TriageAgent",
            stage=self.stage,
            output=output,
            confidence=confidence,
        )

    def _heuristic_triage(
        self,
        content: str,
        context: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Rule-based triage when LLM is unavailable."""
        lower = content.lower()
        priority = BugPriority.MEDIUM
        if any(w in lower for w in ("crash", "fatal", "critical", "down", "outage")):
            priority = BugPriority.CRITICAL
        elif any(w in lower for w in ("error", "exception", "failed", "timeout")):
            priority = BugPriority.HIGH
        elif any(w in lower for w in ("warning", "minor", "cosmetic")):
            priority = BugPriority.LOW

        component = "unknown"
        if "org.eclipse.swt" in lower or "widget is disposed" in lower:
            component = "SWT / UI Thread Runtime"
        elif "failed to parse notebook json" in lower:
            component = "Jupyter Web Frontend / nbformat Parser"
        elif "database is locked error on sqlite3" in lower or "places.sqlite" in lower:
            component = "SQLite Persistence Layer"
        else:
            for keyword, comp in [
                ("database", "database"), ("payment", "payment"), ("auth", "authentication"),
                ("ui", "frontend"), ("frontend", "frontend"), ("network", "network"),
                ("api", "api"),
            ]:
                if keyword in lower:
                    component = comp
                    break

        tags = []
        for tag in ["crash", "timeout", "memory", "security", "performance"]:
            if tag in lower:
                tags.append(tag)

        severity_score = 5
        if priority == BugPriority.CRITICAL:
            severity_score = 9
        elif priority == BugPriority.HIGH:
            severity_score = 7
        elif priority == BugPriority.LOW:
            severity_score = 3

        reason = f"Heuristics triggered: matched keyword patterns in content. Severity set to {severity_score}."

        return {
            "priority": priority.value,
            "component": component,
            "summary": content[:200] + ("..." if len(content) > 200 else ""),
            "tags": tags[:5],
            "severity_score": severity_score,
            "recommended_assignee_team": f"{component}-team",
            "business_impact": f"Potential service degradation in {component} component." if component != "unknown" else "Unknown system impact.",
            "reasoning": reason
        }
