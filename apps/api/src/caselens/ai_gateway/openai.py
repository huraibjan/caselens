"""OpenAI provider using direct REST API calls."""

import time
from typing import Any

import httpx

from caselens.ai_gateway.providers import (
    EmbeddingProvider,
    EmbeddingResponse,
    LLMProvider,
    LLMResponse,
    ProviderAPIError,
    ProviderNotConfiguredError,
)
from caselens.config import settings

PROVIDER_NAME = "openai"


class OpenAILLMProvider(LLMProvider):
    """OpenAI LLM provider using direct REST API calls."""

    def __init__(
        self,
        api_key: str | None = None,
        model: str = "gpt-4o-mini",
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.api_key = api_key or settings.OPENAI_API_KEY
        self.model = model
        self.provider_name = PROVIDER_NAME
        self._client = client

    def is_configured(self) -> bool:
        return bool(self.api_key)

    async def generate(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.1,
        max_tokens: int = 2000,
        **kwargs: Any,
    ) -> LLMResponse:
        if not self.is_configured():
            raise ProviderNotConfiguredError(PROVIDER_NAME)

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        start = time.monotonic()
        data = await self._post(payload)
        duration_ms = int((time.monotonic() - start) * 1000)

        content = data["choices"][0]["message"]["content"]
        usage = data.get("usage", {})

        return LLMResponse(
            content=content,
            model=self.model,
            provider=PROVIDER_NAME,
            input_tokens=usage.get("prompt_tokens", 0),
            output_tokens=usage.get("completion_tokens", 0),
            total_tokens=usage.get("total_tokens", 0),
            duration_ms=duration_ms,
        )

    async def generate_structured(
        self,
        prompt: str,
        schema: dict[str, Any],
        system_prompt: str | None = None,
        **kwargs: Any,
    ) -> LLMResponse:
        if not self.is_configured():
            raise ProviderNotConfiguredError(PROVIDER_NAME)

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "response_format": {"type": "json_object"},
        }

        start = time.monotonic()
        data = await self._post(payload)
        duration_ms = int((time.monotonic() - start) * 1000)

        content = data["choices"][0]["message"]["content"]
        return LLMResponse(
            content=content, model=self.model, provider=PROVIDER_NAME, duration_ms=duration_ms
        )

    async def _post(self, payload: dict[str, Any]) -> dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        client = self._client or httpx.AsyncClient()
        try:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=settings.AI_PROVIDER_TIMEOUT_SECONDS,
            )
        finally:
            if self._client is None:
                await client.aclose()

        if resp.status_code >= 400:
            raise ProviderAPIError(PROVIDER_NAME, resp.status_code, resp.text[:500])
        data: dict[str, Any] = resp.json()
        return data


class OpenAIEmbeddingProvider(EmbeddingProvider):
    """OpenAI Embedding provider supporting text-embedding-3 models at 384 dimensions."""

    def __init__(
        self,
        api_key: str | None = None,
        model: str = "text-embedding-3-small",
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.api_key = api_key or settings.OPENAI_API_KEY
        self.model = model
        self._client = client

    def is_configured(self) -> bool:
        return bool(self.api_key)

    @property
    def dimensions(self) -> int:
        return 384

    @property
    def model_name(self) -> str:
        return self.model

    async def embed(self, texts: list[str]) -> EmbeddingResponse:
        if not self.is_configured():
            raise ProviderNotConfiguredError(PROVIDER_NAME)

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "input": texts,
            "dimensions": 384,
        }

        client = self._client or httpx.AsyncClient()
        try:
            resp = await client.post(
                "https://api.openai.com/v1/embeddings",
                headers=headers,
                json=payload,
                timeout=settings.AI_PROVIDER_TIMEOUT_SECONDS,
            )
        finally:
            if self._client is None:
                await client.aclose()

        if resp.status_code >= 400:
            raise ProviderAPIError(PROVIDER_NAME, resp.status_code, resp.text[:500])

        data = resp.json()
        vectors = [item["embedding"] for item in data["data"]]
        usage = data.get("usage", {})

        return EmbeddingResponse(
            vectors=vectors,
            model=self.model,
            provider=PROVIDER_NAME,
            dimensions=384,
            total_tokens=usage.get("total_tokens", 0),
        )
