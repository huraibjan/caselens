"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """CaseLens application settings."""

    # Application
    APP_NAME: str = "CaseLens"
    APP_ENV: str = "development"
    APP_DEBUG: bool = True
    APP_LOG_LEVEL: str = "INFO"
    APP_SECRET_KEY: str = "change-this-to-a-random-64-char-string"

    # Database
    DATABASE_URL: str = (
        "postgresql+asyncpg://caselens:caselens_dev_password@localhost:5432/caselens"
    )
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    JWT_SECRET_KEY: str = "change-this-to-a-different-random-64-char-string"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Google Sign-In (OAuth). Optional — email/password auth works without it.
    # Get a Web OAuth client ID at https://console.cloud.google.com/apis/credentials
    GOOGLE_CLIENT_ID: str | None = None

    # Storage
    # Informational only — every provider (MinIO/R2/Supabase Storage) uses the
    # same S3-compatible client; only STORAGE_ENDPOINT/keys below matter.
    STORAGE_BACKEND: str = "minio"
    STORAGE_ENDPOINT: str = "localhost:9000"
    STORAGE_ACCESS_KEY: str = "minioadmin"
    STORAGE_SECRET_KEY: str = "minioadmin"
    STORAGE_BUCKET_NAME: str = "caselens-documents"
    STORAGE_USE_SSL: bool = False
    STORAGE_REGION: str = "us-east-1"

    # Document processing mode:
    #   "inline"   → run the pipeline as an in-process FastAPI background task
    #                (no Temporal/worker needed — hostable as a single free service)
    #   "temporal" → dispatch to the Temporal worker (requires TEMPORAL_HOST + worker)
    DOCUMENT_PROCESSING_MODE: str = "inline"

    # Temporal (only used when DOCUMENT_PROCESSING_MODE=temporal)
    TEMPORAL_HOST: str = "localhost:7233"
    TEMPORAL_NAMESPACE: str = "caselens"
    TEMPORAL_TASK_QUEUE: str = "document-processing"

    # AI Gateway
    # DEPRECATED: superseded by AI_*_PROVIDER_CHAIN below — no longer read by
    # get_llm_provider()/get_embedding_provider(). Kept only so old .env files
    # don't fail to parse; AI_RERANKING_PROVIDER was already unused before this.
    AI_PROVIDER: str = "mock"
    AI_EMBEDDING_PROVIDER: str = "mock"
    AI_RERANKING_PROVIDER: str = "mock"
    AI_EMBEDDING_DIMENSIONS: int = 384

    # Ordered, comma-separated fallback chains — reorder/add/remove providers
    # by editing these env vars, no code change required. Each provider is
    # automatically skipped if its API key isn't set. Chat cascades into the
    # analysis chain if Gemini is unavailable, so chat never goes fully down.
    # Fast free providers first (Cerebras/Groq answer in ~200ms), Gemini and the
    # rest as fallbacks. OpenAI is intentionally NOT in these defaults — it's paid;
    # add it explicitly only if you want a paid last-resort backstop.
    AI_CHAT_PROVIDER_CHAIN: str = "cerebras,groq,gemini,nvidia,openrouter"
    AI_ANALYSIS_PROVIDER_CHAIN: str = "cerebras,groq,nvidia,openrouter"
    AI_EMBEDDING_PROVIDER_CHAIN: str = "gemini"

    # When True, a chain that exhausts all real providers falls back to the
    # deterministic Mock provider (canned placeholder text — NOT real analysis).
    # Default False so the published product raises an honest "AI unavailable"
    # error instead of ever serving fake analysis to a user. Enable only for
    # offline/dev/CI where running with zero API keys is intended.
    AI_ALLOW_MOCK_FALLBACK: bool = False

    # Fallback-chain tuning
    AI_PROVIDER_TIMEOUT_SECONDS: float = 30.0
    AI_PROVIDER_MAX_RETRIES: int = 2
    AI_PROVIDER_COOLDOWN_SECONDS: int = 60
    AI_PROVIDER_RATE_LIMIT_COOLDOWN_SECONDS: int = 45
    AI_PROVIDER_AUTH_ERROR_COOLDOWN_SECONDS: int = 300

    # Provider credentials — all optional; a provider with no key is skipped
    OPENAI_API_KEY: str | None = None
    GEMINI_API_KEY: str | None = None
    NVIDIA_API_KEY: str | None = None
    GROQ_API_KEY: str | None = None
    CEREBRAS_API_KEY: str | None = None
    OPENROUTER_API_KEY: str | None = None

    # Free-tier-appropriate default models (override per-provider via env)
    GEMINI_MODEL: str = "gemini-2.0-flash"
    GEMINI_EMBEDDING_MODEL: str = "gemini-embedding-001"
    NVIDIA_MODEL: str = "meta/llama-3.1-8b-instruct"
    GROQ_MODEL: str = "llama-3.1-8b-instant"
    CEREBRAS_MODEL: str = "llama3.1-8b"
    OPENROUTER_MODEL: str = "meta-llama/llama-3.1-8b-instruct:free"

    # Document Processing
    MAX_UPLOAD_SIZE_MB: int = 100
    ALLOWED_MIME_TYPES: str = "application/pdf"
    CHUNK_SIZE_TOKENS: int = 512
    CHUNK_OVERLAP_TOKENS: int = 64

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000"
    CORS_ALLOW_CREDENTIALS: bool = True

    # Rate Limiting
    RATE_LIMIT_LOGIN_PER_MINUTE: int = 10
    RATE_LIMIT_API_PER_MINUTE: int = 100

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    @property
    def allowed_mime_types_list(self) -> list[str]:
        return [mt.strip() for mt in self.ALLOWED_MIME_TYPES.split(",")]

    @property
    def max_upload_size_bytes(self) -> int:
        return self.MAX_UPLOAD_SIZE_MB * 1024 * 1024

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
        "extra": "ignore",
    }


settings = Settings()
