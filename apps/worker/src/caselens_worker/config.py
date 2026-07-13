"""Worker configuration."""

from pydantic_settings import BaseSettings


class WorkerSettings(BaseSettings):
    TEMPORAL_HOST: str = "localhost:7233"
    TEMPORAL_NAMESPACE: str = "caselens"
    TEMPORAL_TASK_QUEUE: str = "document-processing"
    DATABASE_URL: str = (
        "postgresql+asyncpg://caselens:caselens_dev_password@localhost:5432/caselens"
    )
    STORAGE_ENDPOINT: str = "localhost:9000"
    STORAGE_ACCESS_KEY: str = "minioadmin"
    STORAGE_SECRET_KEY: str = "minioadmin"
    STORAGE_BUCKET_NAME: str = "caselens-documents"
    CHUNK_SIZE_TOKENS: int = 512
    CHUNK_OVERLAP_TOKENS: int = 64
    # NOTE: AI provider selection is NOT read from here. Worker activities call
    # caselens.ai_gateway.providers.get_llm_provider()/get_analysis_llm_provider(),
    # which resolve caselens.config.settings (the API package's Settings) from
    # THIS process's .env — see apps/worker/.env for the actual AI_* keys used.

    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
        "extra": "ignore",
    }


worker_settings = WorkerSettings()
