"""Milestone 2 Triage Agent using LangChain and OpenAI with heuristic fallback."""

import json
import re
from typing import Any, Dict, List, Optional

from app.config.settings import get_settings
from app.models import BugPriority
from app.schemas.agent_schemas import TriageResult
from app.utils.logger import get_logger

logger = get_logger("agents.triage_agent")

TRIAGE_SYSTEM_PROMPT = (
    "You are the AI-Smart-Bug-Analyzer-And-Fix-Advisor Triage Agent. "
    "Classify priority, severity, component, business impact, and assigned team. "
    "Provide clear reasoning for your choices. "
    "Respond with valid JSON only."
)

TRIAGE_USER_TEMPLATE = """Analyze the following bug report and classify it.

## Bug Report
{bug_content}

Respond in JSON format:
{{
  "priority": "<critical|high|medium|low|unknown>",
  "component": "<component>",
  "summary": "<summary>",
  "tags": ["tag1"],
  "severity_score": <1-10>,
  "recommended_assignee_team": "<team>",
  "business_impact": "<impact>",
  "confidence": <0.0-1.0>,
  "reasoning": "<Provide a concise explanation of why this priority, severity, and component were chosen>"
}}"""


class TriageAgent:
    """LangChain-powered triage agent for Milestone 2 pipeline."""

    def __init__(self) -> None:
        self.settings = get_settings()

    def analyze(self, bug_content: str, context: Optional[List[Dict[str, Any]]] = None) -> TriageResult:
        """Run triage on raw bug content and return a validated schema."""
        _ = context
        try:
            payload = self._query_langchain(bug_content)
            return TriageResult.model_validate(payload)
        except Exception as exc:
            logger.warning("TriageAgent LangChain query failed, using heuristics: %s", exc)
            return self._heuristic_triage(bug_content)

    def _query_langchain(self, bug_content: str) -> Dict[str, Any]:
        if not self.settings.llm_api_key and self.settings.llm_provider.lower() == "openai":
            raise ValueError("LLM API key is not configured.")

        from langchain_core.messages import HumanMessage, SystemMessage
        from langchain.chat_models import init_chat_model

        llm = init_chat_model(
            model=self.settings.llm_model,
            model_provider=self.settings.llm_provider.lower(),
            temperature=0.2,
            api_key=self.settings.llm_api_key or None,
        )
        structured_llm = llm.with_structured_output(TriageResult)
        user_prompt = TRIAGE_USER_TEMPLATE.format(bug_content=bug_content)
        result = structured_llm.invoke(
            [
                SystemMessage(content=TRIAGE_SYSTEM_PROMPT),
                HumanMessage(content=user_prompt),
            ]
        )
        if isinstance(result, TriageResult):
            return result.model_dump()
        return TriageResult.model_validate(result).model_dump()

    def _heuristic_triage(self, content: str) -> TriageResult:
        lower = content.lower()
        
        # 1. Precise Component & Priority Fingerprinting
        if "xml" in lower or "schema" in lower:
            component = "api"
            priority = BugPriority.HIGH
        elif "connectionpool" in lower or "pool" in lower or "db_pool" in lower:
            component = "database"
            priority = BugPriority.CRITICAL
        elif "ssl" in lower or "handshake" in lower:
            component = "network"
            priority = BugPriority.HIGH
        elif "gateway" in lower or "pay_timeout" in lower or "payment" in lower:
            component = "payment"
            priority = BugPriority.HIGH
        elif "outofmemory" in lower or "memory" in lower or "leak" in lower:
            component = "frontend"
            priority = BugPriority.CRITICAL
        else:
            # Safe Fallback
            component = "unknown"
            priority = BugPriority.MEDIUM

        tags = [tag for tag in ("crash", "timeout", "memory", "security", "performance") if tag in lower]
        severity_score = 5
        if priority == BugPriority.CRITICAL:
            severity_score = 9
        elif priority == BugPriority.HIGH:
            severity_score = 7
        elif priority == BugPriority.LOW:
            severity_score = 3

        reason = f"Heuristics triggered: matched keyword patterns in content. Severity set to {severity_score}."

        return TriageResult(
            priority=priority,
            component=component,
            summary=content[:200] + ("..." if len(content) > 200 else ""),
            tags=tags[:5],
            severity_score=severity_score,
            recommended_assignee_team=f"{component}-team",
            business_impact=(
                f"Potential service degradation in {component} component."
                if component != "unknown"
                else "Unknown system impact."
            ),
            confidence=0.70,
            reasoning=reason,
        )

    @staticmethod
    def _parse_json_output(text: str) -> Dict[str, Any]:
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            match = re.search(r"\{[\s\S]*\}", text)
            if match:
                return json.loads(match.group())
        raise ValueError("Unable to parse triage JSON output.")