"""Pytest validation for Milestone 2 orchestrator pipeline."""

from typing import List

import json
from pathlib import Path

import pytest

from app.agents.orchestrator import BugAnalysisOrchestrator
from app.schemas.agent_schemas import UnifiedBugAnalysis

BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_ROOT.parent
RAW_DIR = PROJECT_ROOT / "datasets" / "raw"
PROCESSED_DIR = PROJECT_ROOT / "datasets" / "processed"


def _collect_raw_samples() -> List[Path]:
    if not RAW_DIR.exists():
        return []
    return sorted(path for path in RAW_DIR.rglob("*") if path.is_file())


@pytest.fixture
def orchestrator(tmp_path):
    return BugAnalysisOrchestrator(processed_dir=tmp_path / "processed")


@pytest.mark.parametrize("sample_path", _collect_raw_samples())
def test_orchestrator_output_matches_unified_schema(orchestrator, sample_path):
    """Each raw sample must produce JSON that validates as UnifiedBugAnalysis."""
    result = orchestrator.run_from_path(sample_path)

    assert isinstance(result, UnifiedBugAnalysis)
    assert result.triage.component
    assert result.log_analysis.log_format
    assert result.overall_confidence >= 0.0

    payload = json.loads(result.model_dump_json())
    validated = UnifiedBugAnalysis.model_validate(payload)
    assert validated.analysis_id == result.analysis_id
    assert validated.source_file.endswith(sample_path.name)


def test_orchestrator_processes_five_raw_samples(orchestrator):
    """Milestone 2 requires validation against five datasets/raw/ samples."""
    samples = _collect_raw_samples()
    assert len(samples) >= 5, f"Expected at least 5 raw samples, found {len(samples)}"

    results = [orchestrator.run_from_path(path) for path in samples[:5]]
    assert len(results) == 5

    for result in results:
        UnifiedBugAnalysis.model_validate_json(result.model_dump_json())

    saved_files = list((orchestrator.processed_dir).glob("*.json"))
    assert len(saved_files) >= 5
