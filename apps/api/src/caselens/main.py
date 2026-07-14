"""CaseIntelix API — Legal Case Intelligence Platform."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from typing import Any

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from caselens.audit.router import router as audit_router
from caselens.auth.router import router as auth_router
from caselens.config import settings
from caselens.documents.router import router as documents_router
from caselens.documents.upload import router as upload_router
from caselens.matters.router import router as matters_router
from caselens.organizations.router import router as org_router
from caselens.practice.router import (
    calendar_router,
    contacts_router,
    filings_router,
)
from caselens.rag.router import router as rag_router
from caselens.search.router import router as search_router

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan — setup and teardown."""
    logger.info("caselens.startup", version="0.1.0", env=settings.APP_ENV)
    yield
    logger.info("caselens.shutdown")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="CaseIntelix API",
        description="Legal Case Intelligence Platform — Phase 1",
        version="0.1.0",
        docs_url="/api/docs" if settings.APP_DEBUG else None,
        redoc_url="/api/redoc" if settings.APP_DEBUG else None,
        lifespan=lifespan,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routers
    app.include_router(auth_router, prefix="/api/v1/auth", tags=["Authentication"])
    app.include_router(org_router, prefix="/api/v1/organizations", tags=["Organizations"])
    app.include_router(matters_router, prefix="/api/v1/matters", tags=["Matters"])
    app.include_router(upload_router, prefix="/api/v1/matters", tags=["Documents"])
    app.include_router(documents_router, prefix="/api/v1/documents", tags=["Documents"])
    app.include_router(search_router, prefix="/api/v1", tags=["Search"])
    app.include_router(rag_router, prefix="/api/v1", tags=["RAG"])
    app.include_router(audit_router, prefix="/api/v1/audit-events", tags=["Audit"])
    app.include_router(contacts_router, prefix="/api/v1/contacts", tags=["Contacts"])
    app.include_router(calendar_router, prefix="/api/v1/calendar-events", tags=["Calendar"])
    app.include_router(filings_router, prefix="/api/v1/filings", tags=["Filings"])

    @app.get("/api/v1/health", tags=["Health"])
    async def health_check() -> dict[str, Any]:
        return {
            "status": "healthy",
            "version": "0.1.0",
            "environment": settings.APP_ENV,
        }

    return app


app = create_app()
