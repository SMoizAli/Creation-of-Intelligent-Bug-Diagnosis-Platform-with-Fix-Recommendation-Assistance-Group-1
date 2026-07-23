"""Custom logging configuration."""

import logging
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

from app.config.settings import get_settings


def setup_logging() -> logging.Logger:
    """Configure application-wide logging with console and rotating file handlers."""
    settings = get_settings()
    log_dir: Path = settings.log_path
    log_file = log_dir / "ai-smart-bug-analyzer-and-fix-advisor.log"

    root = logging.getLogger("ai_smart_bug_analyzer_and_fix_advisor")
    if root.handlers:
        return root

    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    root.setLevel(level)

    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(formatter)
    root.addHandler(console)

    file_handler = RotatingFileHandler(
        log_file,
        maxBytes=5 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    file_handler.setFormatter(formatter)
    root.addHandler(file_handler)

    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    return root


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(f"ai_smart_bug_analyzer_and_fix_advisor.{name}")
