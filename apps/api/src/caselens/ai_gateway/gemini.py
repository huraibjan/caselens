"""Google Gemini provider using direct REST API calls (free-tier friendly)."""

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

PROVIDER_NAME = "gemini"


class GeminiLLMProvider(LLMProvider):
    """Google Gemini LLM provider using direct REST API calls."""

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.model = model or settings.GEMINI_MODEL
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

        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.model}:generateContent?key={self.api_key}"
        )

        payload: dict[str, Any] = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
            },
        }
        if system_prompt:
            payload["systemInstruction"] = {"parts": [{"text": system_prompt}]}

        start = time.monotonic()
        data = await self._post(url, payload)
        duration_ms = int((time.monotonic() - start) * 1000)

        content = data["candidates"][0]["content"]["parts"][0]["text"]
        usage = data.get("usageMetadata", {})
        input_tokens = usage.get("promptTokenCount", 0)
        output_tokens = usage.get("candidatesTokenCount", 0)

        return LLMResponse(
            content=content,
            model=self.model,
            provider=PROVIDER_NAME,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=input_tokens + output_tokens,
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

        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.model}:generateContent?key={self.api_key}"
        )
        payload: dict[str, Any] = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseSchema": schema,
            },
        }
        if system_prompt:
            payload["systemInstruction"] = {"parts": [{"text": system_prompt}]}

        start = time.monotonic()
        data = await self._post(url, payload)
        duration_ms = int((time.monotonic() - start) * 1000)

        content = data["candidates"][0]["content"]["parts"][0]["text"]
        return LLMResponse(
            content=content, model=self.model, provider=PROVIDER_NAME, duration_ms=duration_ms
        )

    async def _post(self, url: str, payload: dict[str, Any]) -> dict[str, Any]:
        client = self._client or httpx.AsyncClient()
        try:
            resp = await client.post(url, json=payload, timeout=settings.AI_PROVIDER_TIMEOUT_SECONDS)
        finally:
            if self._client is None:
                await client.aclose()

        if resp.status_code >= 400:
            raise ProviderAPIError(PROVIDER_NAME, resp.status_code, resp.text[:500])
        data: dict[str, Any] = resp.json()
        return data


class GeminiEmbeddingProvider(EmbeddingProvider):
    """Google Gemini Embedding provider using direct REST API calls."""

    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.model = model or settings.GEMINI_EMBEDDING_MODEL
        self.provider_name = PROVIDER_NAME
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

        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.model}:embedContent?key={self.api_key}"
        )

        client = self._client or httpx.AsyncClient()
        vectors = []
        try:
            for text in texts:
                payload = {
                    "model": f"models/{self.model}",
                    "content": {"parts": [{"text": text}]},
                    # The DB vector column is fixed at 384 dims; Gemini's
                    # text-embedding-004 natively supports requesting a
                    # reduced output dimensionality via this parameter.
                    "outputDimensionality": 384,
                }
                resp = await client.post(
                    url, json=payload, timeout=settings.AI_PROVIDER_TIMEOUT_SECONDS
                )
                if resp.status_code >= 400:
                    raise ProviderAPIError(PROVIDER_NAME, resp.status_code, resp.text[:500])
                data = resp.json()
                vectors.append(data["embedding"]["values"])
        finally:
            if self._client is None:
                await client.aclose()

        return EmbeddingResponse(
            vectors=vectors,
            model=self.model,
            provider=PROVIDER_NAME,
            dimensions=384,
        )
