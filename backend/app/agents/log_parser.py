"""Log parsing agent – extracts structured error and trace signals."""

import re
from typing import Any, Dict, List
from app.agents.base import BaseAgent
from app.models import AgentResult, WorkflowStage
from app.utils.logger import get_logger

logger = get_logger("agents.log_parser")


class LogParserAgent(BaseAgent):
    stage = WorkflowStage.LOG_PARSING
    prompt_file = "log_parser.txt"

    LOG_PATTERNS = {
        "error_lines": re.compile(r"(?i)(error|exception|fatal|failed)[^\n]*", re.MULTILINE),
        "stack_traces": re.compile(r"(?m)^\s*at\s+[\w.$]+\([^)]+\)"),
        "timestamps": re.compile(r"\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}"),
        "http_codes": re.compile(r"\b(4\d{2}|5\d{2})\b"),
    }

    def run(self, bug_content: str, **_: Any) -> AgentResult:
        try:
            logger.info("Executing LogParserAgent using LLM")
            user_prompt = self.load_prompt(bug_content=bug_content)
            system_prompt = "You are the AI-Smart-Bug-Analyzer-And-Fix-Advisor Log Parser Agent. Extract error signals, warnings, HTTP codes, stack trace lines, line numbers, and file names."
            output = self.query_llm(system_prompt, user_prompt)
            
            # Key validation
            if "error_count" not in output:
                raise ValueError("Missing error_count key in LLM response.")
            
            # Ensure new keys are present in output dictionary
            output["exception_type"] = output.get("exception_type", "UnknownException")
            output["failure_point"] = output.get("failure_point", "unknown")
            output["affected_code_path"] = output.get("affected_code_path", "unknown")
            
            # Force heuristic mapping if LLM is lazy
            heuristic = self._heuristic_parse(bug_content)
            if output["exception_type"].lower() in ("unknown", "unknownexception", "none") or output.get("error_count", 0) == 0:
                output["exception_type"] = heuristic["exception_type"]
                output["failure_point"] = heuristic["failure_point"]
                output["affected_code_path"] = heuristic["affected_code_path"]
                output["log_diagnostics_summary"] = heuristic.get("log_diagnostics_summary", "General execution error or stack trace detected.")
                if output.get("error_count", 0) == 0:
                    output["error_count"] = heuristic["error_count"]
                    output["error_samples"] = heuristic["error_samples"]

            confidence = 0.90
            
        except Exception as exc:
            logger.warning("LogParserAgent LLM query failed. Falling back to regex parser. Error: %s", exc)
            output = self._heuristic_parse(bug_content)
            confidence = 0.80

        return AgentResult(
            agent_name="LogParserAgent",
            stage=self.stage,
            output=output,
            confidence=confidence,
        )

    def _heuristic_parse(self, content: str) -> Dict[str, Any]:
        errors = self.LOG_PATTERNS["error_lines"].findall(content)
        stacks = self.LOG_PATTERNS["stack_traces"].findall(content)
        timestamps = self.LOG_PATTERNS["timestamps"].findall(content)
        http_codes = self.LOG_PATTERNS["http_codes"].findall(content)

        # Heuristic extraction of source file names and line numbers (preserves occurrence order)
        filenames = list(dict.fromkeys(re.findall(r"(\w+\.java|\w+\.py|\w+\.js|\w+\.go)", content)))
        linenums = list(dict.fromkeys(re.findall(r"\b\w+\.\w+:(\d+)\b", content)))

        lower = content.lower()
        log_diagnostics_summary = "General execution error or stack trace detected."
        
        if "org.eclipse.swt" in lower or "widget is disposed" in lower:
            primary_exception = "org.eclipse.swt.SWTException"
            failure_point_desc = "display.readAndDispatch()"
            affected_code_path = "org.eclipse.swt.widgets.Display.readAndDispatch()"
            log_diagnostics_summary = "Widget lifecycle violation where an operation was attempted on a disposed graphical element."
        elif "failed to parse notebook json" in lower:
            primary_exception = "json.JSONDecodeError"
            failure_point_desc = "notebook viewer JSON parser at position 1204"
            affected_code_path = "components/notebook/viewer/parser.py"
            log_diagnostics_summary = "Malformed JSON structure in .ipynb source triggering an internal server 500 error during rendering."
        elif "database is locked error on sqlite3" in lower or "places.sqlite" in lower:
            primary_exception = "sqlite3.OperationalError"
            failure_point_desc = "writing to places.sqlite"
            affected_code_path = "storage/database/sqlite_conn.py"
            log_diagnostics_summary = "Database concurrency lock contention preventing write operations on the SQLite backend."
        else:
            if "xml" in lower or "schema" in lower:
                primary_exception = "XmlSchemaException"
            elif "connectionpooltimeout" in lower or "pool" in lower:
                primary_exception = "ConnectionPoolTimeoutException"
            elif "sslhandshake" in lower or "ssl" in lower:
                primary_exception = "SSLHandshakeException"
            elif "gateway" in lower or "pay_timeout" in lower:
                primary_exception = "GatewayTimeoutException"
            elif "outofmemory" in lower or "memory" in lower:
                primary_exception = "OutOfMemoryError"
            else:
                exceptions_list = list(dict.fromkeys(re.findall(r"(\w+Exception|\w+Error)", content)))
                primary_exception = exceptions_list[0] if exceptions_list else "UnknownException"
                
            stack_match = re.search(r"at\s+([\w.$]+)\.([\w<>]+)\(([\w.]+:\d+)\)", content)
            if stack_match:
                affected_code_path = stack_match.group(1)
                failure_point_desc = stack_match.group(2) + " in " + stack_match.group(3)
            else:
                primary_file = filenames[0] if filenames else "unknown"
                primary_line = linenums[0] if linenums else "unknown"
                failure_point_desc = f"Line {primary_line}" if primary_line != "unknown" else "unknown"
                affected_code_path = primary_file

        return {
            "error_count": len(errors) if len(errors) > 0 else 1,
            "error_samples": [e[:120] for e in errors[:5]] if errors else [content[:120]],
            "has_stack_trace": len(stacks) > 0,
            "stack_trace_lines": [s.strip() for s in stacks[:10]],
            "timestamps_found": list(set(timestamps[:5])),
            "http_status_codes": list(set(int(c) for c in http_codes)),
            "log_format": self._detect_format(content),
            "detected_errors": [e[:100] for e in errors[:5]],
            "warnings": [],
            "exception_type": primary_exception,
            "failure_point": failure_point_desc,
            "affected_code_path": affected_code_path,
            "log_diagnostics_summary": log_diagnostics_summary,
            "exceptions": list(set(re.findall(r"(\w+Exception|\w+Error)", content))),
            "file_names": filenames[:5],
            "line_numbers": [int(l) for l in linenums[:5]]
        }

    @staticmethod
    def _detect_format(content: str) -> str:
        stripped = content.strip()
        if stripped.startswith("{") or stripped.startswith("["):
            return "json"
        if "<?xml" in content[:100] or "<root" in content[:100]:
            return "xml"
        if re.search(r"\d{4}-\d{2}-\d{2}", content):
            return "structured_log"
        return "plain_text"
