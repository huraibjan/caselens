"""All SQLAlchemy ORM models for the CaseIntelix platform (Phase 1)."""

import enum
import uuid
from datetime import UTC, datetime
from typing import Any

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from caselens.db.base import Base, TenantMixin, TimestampMixin, UUIDMixin

# ── Enums ──────────────────────────────────────────────────────────


class OrgRole(enum.StrEnum):
    OWNER = "owner"
    ADMIN = "admin"
    PARTNER = "partner"
    ASSOCIATE = "associate"
    PARALEGAL = "paralegal"
    VIEWER = "viewer"


class MatterStatus(enum.StrEnum):
    ACTIVE = "active"
    ARCHIVED = "archived"
    CLOSED = "closed"


class DocumentStatus(enum.StrEnum):
    PENDING = "PENDING"
    UPLOADING = "UPLOADING"
    PROCESSING = "PROCESSING"
    READY = "READY"
    ERROR = "ERROR"


class ProcessingStepStatus(enum.StrEnum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"


class MessageRole(enum.StrEnum):
    USER = "USER"
    ASSISTANT = "ASSISTANT"
    SYSTEM = "SYSTEM"


class SourceType(enum.StrEnum):
    DIRECT_EVIDENCE = "DIRECT_EVIDENCE"
    AI_EXTRACTION = "AI_EXTRACTION"
    AI_INFERENCE = "AI_INFERENCE"


class ReviewStatus(enum.StrEnum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    REVISED = "REVISED"


# ── Organization & Auth Models ─────────────────────────────────────


class Organization(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    settings: Mapped[dict[str, Any] | None] = mapped_column(JSONB, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationships
    members: Mapped[list["Membership"]] = relationship(back_populates="organization")
    matters: Mapped[list["Matter"]] = relationship(back_populates="organization")


class User(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Relationships
    memberships: Mapped[list["Membership"]] = relationship(back_populates="user")


class Membership(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "memberships"
    __table_args__ = (
        UniqueConstraint("user_id", "organization_id", name="uq_membership_user_org"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[OrgRole] = mapped_column(
        Enum(OrgRole, name="org_role"), nullable=False, default=OrgRole.ASSOCIATE
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationships
    user: Mapped["User"] = relationship(back_populates="memberships")
    organization: Mapped["Organization"] = relationship(back_populates="members")


# ── Matter Models ──────────────────────────────────────────────────


class Matter(Base, UUIDMixin, TimestampMixin, TenantMixin):
    __tablename__ = "matters"
    __table_args__ = (
        Index("ix_matters_org_status", "organization_id", "status"),
    )

    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    matter_number: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[MatterStatus] = mapped_column(
        Enum(MatterStatus, name="matter_status"),
        nullable=False,
        default=MatterStatus.ACTIVE,
    )
    metadata_: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB, default=dict)

    @property
    def case_metadata(self) -> dict[str, Any] | None:
        return self.metadata_

    @case_metadata.setter
    def case_metadata(self, value: dict[str, Any] | None) -> None:
        self.metadata_ = value

    # Relationships
    organization: Mapped["Organization"] = relationship(back_populates="matters")
    members: Mapped[list["MatterMember"]] = relationship(back_populates="matter")
    documents: Mapped[list["Document"]] = relationship(back_populates="matter")
    conversations: Mapped[list["AIConversation"]] = relationship(back_populates="matter")


class MatterMember(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "matter_members"
    __table_args__ = (
        UniqueConstraint("matter_id", "user_id", name="uq_matter_member"),
    )

    matter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("matters.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(50), default="member")

    # Relationships
    matter: Mapped["Matter"] = relationship(back_populates="members")
    user: Mapped["User"] = relationship()


# ── Document Models ────────────────────────────────────────────────


class Document(Base, UUIDMixin, TimestampMixin, TenantMixin):
    __tablename__ = "documents"
    __table_args__ = (
        Index("ix_documents_matter_status", "matter_id", "status"),
        Index("ix_documents_org_id", "organization_id"),
    )

    matter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("matters.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(500), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    storage_key: Mapped[str] = mapped_column(String(1000), nullable=False)
    checksum_sha256: Mapped[str | None] = mapped_column(String(64))
    page_count: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[DocumentStatus] = mapped_column(
        Enum(DocumentStatus, name="document_status"),
        nullable=False,
        default=DocumentStatus.PENDING,
    )
    summary: Mapped[str | None] = mapped_column(Text)
    metadata_: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB, default=dict)

    @property
    def case_metadata(self) -> dict[str, Any] | None:
        return self.metadata_

    @case_metadata.setter
    def case_metadata(self, value: dict[str, Any] | None) -> None:
        self.metadata_ = value

    # Relationships
    matter: Mapped["Matter"] = relationship(back_populates="documents")
    versions: Mapped[list["DocumentVersion"]] = relationship(back_populates="document")
    pages: Mapped[list["DocumentPage"]] = relationship(back_populates="document")
    chunks: Mapped[list["DocumentChunk"]] = relationship(back_populates="document")


class DocumentVersion(Base, UUIDMixin, TimestampMixin, TenantMixin):
    __tablename__ = "document_versions"

    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    storage_key: Mapped[str] = mapped_column(String(1000), nullable=False)
    checksum_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    uploaded_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )

    # Relationships
    document: Mapped["Document"] = relationship(back_populates="versions")


class DocumentPage(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "document_pages"
    __table_args__ = (
        UniqueConstraint("document_id", "page_number", name="uq_doc_page"),
    )

    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    page_number: Mapped[int] = mapped_column(Integer, nullable=False)
    text_content: Mapped[str | None] = mapped_column(Text)
    char_count: Mapped[int] = mapped_column(Integer, default=0)
    extraction_method: Mapped[str] = mapped_column(String(50), default="pymupdf")
    extraction_quality: Mapped[float | None] = mapped_column(Float)

    # Relationships
    document: Mapped["Document"] = relationship(back_populates="pages")


class DocumentChunk(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "document_chunks"
    __table_args__ = (
        Index("ix_chunks_document_id", "document_id"),
    )

    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    page_number: Mapped[int] = mapped_column(Integer, nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    text_content: Mapped[str] = mapped_column(Text, nullable=False)
    token_count: Mapped[int] = mapped_column(Integer, nullable=False)
    start_char: Mapped[int] = mapped_column(Integer, nullable=False)
    end_char: Mapped[int] = mapped_column(Integer, nullable=False)
    metadata_: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB, default=dict)

    # Full-text search vector (populated by trigger)
    # search_vector is created via raw SQL in migration

    # Relationships
    document: Mapped["Document"] = relationship(back_populates="chunks")
    embedding: Mapped["Embedding | None"] = relationship(back_populates="chunk", uselist=False)


class Embedding(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "embeddings"
    __table_args__ = (
        UniqueConstraint("chunk_id", "model_name", name="uq_embedding_chunk_model"),
    )

    chunk_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("document_chunks.id", ondelete="CASCADE"), nullable=False
    )
    vector: Mapped[list[float]] = mapped_column(Vector(384), nullable=False)
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    model_version: Mapped[str | None] = mapped_column(String(50))
    dimensions: Mapped[int] = mapped_column(Integer, nullable=False, default=384)

    # Relationships
    chunk: Mapped["DocumentChunk"] = relationship(back_populates="embedding")


# ── Processing Models ──────────────────────────────────────────────


class ProcessingWorkflow(Base, UUIDMixin, TimestampMixin, TenantMixin):
    __tablename__ = "processing_workflows"

    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    workflow_type: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[ProcessingStepStatus] = mapped_column(
        Enum(ProcessingStepStatus, name="processing_step_status"),
        nullable=False,
        default=ProcessingStepStatus.PENDING,
    )
    temporal_workflow_id: Mapped[str | None] = mapped_column(String(255))
    temporal_run_id: Mapped[str | None] = mapped_column(String(255))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error_message: Mapped[str | None] = mapped_column(Text)

    # Relationships
    steps: Mapped[list["ProcessingStep"]] = relationship(back_populates="workflow")


class ProcessingStep(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "processing_steps"

    workflow_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("processing_workflows.id", ondelete="CASCADE"),
        nullable=False,
    )
    step_name: Mapped[str] = mapped_column(String(100), nullable=False)
    step_order: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[ProcessingStepStatus] = mapped_column(
        Enum(ProcessingStepStatus, name="processing_step_status", create_type=False),
        nullable=False,
        default=ProcessingStepStatus.PENDING,
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    error_message: Mapped[str | None] = mapped_column(Text)
    output_metadata: Mapped[dict[str, Any] | None] = mapped_column(JSONB, default=dict)

    # Relationships
    workflow: Mapped["ProcessingWorkflow"] = relationship(back_populates="steps")


# ── AI & RAG Models ────────────────────────────────────────────────


class AIConversation(Base, UUIDMixin, TimestampMixin, TenantMixin):
    __tablename__ = "ai_conversations"

    matter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("matters.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    title: Mapped[str | None] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Relationships
    matter: Mapped["Matter"] = relationship(back_populates="conversations")
    messages: Mapped[list["AIMessage"]] = relationship(back_populates="conversation")


class AIMessage(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "ai_messages"

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("ai_conversations.id", ondelete="CASCADE"),
        nullable=False,
    )
    role: Mapped[MessageRole] = mapped_column(
        Enum(MessageRole, name="message_role"), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    review_status: Mapped[ReviewStatus] = mapped_column(
        Enum(ReviewStatus, name="review_status"),
        nullable=False,
        default=ReviewStatus.PENDING,
    )
    requires_human_review: Mapped[bool] = mapped_column(Boolean, default=True)
    model_run_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("model_runs.id")
    )
    retrieval_run_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("retrieval_runs.id")
    )

    # Relationships
    conversation: Mapped["AIConversation"] = relationship(back_populates="messages")
    citations: Mapped[list["Citation"]] = relationship(back_populates="message")


class ModelRun(Base, UUIDMixin, TimestampMixin, TenantMixin):
    __tablename__ = "model_runs"

    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    model_version: Mapped[str | None] = mapped_column(String(50))
    prompt_template_version: Mapped[str | None] = mapped_column(String(50))
    input_checksum: Mapped[str | None] = mapped_column(String(64))
    output_checksum: Mapped[str | None] = mapped_column(String(64))
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    estimated_cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    matter_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    retrieval_run_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    citation_validation_passed: Mapped[bool | None] = mapped_column(Boolean)
    review_status: Mapped[ReviewStatus] = mapped_column(
        Enum(ReviewStatus, name="review_status", create_type=False),
        nullable=False,
        default=ReviewStatus.PENDING,
    )
    metadata_: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB, default=dict)


class RetrievalRun(Base, UUIDMixin, TimestampMixin, TenantMixin):
    __tablename__ = "retrieval_runs"

    matter_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    query: Mapped[str] = mapped_column(Text, nullable=False)
    query_embedding_model: Mapped[str | None] = mapped_column(String(100))
    full_text_results_count: Mapped[int] = mapped_column(Integer, default=0)
    vector_results_count: Mapped[int] = mapped_column(Integer, default=0)
    merged_results_count: Mapped[int] = mapped_column(Integer, default=0)
    reranked_results_count: Mapped[int] = mapped_column(Integer, default=0)
    top_k: Mapped[int] = mapped_column(Integer, default=5)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    metadata_: Mapped[dict[str, Any] | None] = mapped_column("metadata", JSONB, default=dict)


class Citation(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "citations"

    message_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ai_messages.id", ondelete="CASCADE"), nullable=False
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False
    )
    chunk_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("document_chunks.id"), nullable=False
    )
    page_number: Mapped[int] = mapped_column(Integer, nullable=False)
    excerpt: Mapped[str] = mapped_column(Text, nullable=False)
    relevance_score: Mapped[float] = mapped_column(Float, nullable=False)
    source_type: Mapped[SourceType] = mapped_column(
        Enum(SourceType, name="source_type"), nullable=False
    )
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    verification_note: Mapped[str | None] = mapped_column(Text)

    # Relationships
    message: Mapped["AIMessage"] = relationship(back_populates="citations")


# ── Audit & Feature Flags ─────────────────────────────────────────


class AuditEvent(Base, UUIDMixin):
    """Immutable audit log — no update or delete allowed."""

    __tablename__ = "audit_events"
    __table_args__ = (
        Index("ix_audit_events_org_created", "organization_id", "created_at"),
        Index("ix_audit_events_user_created", "user_id", "created_at"),
    )

    organization_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    details: Mapped[dict[str, Any] | None] = mapped_column(JSONB, default=dict)
    ip_address: Mapped[str | None] = mapped_column(String(45))
    user_agent: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
        nullable=False,
    )


class FeatureFlag(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "feature_flags"

    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    conditions: Mapped[dict[str, Any] | None] = mapped_column(JSONB, default=dict)
