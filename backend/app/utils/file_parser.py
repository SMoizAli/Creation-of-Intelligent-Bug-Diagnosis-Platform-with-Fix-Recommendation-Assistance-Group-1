"""Multi-format file parsing engine for extracting bug report text."""

import csv
import io
import json
import re
from pathlib import Path
from app.utils.logger import get_logger

logger = get_logger("utils.file_parser")


class FileParsingEngine:
    """Parses various document types and extracts clean textual content."""

    @classmethod
    def parse(cls, filename: str, content: bytes) -> str:
        ext = Path(filename).suffix.lower()
        logger.info("Parsing file %s (ext=%s, size=%d bytes)", filename, ext, len(content))

        try:
            if ext == ".txt":
                return cls.parse_txt(content)
            elif ext == ".log":
                return cls.parse_log(content)
            elif ext == ".json":
                return cls.parse_json(content)
            elif ext == ".xml":
                return cls.parse_xml(content)
            elif ext == ".pdf":
                return cls.parse_pdf(content)
            elif ext == ".docx":
                return cls.parse_docx(content)
            elif ext == ".csv":
                return cls.parse_csv(content)
            elif ext == ".md":
                return cls.parse_md(content)
            else:
                # Default decoding fallback
                return content.decode("utf-8", errors="replace")
        except Exception as exc:
            logger.error("Failed to parse file %s: %s", filename, exc, exc_info=True)
            return f"[Error: Failed to parse file content. Technical Reason: {str(exc)}]"

    @staticmethod
    def parse_txt(content: bytes) -> str:
        return content.decode("utf-8", errors="replace")

    @staticmethod
    def parse_md(content: bytes) -> str:
        return content.decode("utf-8", errors="replace")

    @staticmethod
    def parse_log(content: bytes) -> str:
        text = content.decode("utf-8", errors="replace")
        # Try to identify structured patterns in logs and display them cleanly
        lines = text.splitlines()
        parsed_lines = []
        for line in lines:
            line_strip = line.strip()
            if not line_strip:
                continue
            
            # Simple metadata extraction for presentation
            level = "INFO"
            if any(lvl in line_strip.upper() for lvl in ["ERROR", "FATAL", "CRITICAL"]):
                level = "ERROR"
            elif "WARN" in line_strip.upper():
                level = "WARN"
            elif "DEBUG" in line_strip.upper():
                level = "DEBUG"
                
            parsed_lines.append(f"[{level}] {line_strip}")
            
        return "\n".join(parsed_lines)

    @staticmethod
    def parse_json(content: bytes) -> str:
        text = content.decode("utf-8", errors="replace")
        try:
            data = json.loads(text)
            return json.dumps(data, indent=2)
        except Exception as exc:
            logger.warning("Invalid JSON structure: %s", exc)
            return text

    @staticmethod
    def parse_xml(content: bytes) -> str:
        text = content.decode("utf-8", errors="replace")
        try:
            from lxml import etree
            parser = etree.XMLParser(recover=True, remove_blank_text=True)
            root = etree.fromstring(content, parser=parser)
            return etree.tostring(root, pretty_print=True, encoding="utf-8").decode("utf-8")
        except Exception as exc:
            logger.warning("XML parsing failed with lxml, falling back to raw: %s", exc)
            return text

    @staticmethod
    def _sanitize_extracted_text(text: str, max_chars: int = 80000) -> str:
        """Prevent memory bloat by capping extracted text to relevant bounds."""
        if not text:
            return ""
        if len(text) <= max_chars:
            return text.strip()
        # Retain beginning and end of long files (where error traces & summaries live)
        head_chars = max_chars // 2
        tail_chars = max_chars // 2
        truncated_msg = f"\n\n[... Truncated {len(text) - max_chars} characters for memory optimization ...]\n\n"
        return text[:head_chars].strip() + truncated_msg + text[-tail_chars:].strip()

    @staticmethod
    def parse_pdf(content: bytes) -> str:
        """Memory-safe PDF extraction using streaming and strict page limits."""
        import gc
        extracted_pages = []
        max_pages = 25

        # Attempt 1: pypdf (extremely lightweight, pure python)
        try:
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(content))
            for idx, page in enumerate(reader.pages):
                if idx >= max_pages:
                    extracted_pages.append(f"\n[... Max {max_pages} pages processed ...]")
                    break
                page_text = page.extract_text() or ""
                if page_text.strip():
                    extracted_pages.append(page_text)
            
            del reader
            gc.collect()
            if extracted_pages:
                return FileParsingEngine._sanitize_extracted_text("\n\n".join(extracted_pages))
        except Exception as pypdf_exc:
            logger.debug("pypdf extraction skipped/failed: %s", pypdf_exc)

        # Attempt 2: PyMuPDF (fitz) with per-page text extraction
        try:
            import fitz
            doc = fitz.open(stream=content, filetype="pdf")
            for idx, page in enumerate(doc):
                if idx >= max_pages:
                    extracted_pages.append(f"\n[... Max {max_pages} pages processed ...]")
                    break
                extracted_pages.append(page.get_text())
            doc.close()
            del doc
            gc.collect()
            if extracted_pages:
                return FileParsingEngine._sanitize_extracted_text("\n\n".join(extracted_pages))
        except Exception as fitz_exc:
            logger.debug("fitz extraction skipped/failed: %s", fitz_exc)

        # Attempt 3: Lightweight raw regex text extraction fallback
        try:
            raw_text = content.decode("latin-1", errors="ignore")
            matches = re.findall(r"\(([^\(\)\\]{3,})\)", raw_text)
            if matches:
                return FileParsingEngine._sanitize_extracted_text(" ".join(matches[:2000]))
        except Exception:
            pass

        return "[PDF Content: Text layer empty or scannable document extracted]"

    @staticmethod
    def parse_docx(content: bytes) -> str:
        try:
            import docx
            import gc
            doc = docx.Document(io.BytesIO(content))
            paragraphs = [p.text for idx, p in enumerate(doc.paragraphs) if p.text.strip() and idx < 500]
            del doc
            gc.collect()
            return FileParsingEngine._sanitize_extracted_text("\n\n".join(paragraphs))
        except Exception as exc:
            return f"[Error: Failed to read DOCX: {str(exc)}]"

    @staticmethod
    def parse_csv(content: bytes) -> str:
        try:
            text = content.decode("utf-8", errors="replace")
            reader = csv.reader(io.StringIO(text))
            rows = []
            for idx, row in enumerate(reader):
                if idx > 300:
                    rows.append(["... Truncated remaining rows ..."])
                    break
                rows.append(row)
            if not rows:
                return "Empty CSV data"
            
            headers = rows[0]
            col_count = len(headers)
            markdown = "| " + " | ".join(headers) + " |\n"
            markdown += "| " + " | ".join(["---"] * col_count) + " |\n"
            for row in rows[1:]:
                padded_row = row + [""] * (col_count - len(row))
                padded_row = padded_row[:col_count]
                markdown += "| " + " | ".join(padded_row) + " |\n"
            return FileParsingEngine._sanitize_extracted_text(markdown)
        except Exception as exc:
            return f"[Error: Failed to read CSV: {str(exc)}]"
