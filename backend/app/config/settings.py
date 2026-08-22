"""Application configuration via environment variables."""

from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BASE_DIR.parent


class Settings(BaseSettings):
    """Centralized settings loaded from .env."""

    model_config = SettingsConfigDict(
        env_file=(str(PROJECT_ROOT / ".env"), str(BASE_DIR / ".env")),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = Field(default="AI-Smart-Bug-Analyzer-And-Fix-Advisor", alias="APP_NAME")
    app_version: str = Field(default="1.0.0", alias="APP_VERSION")
    environment: str = Field(default="development", alias="ENVIRONMENT")
    debug: bool = Field(default=False, alias="DEBUG")

    host: str = Field(default="0.0.0.0", alias="HOST")
    port: int = Field(default=8000, alias="PORT")
    api_prefix: str = Field(default="/api/v1", alias="API_PREFIX")

    cors_origins: str = Field(
        default="*",
        alias="CORS_ORIGINS",
    )

    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    log_dir: str = Field(default="logs", alias="LOG_DIR")

    max_upload_size_mb: int = Field(default=10, alias="MAX_UPLOAD_SIZE_MB")
    allowed_extensions: str = Field(
        default=".txt,.log,.json,.xml,.pdf,.docx,.csv,.md",
        alias="ALLOWED_EXTENSIONS",
    )
    upload_dir: str = Field(default="uploads", alias="UPLOAD_DIR")
    database_url: str = Field(default="sqlite:///ai_smart_bug_analyzer_and_fix_advisor.db", alias="DATABASE_URL")

    embedding_model: str = Field(
        default="sentence-transformers/all-MiniLM-L6-v2",
        alias="EMBEDDING_MODEL",
    )
    chunk_size: int = Field(default=512, alias="CHUNK_SIZE")
    chunk_overlap: int = Field(default=64, alias="CHUNK_OVERLAP")
    chroma_persist_dir: str = Field(default="chroma_db", alias="CHROMA_PERSIST_DIR")
    chroma_collection: str = Field(default="ai_smart_bug_analyzer_and_fix_advisor_bugs", alias="CHROMA_COLLECTION")
    retrieval_top_k: int = Field(default=5, alias="RETRIEVAL_TOP_K")
    mmr_lambda: float = Field(default=0.7, alias="MMR_LAMBDA")

    llm_provider: str = Field(default="openai", alias="LLM_PROVIDER")
    llm_model: str = Field(default="gpt-4o-mini", alias="LLM_MODEL")
    llm_api_key: str = Field(default="", alias="LLM_API_KEY")
    llm_timeout_seconds: int = Field(default=120, alias="LLM_TIMEOUT_SECONDS")

    workflow_max_retries: int = Field(default=2, alias="WORKFLOW_MAX_RETRIES")

    @property
    def cors_origin_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def allowed_extension_list(self) -> List[str]:
        return [e.strip().lower() for e in self.allowed_extensions.split(",") if e.strip()]

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_size_mb * 1024 * 1024

    @property
    def upload_path(self) -> Path:
        path = PROJECT_ROOT / self.upload_dir
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def chroma_path(self) -> Path:
        path = PROJECT_ROOT / self.chroma_persist_dir
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def log_path(self) -> Path:
        path = PROJECT_ROOT / self.log_dir
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def prompts_path(self) -> Path:
        return BASE_DIR / "prompts"


@lru_cache
def get_settings() -> Settings:
    return Settings()
