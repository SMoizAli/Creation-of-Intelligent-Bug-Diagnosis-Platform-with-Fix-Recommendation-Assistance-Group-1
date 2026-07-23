"""Duplicate detection agent comparing reports against vectors."""

from typing import Any, Dict, List
from app.agents.base import BaseAgent
from app.models import AgentResult, WorkflowStage
from app.utils.logger import get_logger

logger = get_logger("agents.duplicate")


class DuplicateAgent(BaseAgent):
    stage = WorkflowStage.DUPLICATE_DETECTION
    prompt_file = "duplicate.txt"
    DUPLICATE_THRESHOLD = 0.75

    def run(
        self,
        bug_content: str,
        context: List[Dict[str, Any]],
        triage_output: Dict[str, Any],
        **_: Any,
    ) -> AgentResult:
        
        # Precompute similarity matches based on vector distance
        matches = []
        for item in context:
            distance = item.get("distance", 1.0)
            similarity = max(0.0, 1.0 - distance)
            if similarity >= 0.3:
                meta = item.get("metadata", {})
                matches.append({
                    "bug_id": meta.get("bug_id", item.get("id", "unknown")),
                    "similarity": round(similarity, 3),
                    "rationale": f"Vector distance similarity ({distance:.3f})",
                })
        
        matches.sort(key=lambda m: m["similarity"], reverse=True)
        top_match = matches[0] if matches else None
        
        try:
            logger.info("Executing DuplicateAgent using LLM")
            user_prompt = self.load_prompt(
                bug_content=bug_content,
                triage_output=triage_output,
                context=self._format_context(context),
            )
            system_prompt = "You are the AI-Smart-Bug-Analyzer-And-Fix-Advisor Duplicate Detection Agent. Determine if the current bug report matches past issues in the database."
            output = self.query_llm(system_prompt, user_prompt)
            
            # Basic schema validation
            if "is_duplicate" not in output:
                raise ValueError("Missing is_duplicate in LLM response.")
            
            confidence = 0.85
            
        except Exception as exc:
            logger.warning("DuplicateAgent LLM query failed. Falling back to heuristic rules. Error: %s", exc)
            
            is_duplicate = top_match is not None and top_match["similarity"] >= self.DUPLICATE_THRESHOLD
            output = {
                "is_duplicate": is_duplicate,
                "duplicate_of": top_match["bug_id"] if is_duplicate else None,
                "matches": matches[:5],
                "recommendation": "merge" if is_duplicate else ("investigate" if matches else "new_bug"),
            }
            confidence = top_match["similarity"] if top_match else 0.40

        return AgentResult(
            agent_name="DuplicateAgent",
            stage=self.stage,
            output=output,
            confidence=confidence,
        )
