"""Unit tests for the FileParsingEngine."""

import csv
import io
from app.utils.file_parser import FileParsingEngine


def test_parse_json():
    raw_json = b'{"status":"error","code":500,"details":{"message":"Connection timed out"}}'
    parsed = FileParsingEngine.parse("error.json", raw_json)
    
    # Assert JSON was pretty formatted
    assert "details" in parsed
    assert "  " in parsed  # indent indentation is present


def test_parse_xml():
    raw_xml = b'<error><code>500</code><message>Server Error</message></error>'
    parsed = FileParsingEngine.parse("error.xml", raw_xml)
    
    # Assert tag structures are verified
    assert "<error>" in parsed
    assert "message" in parsed


def test_parse_csv():
    # Write a simple CSV string
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "module", "message"])
    writer.writerow(["BUG-01", "auth", "Invalid signature"])
    writer.writerow(["BUG-02", "db", "Pool timeout"])
    csv_bytes = output.getvalue().encode("utf-8")
    
    parsed = FileParsingEngine.parse("log.csv", csv_bytes)
    
    # Assert Markdown table parsing
    assert "| id | module | message |" in parsed
    assert "| --- | --- | --- |" in parsed
    assert "| BUG-01 | auth | Invalid signature |" in parsed


def test_parse_log():
    raw_log = b"2024-01-15 10:30:00 [main] ERROR com.UserService - NullPointerException occurred\nWARNING: retry count reached"
    parsed = FileParsingEngine.parse("app.log", raw_log)
    
    # Assert logs levels extraction headings
    assert "[ERROR]" in parsed
    assert "[WARN]" in parsed
