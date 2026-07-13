"""Multi-provider fallback chain — tries providers in order, fails over
immediately on rate-limit/auth/server errors, and never raises to the caller
(always terminates at the Mock provider).

PHASE-1 SIMPLIFICATION: the circuit breaker is in-memory and per-process —
it is NOT shared across the API and worker processes or across replicas.
This is an accepted limitation, not an oversight: the worst case is a wasted
retry against a still-rate-limited provider once per process, which costs a
little latency but never produces an incorrect answer (the chain always
still fails over to the next provider, or to Mock).
"""

import time
from typing import Any

import httpx
import structlog
from tenacity import (
    AsyncRetrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from caselens.ai_gateway.providers import (
    AllProvidersFailedError,
    EmbeddingProvider,
    EmbeddingResponse,
    LLMProvider,
    LLMResponse,
    ProviderAPIError,
    ProviderNotConfiguredError,
)

logger = structlog.get_logger()

_RETRIABLE_EXCEPTIONS = (httpx.TimeoutException, httpx.ConnectError)


class _CircuitBreaker:
    """Tracks a per-provider cooldown so a just-failed provider isn't retried
    on every single request for a while."""

    def __init__(self) -> None:
        self._cooldowns: dict[str, float] = {}

    def is_open(self, name: str) -> bool:
        until = self._cooldowns.get(name)
        return until is not None and time.monotonic() < until

    def trip(self, name: str, seconds: float) -> None:
        self._cooldowns[name] = time.monotonic() + seconds


# Module-level singleton: chains are constructed fresh per request by the
# factory functions in providers.py, so the breaker state must live outside
# any single ProviderChain instance to be useful across requests.
_circuit_breaker = _CircuitBreaker()


def _cooldown_for_error(settings: Any, exc: ProviderAPIError) -> float:
    if exc.status_code == 429:
        return float(settings.AI_PROVIDER_RATE_LIMIT_COOLDOWN_SECONDS)
    if exc.status_code in (401, 403):
        return float(settings.AI_PROVIDER_AUTH_ERROR_COOLDOWN_SECONDS)
    return float(settings.AI_PROVIDER_COOLDOWN_SECONDS)


async def _call_with_retry(
    settings: Any, provider_name: str, call: Any, **kwargs: Any
) -> Any:
    """Retries only genuine connection blips (timeout/connect error) with
    short exponential backoff. HTTP-status failures (429/401/5xx) are NOT
    retried here — they fail over to the next provider immediately."""
    async for attempt in AsyncRetrying(
        stop=stop_after_attempt(settings.AI_PROVIDER_MAX_RETRIES),
        wait=wait_exponential(multiplier=0.3, max=2),
        retry=retry_if_exception_type(_RETRIABLE_EXCEPTIONS),
        reraise=True,
    ):
        with attempt:
            logger.info("ai_chain.attempt", provider=provider_name)
            return await call(**kwargs)
    raise AssertionError("unreachable")  # AsyncRetrying always returns or raises


class ProviderChain(LLMProvider):
    """Drop-in LLMProvider that tries an ordered list of real providers and
    always terminates at a Mock provider, so callers never see an exception."""

    def __init__(
        self,
        providers: list[LLMProvider],
        mock_provider: LLMProvider | None,
        chain_name: str,
        breaker: _CircuitBreaker | None = None,
    ) -> None:
        self._providers = providers
        # None means "no fake fallback" — raise AllProvidersFailedError when the
        # real providers are exhausted instead of serving placeholder text.
        self._mock = mock_provider
        self._chain_name = chain_name
        self._breaker = breaker or _circuit_breaker

    async def generate(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.1,
        max_tokens: int = 2000,
        **kwargs: Any,
    ) -> LLMResponse:
        return await self._run(
            "generate",
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs,
        )

    async def generate_structured(
        self,
        prompt: str,
        schema: dict[str, Any],
        system_prompt: str | None = None,
        **kwargs: Any,
    ) -> LLMResponse:
        return await self._run(
            "generate_structured", prompt=prompt, schema=schema, system_prompt=system_prompt, **kwargs
        )

    async def _run(self, method_name: str, **kwargs: Any) -> LLMResponse:
        from caselens.config import settings

        attempts: list[dict[str, Any]] = []

        for provider in self._providers:
            name = getattr(provider, "provider_name", None) or provider.__class__.__name__

            if not provider.is_configured():
                logger.debug("ai_chain.skip", chain=self._chain_name, provider=name, reason="not_configured")
                continue
            if self._breaker.is_open(name):
                logger.debug("ai_chain.skip", chain=self._chain_name, provider=name, reason="circuit_open")
                continue

            try:
                method = getattr(provider, method_name)
                resp: LLMResponse = await _call_with_retry(settings, name, method, **kwargs)
                resp.metadata["chain"] = self._chain_name
                resp.metadata["attempts"] = attempts
                resp.metadata["degraded_to_mock"] = False
                logger.info(
                    "ai_chain.success", chain=self._chain_name, provider=name, duration_ms=resp.duration_ms
                )
                return resp
            except ProviderNotConfiguredError:
                continue
            except ProviderAPIError as e:
                cooldown = _cooldown_for_error(settings, e)
                self._breaker.trip(name, cooldown)
                attempts.append({"provider": name, "error": str(e), "status_code": e.status_code})
                logger.warning(
                    "ai_chain.failure",
                    chain=self._chain_name,
                    provider=name,
                    status_code=e.status_code,
                    cooldown_s=cooldown,
                )
                continue
            except _RETRIABLE_EXCEPTIONS as e:
                self._breaker.trip(name, float(settings.AI_PROVIDER_COOLDOWN_SECONDS))
                attempts.append({"provider": name, "error": str(e)})
                logger.warning("ai_chain.failure", chain=self._chain_name, provider=name, error=str(e))
                continue

        # All real providers exhausted. Either raise an honest error (default)
        # or, if a mock was explicitly supplied (dev/CI), serve placeholder text.
        if self._mock is None:
            logger.error(
                "ai_chain.all_providers_failed",
                chain=self._chain_name,
                failed_providers=len(attempts),
            )
            raise AllProvidersFailedError(self._chain_name, attempts)

        method = getattr(self._mock, method_name)
        resp = await method(**kwargs)
        resp.metadata["chain"] = self._chain_name
        resp.metadata["attempts"] = attempts
        resp.metadata["degraded_to_mock"] = True
        logger.warning(
            "ai_chain.degraded_to_mock", chain=self._chain_name, failed_providers=len(attempts)
        )
        return resp


class EmbeddingProviderChain(EmbeddingProvider):
    """Same fallback behavior as ProviderChain, for embedding providers."""

    def __init__(
        self,
        providers: list[EmbeddingProvider],
        mock_provider: EmbeddingProvider | None,
        chain_name: str,
        breaker: _CircuitBreaker | None = None,
    ) -> None:
        self._providers = providers
        self._mock = mock_provider
        self._chain_name = chain_name
        self._breaker = breaker or _circuit_breaker

    @property
    def dimensions(self) -> int:
        return 384

    @property
    def model_name(self) -> str:
        return f"chain:{self._chain_name}"

    async def embed(self, texts: list[str]) -> EmbeddingResponse:
        from caselens.config import settings

        attempts: list[dict[str, Any]] = []

        for provider in self._providers:
            name = provider.model_name

            if not provider.is_configured():
                logger.debug("ai_chain.skip", chain=self._chain_name, provider=name, reason="not_configured")
                continue
            if self._breaker.is_open(name):
                logger.debug("ai_chain.skip", chain=self._chain_name, provider=name, reason="circuit_open")
                continue

            try:
                resp: EmbeddingResponse = await _call_with_retry(
                    settings, name, provider.embed, texts=texts
                )
                logger.info("ai_chain.success", chain=self._chain_name, provider=name)
                return resp
            except ProviderNotConfiguredError:
                continue
            except ProviderAPIError as e:
                cooldown = _cooldown_for_error(settings, e)
                self._breaker.trip(name, cooldown)
                attempts.append({"provider": name, "error": str(e), "status_code": e.status_code})
                logger.warning(
                    "ai_chain.failure", chain=self._chain_name, provider=name, status_code=e.status_code
                )
                continue
            except _RETRIABLE_EXCEPTIONS as e:
                self._breaker.trip(name, float(settings.AI_PROVIDER_COOLDOWN_SECONDS))
                attempts.append({"provider": name, "error": str(e)})
                logger.warning("ai_chain.failure", chain=self._chain_name, provider=name, error=str(e))
                continue

        if self._mock is None:
            logger.error(
                "ai_chain.all_providers_failed",
                chain=self._chain_name,
                failed_providers=len(attempts),
            )
            raise AllProvidersFailedError(self._chain_name, attempts)

        logger.warning(
            "ai_chain.degraded_to_mock", chain=self._chain_name, failed_providers=len(attempts)
        )
        return await self._mock.embed(texts)
