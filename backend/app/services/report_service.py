"""Report generation service for generating TXT, Markdown, and PDF bug analysis reports."""

import io
from datetime import datetime
from typing import Tuple
from app.models import Analysis, Bug
from app.utils.logger import get_logger

logger = get_logger("services.report_service")


class ReportService:
    """Generates downloadable report files from analysis findings."""

    @classmethod
    def generate_report(cls, analysis: Analysis, bug: Bug, format_type: str) -> Tuple[bytes, str, str]:
        format_type = format_type.lower()
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        
        if format_type == "markdown" or format_type == "md":
            md_text = cls._generate_markdown(analysis, bug)
            content = md_text.encode("utf-8")
            return content, "text/markdown", f"ai-smart-bug-analyzer-and-fix-advisor-report-{bug.id}-{timestamp}.md"
            
        elif format_type == "text" or format_type == "txt":
            txt_text = cls._generate_txt(analysis, bug)
            content = txt_text.encode("utf-8")
            return content, "text/plain", f"ai-smart-bug-analyzer-and-fix-advisor-report-{bug.id}-{timestamp}.txt"
            
        elif format_type == "pdf":
            pdf_bytes = cls._generate_pdf(analysis, bug)
            return pdf_bytes, "application/pdf", f"ai-smart-bug-analyzer-and-fix-advisor-report-{bug.id}-{timestamp}.pdf"
            
        else:
            raise ValueError(f"Unsupported report format: {format_type}")

    @classmethod
    def _generate_txt(cls, analysis: Analysis, bug: Bug) -> str:
        triage = analysis.triage or {}
        rc = analysis.root_cause or {}
        rem = analysis.remediation or {}
        risk = analysis.risk_assessment or {}
        conf = analysis.confidence_scoring or {}
        exec_sum = analysis.executive_summary or {}

        lines = [
            "=" * 80,
            "                   AI-Smart-Bug-Analyzer-And-Fix-Advisor ENTERPRISE BUG ANALYSIS REPORT",
            "=" * 80,
            f"Generated On: {datetime.utcnow().isoformat()} UTC",
            f"Report ID:    {analysis.id}",
            "-" * 80,
            "1. BUG DETAILS",
            "-" * 80,
            f"Bug ID:      {bug.id}",
            f"Title:       {bug.title}",
            f"Component:   {triage.get('component', bug.metadata.component or 'Unknown')}",
            f"Priority:    {triage.get('priority', bug.metadata.priority.value or 'Unknown')}",
            f"Severity:    {triage.get('severity_score', 'Unknown')}",
            f"Source:      {bug.metadata.source}",
            f"Description: {bug.description}",
            "\n" + "-" * 80,
            "2. EXECUTIVE SUMMARY",
            "-" * 80,
            exec_sum.get("summary", "No executive summary available."),
            f"Business Impact Summary:  {exec_sum.get('business_impact_summary', 'N/A')}",
            f"Recommended Main Action:   {exec_sum.get('recommended_action', 'N/A')}",
            f"Estimated Resolution Time: {exec_sum.get('estimated_resolution_time', 'N/A')}",
            "\n" + "-" * 80,
            "3. ROOT CAUSE ANALYSIS",
            "-" * 80,
            f"Root Cause Category: {rc.get('root_cause_category', 'N/A')}",
            f"Hypothesis:          {rc.get('hypothesis', 'N/A')}",
            f"Rationale:           {rc.get('rationale', 'N/A')}",
            "\nEvidence Found:",
        ]
        
        for ev in rc.get("evidence", []):
            lines.append(f"  * {ev}")
            
        lines.append("\nLikely Affected Files:")
        for f in rc.get("likely_source_files", []):
            lines.append(f"  - {f}")
            
        lines.extend([
            "\n" + "-" * 80,
            "4. REMEDIATION & WORKAROUNDS",
            "-" * 80,
            f"Immediate Mitigation:",
        ])
        for step in rem.get("immediate_mitigation", []):
            lines.append(f"  - {step}")
            
        lines.extend([
            f"\nPermanent Fix Plan:",
            f"  {rem.get('permanent_fix', 'N/A')}",
            f"\nEffort Estimate: {rem.get('effort_estimate', 'N/A')}",
            f"Risk Level:      {rem.get('risk_level', 'N/A')}",
            f"\nRegression Tests Required:"
        ])
        for test in rem.get("regression_tests", []):
            lines.append(f"  * {test}")

        lines.extend([
            "\n" + "-" * 80,
            "5. RISK ASSESSMENT & SEGREGATION",
            "-" * 80,
            f"Production Risk:  {risk.get('production_risk', 'N/A')}",
            f"Business Impact:  {risk.get('business_impact', 'N/A')}",
            f"Customer Impact:  {risk.get('customer_impact', 'N/A')}",
            f"Release Risk:     {risk.get('release_impact', 'N/A')}",
            f"Security Risk:    {risk.get('security_risk', 'N/A')}",
            f"Overall Risk Score: {risk.get('overall_risk_score', 'N/A')} / 100",
            "\n" + "-" * 80,
            "6. REPORT CONFIDENCE SCORING",
            "-" * 80,
            f"Overall Confidence Score: {conf.get('confidence_score', 0.0)} / 1.0",
            f"Confidence Rationale:     {conf.get('rationale', 'N/A')}",
            "=" * 80
        ])
        return "\n".join(lines)

    @classmethod
    def _generate_markdown(cls, analysis: Analysis, bug: Bug) -> str:
        triage = analysis.triage or {}
        rc = analysis.root_cause or {}
        rem = analysis.remediation or {}
        risk = analysis.risk_assessment or {}
        conf = analysis.confidence_scoring or {}
        exec_sum = analysis.executive_summary or {}

        md = [
            f"# AI-Smart-Bug-Analyzer-And-Fix-Advisor Enterprise Analysis Report",
            f"*Generated on: `{datetime.utcnow().isoformat()} UTC`*",
            f"*Report ID: `{analysis.id}`*",
            f"",
            f"## 1. Executive Summary",
            f"> {exec_sum.get('summary', 'No executive summary available.')}",
            f"",
            f"| Metric | Value |",
            f"| :--- | :--- |",
            f"| **Recommended Action** | {exec_sum.get('recommended_action', 'N/A')} |",
            f"| **Business Impact** | {exec_sum.get('business_impact_summary', 'N/A')} |",
            f"| **Est. Resolution Time** | {exec_sum.get('estimated_resolution_time', 'N/A')} |",
            f"",
            f"## 2. Bug Details",
            f"- **Bug ID**: `{bug.id}`",
            f"- **Title**: {bug.title}",
            f"- **Component**: `{triage.get('component', bug.metadata.component or 'Unknown')}`",
            f"- **Priority**: **{triage.get('priority', bug.metadata.priority.value or 'Unknown').upper()}**",
            f"- **Severity Score**: `{triage.get('severity_score', 'N/A')}/10`",
            f"- **Source**: `{bug.metadata.source}`",
            f"",
            f"### Raw Content / Description",
            f"```text",
            f"{bug.description}",
            f"```",
            f"",
            f"## 3. Root Cause Analysis",
            f"- **Root Cause Category**: `{rc.get('root_cause_category', 'N/A')}`",
            f"- **Hypothesis**: *{rc.get('hypothesis', 'N/A')}*",
            f"- **Rationale**: {rc.get('rationale', 'N/A')}",
            f"",
            f"#### Evidence Found",
        ]
        
        for ev in rc.get("evidence", []):
            md.append(f"- [x] {ev}")
            
        md.append(f"")
        md.append(f"#### Likely Affected Source Files")
        for f in rc.get("likely_source_files", []):
            md.append(f"- `{f}`")
            
        md.extend([
            f"",
            f"## 4. Remediation & Workarounds",
            f"### Immediate Mitigation",
        ])
        for step in rem.get("immediate_mitigation", []):
            md.append(f"- {step}")
            
        md.extend([
            f"",
            f"### Permanent Fix",
            f"> {rem.get('permanent_fix', 'N/A')}",
            f"",
            f"- **Effort Estimate**: `{rem.get('effort_estimate', 'N/A')}`",
            f"- **Risk Level**: `{rem.get('risk_level', 'N/A')}`",
            f"",
            f"### Regression Tests Required",
        ])
        for test in rem.get("regression_tests", []):
            md.append(f"- [ ] {test}")

        md.extend([
            f"",
            f"## 5. Technical Risk Assessment",
            f"- **Production Risk**: `{risk.get('production_risk', 'N/A')}`",
            f"- **Business Impact**: `{risk.get('business_impact', 'N/A')}`",
            f"- **Customer Impact**: `{risk.get('customer_impact', 'N/A')}`",
            f"- **Release Risk**: `{risk.get('release_impact', 'N/A')}`",
            f"- **Security Risk**: `{risk.get('security_risk', 'N/A')}`",
            f"- **Overall Risk Score**: **{risk.get('overall_risk_score', 'N/A')}/100**",
            f"",
            f"## 6. Confidence Scoring",
            f"- **Overall Confidence**: **{conf.get('confidence_score', 0.0)}/1.0**",
            f"- **Rationale**: {conf.get('rationale', 'N/A')}",
            f""
        ])
        return "\n".join(md)

    @classmethod
    def _generate_pdf(cls, analysis: Analysis, bug: Bug) -> bytes:
        import fitz  # PyMuPDF
        
        doc = fitz.open()
        page = doc.new_page()
        
        y = 50
        margin = 50
        page_width = page.rect.width
        page_height = page.rect.height

        def write_text_block(text: str, font_size: int = 10, is_bold: bool = False, spacing: int = 12) -> None:
            nonlocal y, page
            font = "helv-bold" if is_bold else "helv"
            
            # Simple text wrap
            words = str(text).split(" ")
            current_line = []
            for word in words:
                test_line = " ".join(current_line + [word])
                # Width heuristic (approx 0.55 width per char)
                if len(test_line) * font_size * 0.55 > (page_width - 2 * margin):
                    # Write current line and push
                    if y + spacing > page_height - margin:
                        page = doc.new_page()
                        y = margin
                    page.insert_text(fitz.Point(margin, y), " ".join(current_line), fontsize=font_size, fontname=font)
                    y += spacing
                    current_line = [word]
                else:
                    current_line.append(word)
            if current_line:
                if y + spacing > page_height - margin:
                    page = doc.new_page()
                    y = margin
                page.insert_text(fitz.Point(margin, y), " ".join(current_line), fontsize=font_size, fontname=font)
                y += spacing

        # Write Title Header
        page.insert_text(fitz.Point(margin, y), "AI-Smart-Bug-Analyzer-And-Fix-Advisor ENTERPRISE BUG ANALYSIS REPORT", fontsize=16, fontname="helv-bold")
        y += 24
        page.insert_text(fitz.Point(margin, y), f"Report ID: {analysis.id} | Generated: {datetime.utcnow().isoformat()} UTC", fontsize=9, fontname="helv")
        y += 20
        
        # Bug Details
        write_text_block("1. BUG DETAILS", font_size=12, is_bold=True, spacing=16)
        y += 4
        triage = analysis.triage or {}
        write_text_block(f"Title: {bug.title}", is_bold=True)
        write_text_block(f"Component: {triage.get('component', bug.metadata.component or 'Unknown')}")
        write_text_block(f"Priority: {triage.get('priority', bug.metadata.priority.value or 'Unknown').upper()}")
        write_text_block(f"Severity Score: {triage.get('severity_score', 'N/A')}/10")
        write_text_block(f"Description: {bug.description[:300]}...")
        y += 12
        
        # Executive Summary
        exec_sum = analysis.executive_summary or {}
        write_text_block("2. EXECUTIVE SUMMARY", font_size=12, is_bold=True, spacing=16)
        y += 4
        write_text_block(exec_sum.get("summary", "N/A"))
        write_text_block(f"Recommended Action: {exec_sum.get('recommended_action', 'N/A')}")
        write_text_block(f"Estimated Resolution: {exec_sum.get('estimated_resolution_time', 'N/A')}")
        y += 12
        
        # Root Cause
        rc = analysis.root_cause or {}
        write_text_block("3. ROOT CAUSE ANALYSIS", font_size=12, is_bold=True, spacing=16)
        y += 4
        write_text_block(f"Category: {rc.get('root_cause_category', 'N/A')}")
        write_text_block(f"Hypothesis: {rc.get('hypothesis', 'N/A')}")
        write_text_block(f"Rationale: {rc.get('rationale', 'N/A')}")
        y += 12

        # Remediation
        rem = analysis.remediation or {}
        write_text_block("4. REMEDIATION PLAN", font_size=12, is_bold=True, spacing=16)
        y += 4
        write_text_block(f"Permanent Fix: {rem.get('permanent_fix', 'N/A')}")
        write_text_block(f"Effort Estimate: {rem.get('effort_estimate', 'N/A')}")
        write_text_block(f"Mitigation Steps: {', '.join(rem.get('immediate_mitigation', []))}")
        y += 12

        # Risk and Confidence
        risk = analysis.risk_assessment or {}
        conf = analysis.confidence_scoring or {}
        write_text_block("5. RISK & CONFIDENCE", font_size=12, is_bold=True, spacing=16)
        y += 4
        write_text_block(f"Production Risk: {risk.get('production_risk', 'N/A')} | Overall Risk: {risk.get('overall_risk_score', 'N/A')}/100")
        write_text_block(f"Overall Confidence Score: {conf.get('confidence_score', 0.0)}/1.0")
        write_text_block(f"Confidence Rationale: {conf.get('rationale', 'N/A')}")

        pdf_bytes = doc.write()
        doc.close()
        return pdf_bytes
