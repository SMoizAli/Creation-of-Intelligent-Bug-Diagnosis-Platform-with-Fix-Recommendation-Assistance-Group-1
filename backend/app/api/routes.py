"""FastAPI route definitions."""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.api.dependencies import (
    get_analysis_service,
    get_bug_service,
    get_history_service,
)
from app.config.settings import get_settings
from app.models import AppSettings
from app.rag.embeddings import EmbeddingService
from app.rag.vector_store import VectorStore
from app.schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    AnalysisResponse,
    AgentOutputSchema,
    BugResponse,
    BugSubmitRequest,
    BugSubmitResponse,
    HealthResponse,
    HistoryResponse,
    ServiceStatus,
    SettingsResponse,
    StatusResponse,
)
from app.services.analysis_service import AnalysisService
from app.services.bug_service import BugService
from app.services.history_service import HistoryService
from app.services.store import store
from app.utils.logger import get_logger

logger = get_logger("api.routes")
router = APIRouter()


def _bug_to_response(bug) -> BugResponse:
    return BugResponse(
        id=bug.id,
        title=bug.title,
        description=bug.description,
        file_name=bug.file_name,
        status=bug.status,
        metadata=bug.metadata.model_dump(),
        created_at=bug.created_at,
    )


def _analysis_to_response(analysis) -> AnalysisResponse:
    return AnalysisResponse(
        id=analysis.id,
        bug_id=analysis.bug_id,
        status=analysis.status,
        current_stage=analysis.current_stage,
        triage=analysis.triage,
        log_analysis=analysis.log_analysis,
        duplicate_detection=analysis.duplicate_detection,
        root_cause=analysis.root_cause,
        remediation=analysis.remediation,
        risk_assessment=analysis.risk_assessment,
        confidence_scoring=analysis.confidence_scoring,
        executive_summary=analysis.executive_summary,
        retrieved_context=analysis.retrieved_context,
        agent_results=[
            AgentOutputSchema(
                agent_name=r.agent_name,
                stage=r.stage,
                output=r.output,
                confidence=r.confidence,
                duration_ms=r.duration_ms,
            )
            for r in analysis.agent_results
        ],
        summary=analysis.summary,
        created_at=analysis.created_at,
        completed_at=analysis.completed_at,
    )


@router.post("/submit-bug", response_model=BugSubmitResponse)
async def submit_bug(
    bug_service: BugService = Depends(get_bug_service),
    analysis_service: AnalysisService = Depends(get_analysis_service),
    file: Optional[UploadFile] = File(None),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    content: Optional[str] = Form(None),
    component: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
):
    """Submit a bug report via file upload or pasted text."""
    tag_list = [t.strip() for t in tags.split(",")] if tags else []

    if file and file.filename:
        file_bytes = await file.read()
        bug = await bug_service.submit_from_file(
            filename=file.filename,
            content=file_bytes,
            title=title,
            component=component,
            tags=tag_list,
        )
    elif content:
        bug = bug_service.create_bug_from_text(
            content=content,
            title=title,
            description=description,
            component=component,
            tags=tag_list,
        )
    else:
        from app.utils.exceptions import ValidationError

        raise ValidationError("Provide either a file upload or pasted bug content.")

    analysis = analysis_service.create_analysis(bug)
    logger.info("Bug submitted: %s, analysis: %s", bug.id, analysis.id)

    return BugSubmitResponse(
        message="Bug submitted successfully.",
        bug=_bug_to_response(bug),
        analysis_id=analysis.id,
    )


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_bug(
    request: AnalyzeRequest,
    analysis_service: AnalysisService = Depends(get_analysis_service),
):
    """Run the full multi-agent analysis pipeline on a submitted bug."""
    analysis = analysis_service.run_analysis(
        bug_id=request.bug_id,
        use_mmr=request.use_mmr,
        retrieval_top_k=request.retrieval_top_k,
    )
    return AnalyzeResponse(
        message="Analysis completed successfully.",
        analysis=_analysis_to_response(analysis),
    )


@router.get("/history", response_model=HistoryResponse)
async def get_history(
    limit: int = 50,
    offset: int = 0,
    history_service: HistoryService = Depends(get_history_service),
):
    """Retrieve analysis history."""
    return history_service.list_history(limit=limit, offset=offset)


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Liveness probe."""
    settings = get_settings()
    return HealthResponse(
        status="healthy",
        version=settings.app_version,
        environment=settings.environment,
        timestamp=datetime.utcnow(),
    )


@router.get("/status", response_model=StatusResponse)
async def system_status():
    """Detailed system and dependency status."""
    settings = get_settings()
    services: list[ServiceStatus] = []

    embedding_svc = EmbeddingService()
    services.append(
        ServiceStatus(
            name="embedding_model",
            status="ready" if embedding_svc.is_available() else "unavailable",
            message=settings.embedding_model,
        )
    )

    try:
        vs = VectorStore()
        chroma_ok = vs.is_available()
        doc_count = vs.document_count
        services.append(
            ServiceStatus(
                name="chromadb",
                status="ready" if chroma_ok else "unavailable",
                message=f"{doc_count} documents indexed",
            )
        )
    except Exception as exc:
        doc_count = 0
        services.append(
            ServiceStatus(
                name="chromadb",
                status="unavailable",
                message=str(exc),
            )
        )

    overall = "ready" if all(s.status == "ready" for s in services) else "degraded"
    
    # Read ChromaDB status metadata if available
    import json
    from pathlib import Path
    status_file = settings.chroma_path / "status.json"
    kb_data = {}
    if status_file.exists():
        try:
            with status_file.open(encoding="utf-8") as f:
                kb_data = json.load(f)
        except Exception:
            pass

    return StatusResponse(
        overall=overall,
        services=services,
        active_analyses=store.active_analysis_count,
        total_bugs=store.bug_count,
        chroma_documents=doc_count,
        last_indexing_time=kb_data.get("last_indexing_time"),
        storage_used=kb_data.get("storage_used", "51.2 KB"),
        model_version=kb_data.get("model_version", "v2.0"),
        embedding_model=kb_data.get("embedding_model", settings.embedding_model),
        category_distribution=kb_data.get("category_distribution", {})
    )


@router.get("/analysis/{analysis_id}/download")
async def download_analysis_report(
    analysis_id: str,
    format: str = "pdf",
    analysis_service: AnalysisService = Depends(get_analysis_service),
    bug_service: BugService = Depends(get_bug_service),
):
    """Generate and download visual TXT, Markdown, or PDF report for target analysis."""
    analysis = analysis_service.get_analysis(analysis_id)
    bug = bug_service.get_bug(analysis.bug_id)
    
    from app.services.report_service import ReportService
    content_bytes, media_type, filename = ReportService.generate_report(analysis, bug, format)
    
    from fastapi import Response
    return Response(
        content=content_bytes,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/analysis/{analysis_id}", response_model=AnalysisResponse)
async def get_analysis(
    analysis_id: str,
    analysis_service: AnalysisService = Depends(get_analysis_service)
):
    """Retrieve detailed analysis results for a specific analysis ID."""
    analysis = analysis_service.get_analysis(analysis_id)
    return _analysis_to_response(analysis)


@router.get("/bug/{bug_id}", response_model=BugResponse)
async def get_bug(
    bug_id: str,
    bug_service: BugService = Depends(get_bug_service)
):
    """Retrieve bug report details for a specific bug ID."""
    bug = bug_service.get_bug(bug_id)
    return _bug_to_response(bug)


@router.get("/settings", response_model=SettingsResponse)
async def get_app_settings():
    """Return current application settings."""
    settings = get_settings()
    app_settings = AppSettings(
        embedding_model=settings.embedding_model,
        chunk_size=settings.chunk_size,
        chunk_overlap=settings.chunk_overlap,
        retrieval_top_k=settings.retrieval_top_k,
        mmr_lambda=settings.mmr_lambda,
        max_upload_size_mb=settings.max_upload_size_mb,
        allowed_extensions=settings.allowed_extension_list,
        llm_model=settings.llm_model,
        enable_mmr=True,
    )
    return SettingsResponse(**app_settings.model_dump())
