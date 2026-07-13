"""Generic provider for the many free-tier services that speak the OpenAI
chat-completions REST schema (Nvidia NIM, Groq, Cerebras, OpenRouter, ...).

Rather than one near-duplicate provider class per vendor, a single
parameterized class covers all of them — only base URL, API key, model name,
and JSON-mode support differ.
"""

import json
import time
from typing import Any

import httpx

from caselens.ai_gateway.json_utils import parse_json_loose
from caselens.ai_gateway.providers import (
    LLMProvider,
    LLMResponse,
    ProviderAPIError,
    ProviderNotConfiguredError,
)
from caselens.config import settings


class OpenAICompatibleLLMProvider(LLMProvider):
    """LLM provider for any OpenAI-compatible `/chat/completions` API."""

    def __init__(
        self,
        provider_name: str,
        base_url: str,
        api_key: str | None,
        model: str,
        supports_json_mode: bool = False,
        extra_headers: dict[str, str] | None = None,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        self.provider_name = provider_name
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model
        self.supports_json_mode = supports_json_mode
        self.extra_headers = extra_headers or {}
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
            raise ProviderNotConfiguredError(self.provider_name)

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        payload: dict[str, Any] = {
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
            provider=self.provider_name,
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
            raise ProviderNotConfiguredError(self.provider_name)

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})

        # response_format=json_object (below) only guarantees *valid* JSON, not
        # this specific shape, so the schema is always spelled out in the prompt too.
        effective_prompt = (
            f"{prompt}\n\n"
            "Respond with ONLY a raw JSON object matching this schema, with no markdown "
            f"code fences, explanations, or any text outside the JSON:\n{json.dumps(schema)}"
        )
        messages.append({"role": "user", "content": effective_prompt})

        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.1,
        }
        if self.supports_json_mode:
            payload["response_format"] = {"type": "json_object"}

        start = time.monotonic()
        data = await self._post(payload)
        duration_ms = int((time.monotonic() - start) * 1000)

        raw_content = data["choices"][0]["message"]["content"]
        usage = data.get("usage", {})

        # Defense-in-depth: even providers with native JSON mode occasionally
        # wrap output in prose/fences at the free tier, so always normalize.
        parsed = parse_json_loose(raw_content)
        content = json.dumps(parsed) if parsed is not None else raw_content

        return LLMResponse(
            content=content,
            model=self.model,
            provider=self.provider_name,
            input_tokens=usage.get("prompt_tokens", 0),
            output_tokens=usage.get("completion_tokens", 0),
            total_tokens=usage.get("total_tokens", 0),
            duration_ms=duration_ms,
            metadata={"json_parsed": parsed is not None},
        )

    async def _post(self, payload: dict[str, Any]) -> dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            **self.extra_headers,
        }
        client = self._client or httpx.AsyncClient()
        try:
            resp = await client.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload,
                timeout=settings.AI_PROVIDER_TIMEOUT_SECONDS,
            )
        finally:
            if self._client is None:
                await client.aclose()

        if resp.status_code >= 400:
            raise ProviderAPIError(self.provider_name, resp.status_code, resp.text[:500])
        data: dict[str, Any] = resp.json()
        return data
