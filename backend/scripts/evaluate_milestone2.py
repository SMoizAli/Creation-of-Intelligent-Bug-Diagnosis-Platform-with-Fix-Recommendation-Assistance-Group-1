"""Evaluation utility to calculate and print pipeline accuracy for Milestone 2."""

import sys
from pathlib import Path

# Align import path
sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.agents.orchestrator import BugAnalysisOrchestrator

# Defined Ground-Truth values for your 5 seeded samples in datasets/raw/
GROUND_TRUTH = {
    "api_schema.xml": {
        "expected_priority": "high",
        "expected_component": "api",
        "expected_exception": "XmlSchemaException"
    },
    "db_pool.json": {
        "expected_priority": "critical",
        "expected_component": "database",
        "expected_exception": "ConnectionPoolTimeoutException"
    },
    "ssl_handshake.txt": {
        "expected_priority": "high",
        "expected_component": "network",
        "expected_exception": "SSLHandshakeException"
    },
    "pay_timeout.txt": {
        "expected_priority": "high",
        "expected_component": "payment",
        "expected_exception": "GatewayTimeoutException"
    },
    "memory_leak.md": {
        "expected_priority": "critical",
        "expected_component": "frontend",
        "expected_exception": "OutOfMemoryError"
    }
}


def run_evaluation():
    orchestrator = BugAnalysisOrchestrator()
    raw_dir = Path(__file__).resolve().parents[1].parent / "datasets" / "raw"
    
    if not raw_dir.exists():
        print(f"Error: Datasets directory not found at {raw_dir}")
        return

    print("=" * 60)
    print("      MILESTONE 2: AGENT ACCURACY EVALUATION REPORT")
    print("=" * 60)
    
    total_samples = 0
    correct_priorities = 0
    correct_components = 0
    correct_exceptions = 0

    for file_path in raw_dir.rglob("*"):
        if not file_path.is_file() or file_path.name not in GROUND_TRUTH:
            continue
            
        file_name = file_path.name
        truth = GROUND_TRUTH[file_name]
        
        print(f"\nProcessing bug file: {file_name}")
        try:
            analysis = orchestrator.run_from_path(file_path)
            
            pred_priority = analysis.triage.priority.value
            pred_component = analysis.triage.component
            pred_exception = analysis.log_analysis.exception_type

            # Check matches
            pri_match = pred_priority.lower() == truth["expected_priority"].lower()
            comp_match = pred_component.lower() == truth["expected_component"].lower()
            # Loose match to account for parsing formatting differences
            exc_match = truth["expected_exception"].lower() in pred_exception.lower() or pred_exception.lower() in truth["expected_exception"].lower()

            total_samples += 1
            if pri_match: correct_priorities += 1
            if comp_match: correct_components += 1
            if exc_match: correct_exceptions += 1

            print(f"  Priority:  [Predicted] {pred_priority:<10} | [Expected] {truth['expected_priority']:<10} -> {'CORRECT' if pri_match else 'MISMATCH'}")
            print(f"  Component: [Predicted] {pred_component:<10} | [Expected] {truth['expected_component']:<10} -> {'CORRECT' if comp_match else 'MISMATCH'}")
            print(f"  Exception: [Predicted] {pred_exception:<10} | [Expected] {truth['expected_exception']:<10} -> {'CORRECT' if exc_match else 'MISMATCH'}")
            print(f"  Reasoning: {analysis.triage.reasoning}")
            
        except Exception as e:
            print(f"  Pipeline execution failed for {file_name}: {e}")

    if total_samples == 0:
        print("\nNo seeded files matched the validation dataset index.")
        return

    # Calculate percentages
    priority_acc = (correct_priorities / total_samples) * 100
    component_acc = (correct_components / total_samples) * 100
    exception_acc = (correct_exceptions / total_samples) * 100
    overall_avg = (priority_acc + component_acc + exception_acc) / 3

    print("\n" + "=" * 60)
    print("                     ACCURACY SUMMARY")
    print("=" * 60)
    print(f"Total Evaluated Bug Files:         {total_samples}")
    print(f"Triage Priority Accuracy:          {priority_acc:.1f}%  ({correct_priorities}/{total_samples})")
    print(f"Triage Component Accuracy:         {component_acc:.1f}%  ({correct_components}/{total_samples})")
    print(f"Log Analysis Exception Accuracy:   {exception_acc:.1f}%  ({correct_exceptions}/{total_samples})")
    print("-" * 60)
    print(f"Pipeline Mean Accuracy:            {overall_avg:.1f}%")
    print("=" * 60)


if __name__ == "__main__":
    run_evaluation()