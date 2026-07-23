"""Base agent class and prompt loading utilities."""

import json
import re
import time
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.config.settings import get_settings
from app.models import AgentResult, WorkflowStage
from app.services.llm_client import llm_client
from app.utils.logger import get_logger

logger = get_logger("agents.base")


class BaseAgent(ABC):
    """Abstract base for all AI-Smart-Bug-Analyzer-And-Fix-Advisor workflow agents."""

    stage: WorkflowStage
    prompt_file: str

    def __init__(self) -> None:
        self.settings = get_settings()

    def load_prompt(self, **kwargs: Any) -> str:
        prompt_path = self.settings.prompts_path / self.prompt_file
        template = prompt_path.read_text(encoding="utf-8")
        
        # Convert all values to string to ensure safe format operation
        str_kwargs = {k: str(v) for k, v in kwargs.items()}
        return template.format(**str_kwargs)

    def _parse_json_output(self, text: str) -> Dict[str, Any]:
        """Extract JSON from agent output, with fallback heuristics."""
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            # Look for JSON blocks in text
            match = re.search(r"\{[\s\S]*\}", text)
            if match:
                try:
                    return json.loads(match.group())
                except json.JSONDecodeError:
                    pass
        return {"raw_output": text}

    def _format_context(self, context: List[Dict[str, Any]]) -> str:
        if not context:
            return "No historical context available."
        parts = []
        for idx, item in enumerate(context, 1):
            meta = item.get("metadata", {})
            parts.append(
                f"[{idx}] Bug ID: {meta.get('bug_id', 'N/A')} | "
                f"Priority: {meta.get('priority', 'N/A')} | "
                f"Component: {meta.get('component', 'N/A')}\n"
                f"Text: {item.get('text', '')[:500]}"
            )
        return "\n\n".join(parts)

    def query_llm(self, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
        """Executes LLM request and parses structured JSON output."""
        response_text = llm_client.query(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.2
        )
        return self._parse_json_output(response_text)

    @abstractmethod
    def run(self, **kwargs: Any) -> AgentResult:
        """Subclasses implement main execution loop (LLM + fallback rules)."""
        ...

    def execute(self, **kwargs: Any) -> AgentResult:
        start = time.perf_counter()
        logger.info("Agent %s starting stage %s", self.__class__.__name__, self.stage)
        try:
            result = self.run(**kwargs)
            result.duration_ms = int((time.perf_counter() - start) * 1000)
            logger.info("Agent %s completed in %dms", self.__class__.__name__, result.duration_ms)
            return result
        except Exception as exc:
            logger.error("Agent %s failed: %s", self.__class__.__name__, exc, exc_info=True)
            return AgentResult(
                agent_name=self.__class__.__name__,
                stage=self.stage,
                output={"error": str(exc)},
                confidence=0.0,
                duration_ms=int((time.perf_counter() - start) * 1000),
            )
