"""AI-Smart-Bug-Analyzer-And-Fix-Advisor FastAPI application entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.api.analytics import analytics_router
from app.api.kb_feedback import kb_router
from app.config.settings import get_settings
from app.utils.exceptions import register_exception_handlers
from app.utils.logger import get_logger, setup_logging


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize services on startup."""
    logger = get_logger("main")
    settings = get_settings()
    logger.info("Starting %s v%s [%s]", settings.app_name, settings.app_version, settings.environment)

    # Initialize SQL database tables
    try:
        from app.config.database import engine, Base
        Base.metadata.create_all(bind=engine)
        logger.info("SQL Database tables initialized successfully.")
    except Exception as exc:
        logger.error("Failed to initialize database tables: %s", exc)

    # Skipped heavy model pre-load at startup to stay under 512MB RAM limit
    logger.info("Skipping heavy model pre-load at startup to stay under 512MB RAM limit.")

    yield
    logger.info("Shutting down AI-Smart-Bug-Analyzer-And-Fix-Advisor")


def create_app() -> FastAPI:
    settings = get_settings()
    setup_logging()

    app = FastAPI(
        title=settings.app_name,
        description="AI Smart Bug Analyzer and Fix Advisor",
        version=settings.app_version,
        lifespan=lifespan,
        debug=settings.debug,
    )

    cors_origins = settings.cors_origin_list
    allow_all = "*" in cors_origins or len(cors_origins) == 0

    if allow_all:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=False,
            allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
            allow_headers=["*"],
            expose_headers=["*"],
            max_age=86400,
        )
    else:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=cors_origins,
            allow_origin_regex=r"https://.*\.vercel\.app|https://.*\.onrender\.com|http://localhost(:\d+)?|http://127\.0\.0\.1(:\d+)?",
            allow_credentials=True,
            allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
            allow_headers=["*"],
            expose_headers=["*"],
            max_age=86400,
        )

    register_exception_handlers(app)
    app.include_router(router, prefix=settings.api_prefix, tags=["AI-Smart-Bug-Analyzer-And-Fix-Advisor"])
    app.include_router(analytics_router, prefix=settings.api_prefix)
    app.include_router(kb_router, prefix=settings.api_prefix)

    # Route root-level /status and /health directly to the router implementations for zero-config clients
    from app.api.routes import health_check, system_status
    app.add_api_route("/health", health_check, methods=["GET"], response_model=None, tags=["Health"])
    app.add_api_route("/status", system_status, methods=["GET"], tags=["Health"])

    @app.options("/{full_path:path}")
    async def global_options_handler(full_path: str):
        from fastapi import Response
        return Response(
            status_code=200,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Max-Age": "86400",
            },
        )

    @app.get("/")
    async def root():
        return {
            "name": settings.app_name,
            "version": settings.app_version,
            "docs": "/docs",
            "health": f"{settings.api_prefix}/health",
            "status": f"{settings.api_prefix}/status",
        }

    return app


app = create_app()