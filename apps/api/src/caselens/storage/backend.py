"""Storage abstraction — S3-compatible backends (MinIO for dev, S3/GCS for production)."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

import boto3
import structlog
from botocore.config import Config

from caselens.config import settings

logger = structlog.get_logger()


@dataclass
class StorageResult:
    """Result of a storage operation."""

    key: str
    bucket: str
    size_bytes: int
    etag: str | None = None


class StorageBackend(ABC):
    """Abstract storage backend interface."""

    @abstractmethod
    async def upload(
        self, key: str, data: bytes, content_type: str = "application/octet-stream",
        metadata: dict[str, str] | None = None,
    ) -> StorageResult:
        ...

    @abstractmethod
    async def download(self, key: str) -> bytes:
        ...

    @abstractmethod
    async def get_signed_url(self, key: str, expires_in: int = 3600) -> str:
        ...

    @abstractmethod
    async def delete(self, key: str) -> None:
        ...

    @abstractmethod
    async def exists(self, key: str) -> bool:
        ...


class S3CompatibleBackend(StorageBackend):
    """Storage backend for any S3-compatible API: MinIO (local dev), Cloudflare
    R2, Supabase Storage, or AWS S3 itself — same client, different endpoint."""

    def __init__(self) -> None:
        self.client = boto3.client(
            "s3",
            endpoint_url=f"{'https' if settings.STORAGE_USE_SSL else 'http'}://{settings.STORAGE_ENDPOINT}",
            aws_access_key_id=settings.STORAGE_ACCESS_KEY,
            aws_secret_access_key=settings.STORAGE_SECRET_KEY,
            region_name=settings.STORAGE_REGION,
            # Path-style addressing works across every S3-compatible endpoint we
            # target (MinIO, Cloudflare R2, Supabase Storage); virtual-hosted
            # style breaks on custom-domain endpoints.
            config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
        )
        self.bucket = settings.STORAGE_BUCKET_NAME
        self._ensure_bucket()

    def _ensure_bucket(self) -> None:
        """Create bucket if it doesn't exist."""
        try:
            self.client.head_bucket(Bucket=self.bucket)
        except Exception:
            try:
                self.client.create_bucket(Bucket=self.bucket)
            except Exception as e:
                logger.warning("storage.bucket_create_failed", bucket=self.bucket, error=str(e))

    async def upload(
        self, key: str, data: bytes, content_type: str = "application/octet-stream",
        metadata: dict[str, str] | None = None,
    ) -> StorageResult:
        extra_args: dict[str, Any] = {"ContentType": content_type}
        if metadata:
            extra_args["Metadata"] = metadata

        self.client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=data,
            **extra_args,
        )

        return StorageResult(
            key=key,
            bucket=self.bucket,
            size_bytes=len(data),
        )

    async def download(self, key: str) -> bytes:
        response = self.client.get_object(Bucket=self.bucket, Key=key)
        body: bytes = response["Body"].read()
        return body

    async def get_signed_url(self, key: str, expires_in: int = 3600) -> str:
        url: str = self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=expires_in,
        )
        return url

    async def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=key)

    async def exists(self, key: str) -> bool:
        try:
            self.client.head_object(Bucket=self.bucket, Key=key)
            return True
        except Exception:
            return False


def get_storage_backend() -> StorageBackend:
    """Factory function to get the configured storage backend.

    STORAGE_BACKEND selects the *provider*, but every current option (MinIO,
    Cloudflare R2, Supabase Storage) speaks the same S3 API, so they all use
    S3CompatibleBackend — only STORAGE_ENDPOINT/keys differ between them.
    """
    return S3CompatibleBackend()
