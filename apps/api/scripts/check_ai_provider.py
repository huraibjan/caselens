"""Manually verify a single AI provider is configured correctly.

Run after pasting one real API key into .env, without needing the full
app/DB/Temporal stack running:

    cd apps/api && uv run python scripts/check_ai_provider.py groq
    cd apps/api && uv run python scripts/check_ai_provider.py gemini --embed
"""

import argparse
import asyncio
import sys

sys.path.insert(0, "src")

from caselens.ai_gateway.providers import ProviderAPIError, ProviderNotConfiguredError  # noqa: E402


async def check_llm(name: str) -> None:
    from caselens.ai_gateway.providers import _build_llm_registry  # noqa: SLF001

    registry = _build_llm_registry()
    if name not in registry:
        print(f"Unknown provider '{name}'. Choices: {', '.join(registry)}")
        raise SystemExit(1)

    provider = registry[name]
    if not provider.is_configured():
        print(f"'{name}' has no API key set — nothing to check.")
        raise SystemExit(1)

    print(f"Calling {name}...")
    resp = await provider.generate("Say hello in one short sentence.")
    print(f"provider:     {resp.provider}")
    print(f"model:        {resp.model}")
    print(f"duration_ms:  {resp.duration_ms}")
    print(f"tokens:       in={resp.input_tokens} out={resp.output_tokens}")
    print(f"content:      {resp.content!r}")


async def check_embedding(name: str) -> None:
    from caselens.ai_gateway.providers import _build_embedding_registry  # noqa: SLF001

    registry = _build_embedding_registry()
    if name not in registry:
        print(f"'{name}' has no embedding provider. Choices: {', '.join(registry)}")
        raise SystemExit(1)

    provider = registry[name]
    if not provider.is_configured():
        print(f"'{name}' has no API key set — nothing to check.")
        raise SystemExit(1)

    print(f"Calling {name} embeddings...")
    resp = await provider.embed(["Hello, world."])
    print(f"provider:   {resp.provider}")
    print(f"model:      {resp.model}")
    print(f"dimensions: {len(resp.vectors[0])}")


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("provider", help="gemini | openai | nvidia | groq | cerebras | openrouter")
    parser.add_argument("--embed", action="store_true", help="Check the embedding endpoint instead of chat")
    args = parser.parse_args()

    try:
        if args.embed:
            await check_embedding(args.provider)
        else:
            await check_llm(args.provider)
    except ProviderNotConfiguredError as e:
        print(f"NOT CONFIGURED: {e}")
        raise SystemExit(1) from e
    except ProviderAPIError as e:
        print(f"API ERROR: {e}")
        raise SystemExit(1) from e


if __name__ == "__main__":
    asyncio.run(main())
