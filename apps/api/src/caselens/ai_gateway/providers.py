"""Abstract AI provider interfaces for LLM, embedding, and reranking."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


class ProviderError(Exception):
    """Base exception for AI provider failures."""


class ProviderNotConfiguredError(ProviderError):
    """Raised when a provider has no API key configured."""

    def __init__(self, provider_name: str) -> None:
        self.provider_name = provider_name
        super().__init__(f"Provider '{provider_name}' is not configured (missing API key)")


class ProviderAPIError(ProviderError):
    """Raised when a provider's API call fails (non-2xx, timeout, etc.)."""

    def __init__(self, provider_name: str, status_code: int | None, message: str) -> None:
        self.provider_name = provider_name
        self.status_code = status_code
        super().__init__(f"Provider '{provider_name}' API error ({status_code}): {message}")


class AllProvidersFailedError(ProviderError):
    """Raised when every provider in a chain was unavailable and mock fallback
    is disabled — signals the caller to surface an honest 'AI unavailable'
    error rather than serve placeholder text."""

    def __init__(self, chain_name: str, attempts: list[dict[str, Any]]) -> None:
        self.chain_name = chain_name
        self.attempts = attempts
        detail = "no providers configured" if not attempts else f"{len(attempts)} provider(s) failed"
        super().__init__(f"All AI providers in the '{chain_name}' chain are unavailable ({detail})")


@dataclass
class LLMResponse:
    """Structured response from an LLM provider."""

    content: str
    model: str
    provider: str = "unknown"
    model_version: str | None = None
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    estimated_cost_usd: float = 0.0
    duration_ms: int = 0
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class EmbeddingResponse:
    """Response from an embedding provider."""

    vectors: list[list[float]]
    model: str
    provider: str = "unknown"
    model_version: str | None = None
    dimensions: int = 384
    total_tokens: int = 0
    estimated_cost_usd: float = 0.0


@dataclass
class RerankResult:
    """A single reranked result."""

    index: int
    score: float
    text: str


@dataclass
class RerankResponse:
    """Response from a reranking provider."""

    results: list[RerankResult]
    model: str
    duration_ms: int = 0


class LLMProvider(ABC):
    """Abstract interface for language model providers."""

    def is_configured(self) -> bool:
        """Whether this provider has the credentials it needs to be called. Real
        providers override this; it defaults to True (e.g. for Mock and for
        composite providers like ProviderChain, which are always usable)."""
        return True

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.1,
        max_tokens: int = 2000,
        **kwargs: Any,
    ) -> LLMResponse:
        ...

    @abstractmethod
    async def generate_structured(
        self,
        prompt: str,
        schema: dict[str, Any],
        system_prompt: str | None = None,
        **kwargs: Any,
    ) -> LLMResponse:
        ...


class EmbeddingProvider(ABC):
    """Abstract interface for embedding providers."""

    def is_configured(self) -> bool:
        """Whether this provider has the credentials it needs to be called."""
        return True

    @abstractmethod
    async def embed(self, texts: list[str]) -> EmbeddingResponse:
        ...

    @property
    @abstractmethod
    def dimensions(self) -> int:
        ...

    @property
    @abstractmethod
    def model_name(self) -> str:
        ...


class RerankingProvider(ABC):
    """Abstract interface for reranking providers."""

    @abstractmethod
    async def rerank(
        self, query: str, documents: list[str], top_k: int = 5
    ) -> RerankResponse:
        ...


def _build_llm_registry() -> dict[str, LLMProvider]:
    """Every real LLM provider, keyed by the name used in the
    AI_CHAT_PROVIDER_CHAIN / AI_ANALYSIS_PROVIDER_CHAIN env vars."""
    from caselens.ai_gateway.gemini import GeminiLLMProvider
    from caselens.ai_gateway.openai import OpenAILLMProvider
    from caselens.ai_gateway.openai_compatible import OpenAICompatibleLLMProvider
    from caselens.config import settings

    return {
        "gemini": GeminiLLMProvider(),
        "openai": OpenAILLMProvider(),
        "nvidia": OpenAICompatibleLLMProvider(
            "nvidia",
            "https://integrate.api.nvidia.com/v1",
            settings.NVIDIA_API_KEY,
            settings.NVIDIA_MODEL,
            supports_json_mode=False,
        ),
        "groq": OpenAICompatibleLLMProvider(
            "groq",
            "https://api.groq.com/openai/v1",
            settings.GROQ_API_KEY,
            settings.GROQ_MODEL,
            supports_json_mode=True,
        ),
        "cerebras": OpenAICompatibleLLMProvider(
            "cerebras",
            "https://api.cerebras.ai/v1",
            settings.CEREBRAS_API_KEY,
            settings.CEREBRAS_MODEL,
            supports_json_mode=True,
        ),
        "openrouter": OpenAICompatibleLLMProvider(
            "openrouter",
            "https://openrouter.ai/api/v1",
            settings.OPENROUTER_API_KEY,
            settings.OPENROUTER_MODEL,
            supports_json_mode=False,
        ),
    }


def _build_embedding_registry() -> dict[str, EmbeddingProvider]:
    from caselens.ai_gateway.gemini import GeminiEmbeddingProvider
    from caselens.ai_gateway.openai import OpenAIEmbeddingProvider

    return {
        "gemini": GeminiEmbeddingProvider(),
        "openai": OpenAIEmbeddingProvider(),
    }


def _resolve_chain(csv_names: str, registry: dict[str, Any]) -> list[Any]:
    names = [n.strip() for n in csv_names.split(",") if n.strip()]
    return [registry[n] for n in names if n in registry]


def get_llm_provider() -> LLMProvider:
    """Chat lane — cascades through AI_CHAT_PROVIDER_CHAIN. Raises
    AllProvidersFailedError when every provider is unavailable, unless
    AI_ALLOW_MOCK_FALLBACK is enabled (dev/CI only)."""
    from caselens.ai_gateway.chain import ProviderChain
    from caselens.ai_gateway.mock_providers import MockLLMProvider
    from caselens.config import settings

    providers = _resolve_chain(settings.AI_CHAT_PROVIDER_CHAIN, _build_llm_registry())
    mock = MockLLMProvider() if settings.AI_ALLOW_MOCK_FALLBACK else None
    return ProviderChain(providers, mock, chain_name="chat")


def get_analysis_llm_provider() -> LLMProvider:
    """Document-analysis lane — cascades through AI_ANALYSIS_PROVIDER_CHAIN.
    Raises AllProvidersFailedError when every provider is unavailable, unless
    AI_ALLOW_MOCK_FALLBACK is enabled (dev/CI only)."""
    from caselens.ai_gateway.chain import ProviderChain
    from caselens.ai_gateway.mock_providers import MockLLMProvider
    from caselens.config import settings

    providers = _resolve_chain(settings.AI_ANALYSIS_PROVIDER_CHAIN, _build_llm_registry())
    mock = MockLLMProvider() if settings.AI_ALLOW_MOCK_FALLBACK else None
    return ProviderChain(providers, mock, chain_name="analysis")


def get_embedding_provider() -> EmbeddingProvider:
    """Embedding lane — cascades through AI_EMBEDDING_PROVIDER_CHAIN. Only
    Gemini/OpenAI are wired for embeddings today — Groq/Cerebras have no
    embeddings endpoint and OpenRouter's is unreliable at the free tier.
    Raises AllProvidersFailedError when unavailable unless
    AI_ALLOW_MOCK_FALLBACK is enabled (dev/CI only)."""
    from caselens.ai_gateway.chain import EmbeddingProviderChain
    from caselens.ai_gateway.mock_providers import MockEmbeddingProvider
    from caselens.config import settings

    providers = _resolve_chain(settings.AI_EMBEDDING_PROVIDER_CHAIN, _build_embedding_registry())
    mock = MockEmbeddingProvider() if settings.AI_ALLOW_MOCK_FALLBACK else None
    return EmbeddingProviderChain(providers, mock, chain_name="embedding")
