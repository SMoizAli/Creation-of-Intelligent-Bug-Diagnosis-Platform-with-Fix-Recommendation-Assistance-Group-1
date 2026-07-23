"""CLI utilities for batch Milestone 2 processing."""

import sys
from pathlib import Path
from typing import Optional

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.agents.orchestrator import BugAnalysisOrchestrator


def run_milestone2_batch(raw_dir: Optional[Path] = None) -> int:
    """Process all raw bug samples and write unified JSON to datasets/processed/."""
    orchestrator = BugAnalysisOrchestrator()
    results = orchestrator.run_batch_from_raw_dir(raw_dir)
    print(f"Processed {len(results)} bug sample(s).")
    return len(results)


if __name__ == "__main__":
    run_milestone2_batch()
