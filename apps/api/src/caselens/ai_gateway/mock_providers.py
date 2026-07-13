"""Mock AI providers for Phase 1 — deterministic behavior, zero external calls."""

import hashlib
import time
from typing import Any

from caselens.ai_gateway.providers import (
    EmbeddingProvider,
    EmbeddingResponse,
    LLMProvider,
    LLMResponse,
    RerankingProvider,
    RerankResponse,
    RerankResult,
)


class MockLLMProvider(LLMProvider):
    """Deterministic mock LLM that generates structured legal responses."""

    async def generate(
        self,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.1,
        max_tokens: int = 2000,
        **kwargs: Any,
    ) -> LLMResponse:
        start = time.monotonic()

        # Generate deterministic response based on prompt content
        word_count = len(prompt.split())
        response_content = (
            f"Based on the provided legal documents and evidence, "
            f"the analysis indicates the following key findings. "
            f"This assessment is derived from {word_count} words of source material "
            f"and should be reviewed by qualified legal counsel.\n\n"
            f"The evidence supports the following conclusions, each traceable "
            f"to specific document sources cited below."
        )

        duration_ms = int((time.monotonic() - start) * 1000)
        input_tokens = word_count
        output_tokens = len(response_content.split())

        return LLMResponse(
            content=response_content,
            model="mock-legal-llm",
            provider="mock",
            model_version="1.0.0",
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=input_tokens + output_tokens,
            estimated_cost_usd=0.0,
            duration_ms=duration_ms,
        )

    async def generate_structured(
        self,
        prompt: str,
        schema: dict[str, Any],
        system_prompt: str | None = None,
        **kwargs: Any,
    ) -> LLMResponse:
        return await self.generate(prompt, system_prompt)


class MockEmbeddingProvider(EmbeddingProvider):
    """Deterministic mock embedding provider — content-hash-based 384-dim vectors."""

    @property
    def dimensions(self) -> int:
        return 384

    @property
    def model_name(self) -> str:
        return "mock-embedding-384"

    async def embed(self, texts: list[str]) -> EmbeddingResponse:
        import random
        vectors = []
        for text in texts:
            # Generate deterministic vector using seeded random generator to yield exactly 384 dimensions
            seed = int(hashlib.sha256(text.encode()).hexdigest(), 16)
            rng = random.Random(seed)
            vector = [rng.uniform(-1.0, 1.0) for _ in range(384)]
            # Normalize to unit vector
            magnitude = sum(v * v for v in vector) ** 0.5
            if magnitude > 0:
                vector = [v / magnitude for v in vector]
            vectors.append(vector)

        return EmbeddingResponse(
            vectors=vectors,
            model="mock-embedding-384",
            provider="mock",
            model_version="1.0.0",
            dimensions=384,
            total_tokens=sum(len(t.split()) for t in texts),
            estimated_cost_usd=0.0,
        )


class MockRerankingProvider(RerankingProvider):
    """TF-IDF-based mock reranking provider."""

    async def rerank(
        self, query: str, documents: list[str], top_k: int = 5
    ) -> RerankResponse:
        start = time.monotonic()

        # Simple TF-IDF-like scoring
        query_terms = set(query.lower().split())
        scored_docs: list[tuple[int, float, str]] = []

        for i, doc in enumerate(documents):
            doc_terms = doc.lower().split()
            if not doc_terms:
                scored_docs.append((i, 0.0, doc))
                continue

            # Calculate term overlap score
            overlap = sum(1 for term in doc_terms if term in query_terms)
            score = overlap / len(doc_terms) if doc_terms else 0.0
            scored_docs.append((i, score, doc))

        # Sort by score descending
        scored_docs.sort(key=lambda x: x[1], reverse=True)

        results = [
            RerankResult(index=idx, score=score, text=text)
            for idx, score, text in scored_docs[:top_k]
        ]

        duration_ms = int((time.monotonic() - start) * 1000)

        return RerankResponse(
            results=results,
            model="mock-tfidf-reranker",
            duration_ms=duration_ms,
        )
