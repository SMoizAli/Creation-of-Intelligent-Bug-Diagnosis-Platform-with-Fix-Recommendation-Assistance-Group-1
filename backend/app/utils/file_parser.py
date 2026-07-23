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
    def parse_pdf(content: bytes) -> str:
        # Try PyMuPDF (fitz)
        try:
            import fitz  # PyMuPDF
            doc = fitz.open(stream=content, filetype="pdf")
            text = ""
            for page in doc:
                text += page.get_text() + "\n"
            doc.close()
            if text.strip():
                return text.strip()
        except Exception as exc:
            logger.warning("PyMuPDF failed to extract PDF: %s", exc)

        # Fallback to pdfplumber
        try:
            import pdfplumber
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                text = ""
                for page in pdf.pages:
                    text += (page.extract_text() or "") + "\n"
                if text.strip():
                    return text.strip()
        except Exception as exc:
            logger.warning("pdfplumber failed to extract PDF: %s", exc)

        raise ValueError("Could not extract clean text from PDF using PyMuPDF or pdfplumber.")

    @staticmethod
    def parse_docx(content: bytes) -> str:
        try:
            import docx
            doc = docx.Document(io.BytesIO(content))
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            return "\n\n".join(paragraphs)
        except Exception as exc:
            raise ValueError(f"Failed to read DOCX file: {str(exc)}")

    @staticmethod
    def parse_csv(content: bytes) -> str:
        try:
            text = content.decode("utf-8", errors="replace")
            reader = csv.reader(io.StringIO(text))
            rows = list(reader)
            if not rows:
                return "Empty CSV data"
            
            # Format as markdown table
            headers = rows[0]
            col_count = len(headers)
            markdown = "| " + " | ".join(headers) + " |\n"
            markdown += "| " + " | ".join(["---"] * col_count) + " |\n"
            for row in rows[1:]:
                # Normalize row elements to header length
                padded_row = row + [""] * (col_count - len(row))
                padded_row = padded_row[:col_count]
                markdown += "| " + " | ".join(padded_row) + " |\n"
            return markdown
        except Exception as exc:
            raise ValueError(f"Failed to read CSV file: {str(exc)}")
