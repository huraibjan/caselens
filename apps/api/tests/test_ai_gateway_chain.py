"""Unit tests for the multi-provider fallback chain — no Postgres required."""

import json

import httpx
import pytest

from caselens.ai_gateway.chain import ProviderChain, _CircuitBreaker
from caselens.ai_gateway.mock_providers import MockLLMProvider
from caselens.ai_gateway.openai_compatible import OpenAICompatibleLLMProvider
from caselens.ai_gateway.providers import AllProvidersFailedError


def _client_for(handler):
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def _ok_response(content: str = "Hello there.") -> httpx.Response:
    return httpx.Response(
        200,
        json={
            "choices": [{"message": {"content": content}}],
            "usage": {"prompt_tokens": 5, "completion_tokens": 3, "total_tokens": 8},
        },
    )


def _provider(name: str, handler, supports_json_mode: bool = False) -> OpenAICompatibleLLMProvider:
    return OpenAICompatibleLLMProvider(
        provider_name=name,
        base_url="https://example.test/v1",
        api_key="test-key",
        model="test-model",
        supports_json_mode=supports_json_mode,
        client=_client_for(handler),
    )


@pytest.mark.asyncio
async def test_first_provider_success_short_circuits() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return _ok_response("from primary")

    primary = _provider("primary", handler)
    chain = ProviderChain([primary], MockLLMProvider(), chain_name="test", breaker=_CircuitBreaker())

    resp = await chain.generate("hi")

    assert resp.provider == "primary"
    assert resp.content == "from primary"
    assert resp.metadata["attempts"] == []
    assert resp.metadata["degraded_to_mock"] is False


@pytest.mark.asyncio
async def test_failover_to_second_provider_on_429() -> None:
    def failing_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(429, text="rate limited")

    def ok_handler(request: httpx.Request) -> httpx.Response:
        return _ok_response("from backup")

    failing = _provider("failing", failing_handler)
    backup = _provider("backup", ok_handler)
    chain = ProviderChain(
        [failing, backup], MockLLMProvider(), chain_name="test", breaker=_CircuitBreaker()
    )

    resp = await chain.generate("hi")

    assert resp.provider == "backup"
    assert resp.content == "from backup"
    assert len(resp.metadata["attempts"]) == 1
    assert resp.metadata["attempts"][0]["provider"] == "failing"
    assert resp.metadata["attempts"][0]["status_code"] == 429


@pytest.mark.asyncio
async def test_all_providers_failing_raises_when_no_mock() -> None:
    def failing_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="server error")

    failing = _provider("failing", failing_handler)
    # mock_provider=None → honest error instead of fake analysis (production default)
    chain = ProviderChain([failing], None, chain_name="test", breaker=_CircuitBreaker())

    with pytest.raises(AllProvidersFailedError) as exc_info:
        await chain.generate("hi")

    assert exc_info.value.chain_name == "test"
    assert len(exc_info.value.attempts) == 1


@pytest.mark.asyncio
async def test_no_providers_configured_raises_when_no_mock() -> None:
    # Empty chain with no mock (e.g. zero API keys, AI_ALLOW_MOCK_FALLBACK off)
    chain = ProviderChain([], None, chain_name="test", breaker=_CircuitBreaker())

    with pytest.raises(AllProvidersFailedError):
        await chain.generate("hi")


@pytest.mark.asyncio
async def test_all_providers_failing_degrades_to_mock_when_opted_in() -> None:
    def failing_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="server error")

    failing = _provider("failing", failing_handler)
    # mock_provider supplied → opt-in dev/CI fallback still works
    chain = ProviderChain([failing], MockLLMProvider(), chain_name="test", breaker=_CircuitBreaker())

    resp = await chain.generate("hi")

    assert resp.provider == "mock"
    assert resp.metadata["degraded_to_mock"] is True
    assert len(resp.metadata["attempts"]) == 1


@pytest.mark.asyncio
async def test_circuit_breaker_skips_recently_failed_provider() -> None:
    call_count = 0

    def failing_handler(request: httpx.Request) -> httpx.Response:
        nonlocal call_count
        call_count += 1
        return httpx.Response(429, text="rate limited")

    failing = _provider("failing", failing_handler)
    breaker = _CircuitBreaker()
    chain = ProviderChain([failing], MockLLMProvider(), chain_name="test", breaker=breaker)

    await chain.generate("first call")
    assert call_count == 1
    assert breaker.is_open("failing")

    # Second call within the cooldown window should skip the HTTP call entirely.
    await chain.generate("second call")
    assert call_count == 1


@pytest.mark.asyncio
async def test_generate_structured_parses_fenced_json_when_no_native_json_mode() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return _ok_response('```json\n{"suspect": "John Doe", "veracityScore": 80}\n```')

    provider = _provider("no-json-mode", handler, supports_json_mode=False)
    chain = ProviderChain([provider], MockLLMProvider(), chain_name="test", breaker=_CircuitBreaker())

    resp = await chain.generate_structured(
        "extract case info", schema={"type": "OBJECT", "properties": {}}
    )

    parsed = json.loads(resp.content)
    assert parsed == {"suspect": "John Doe", "veracityScore": 80}
    assert resp.metadata["json_parsed"] is True
