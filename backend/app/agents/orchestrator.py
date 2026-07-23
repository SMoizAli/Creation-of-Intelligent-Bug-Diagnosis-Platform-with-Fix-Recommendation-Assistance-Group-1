"""Milestone 2 orchestrator: Triage -> Log Analysis -> UnifiedBugAnalysis -> processed store."""

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Union

from app.agents.log_analysis_agent import LogAnalysisAgent
from app.agents.triage_agent import TriageAgent
from app.config.settings import PROJECT_ROOT
from app.schemas.agent_schemas import UnifiedBugAnalysis
from app.utils.logger import get_logger

logger = get_logger("agents.orchestrator")


class BugAnalysisOrchestrator:
    """Runs Milestone 2 sequential agent pipeline and persists unified JSON output."""

    def __init__(
        self,
        processed_dir: Optional[Path] = None,
        triage_agent: Optional[TriageAgent] = None,
        log_analysis_agent: Optional[LogAnalysisAgent] = None,
    ) -> None:
        self.processed_dir = processed_dir or (PROJECT_ROOT / "datasets" / "processed")
        self.processed_dir.mkdir(parents=True, exist_ok=True)
        self.triage_agent = triage_agent or TriageAgent()
        self.log_analysis_agent = log_analysis_agent or LogAnalysisAgent()

    def run(
        self,
        raw_input: str,
        source_file: str = "inline",
        title: str = "",
    ) -> UnifiedBugAnalysis:
        """Execute triage and log analysis sequentially, then persist unified output."""
        logger.info("Starting Milestone 2 orchestration for source: %s", source_file)

        triage_result = self.triage_agent.analyze(raw_input)
        log_result = self.log_analysis_agent.analyze(raw_input)

        overall_confidence = round((triage_result.confidence + log_result.confidence) / 2, 3)
        overall_summary = (
            f"Priority: {triage_result.priority.value} | "
            f"Component: {triage_result.component} | "
            f"Errors: {log_result.error_count} | "
            f"Stack trace: {'yes' if log_result.has_stack_trace else 'no'}"
        )

        unified = UnifiedBugAnalysis(
            source_file=source_file,
            title=title or Path(source_file).stem,
            raw_input=raw_input,
            triage=triage_result,
            log_analysis=log_result,
            processed_at=datetime.now(timezone.utc),
            overall_summary=overall_summary,
            overall_confidence=overall_confidence,
        )

        output_path = self._save(unified)
        logger.info("Saved unified analysis to %s", output_path)
        return unified

    def run_from_path(self, file_path: Union[str, Path]) -> UnifiedBugAnalysis:
        """Load a raw bug file and run the Milestone 2 pipeline."""
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Raw bug file not found: {path}")
        content = path.read_text(encoding="utf-8")
        return self.run(raw_input=content, source_file=str(path.as_posix()), title=path.stem)

    def run_batch_from_raw_dir(self, raw_dir: Optional[Path] = None) -> List[UnifiedBugAnalysis]:
        """Process all files under datasets/raw/ recursively."""
        source_dir = raw_dir or (PROJECT_ROOT / "datasets" / "raw")
        if not source_dir.exists():
            raise FileNotFoundError(f"Raw datasets directory not found: {source_dir}")

        results: List[UnifiedBugAnalysis] = []
        for file_path in sorted(source_dir.rglob("*")):
            if file_path.is_file():
                results.append(self.run_from_path(file_path))
        return results

    def _save(self, analysis: UnifiedBugAnalysis) -> Path:
        safe_name = Path(analysis.source_file).name.replace(" ", "_")
        timestamp = analysis.processed_at.strftime("%Y%m%dT%H%M%S")
        filename = f"{analysis.analysis_id}_{safe_name}_{timestamp}.json"
        output_path = self.processed_dir / filename
        output_path.write_text(
            json.dumps(analysis.model_dump(mode="json"), indent=2),
            encoding="utf-8",
        )
        return output_path
