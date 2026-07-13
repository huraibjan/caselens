"""Helpers for extracting structured JSON from LLM text output.

Many providers don't reliably honor JSON-mode/response-schema constraints,
especially at the free-tier end. This module centralizes the "the model
sometimes wraps JSON in prose or markdown fences" cleanup so every provider
and call site shares one hardening path instead of each hand-rolling regex.
"""

import json
import re
from typing import Any

_FENCE_RE = re.compile(r"```(?:json)?\s*|```")
_BALANCED_OBJECT_RE = re.compile(r"\{.*\}", re.DOTALL)


def parse_json_loose(text: str) -> dict[str, Any] | None:
    """Best-effort JSON object extraction from LLM text output.

    Strips markdown code fences, then tries `json.loads` directly; on failure,
    falls back to extracting the largest `{...}` substring and retrying.
    Returns None if no valid JSON object could be recovered.
    """
    cleaned = _FENCE_RE.sub("", text).strip()

    try:
        parsed = json.loads(cleaned)
    except (json.JSONDecodeError, ValueError):
        match = _BALANCED_OBJECT_RE.search(cleaned)
        if not match:
            return None
        try:
            parsed = json.loads(match.group(0))
        except (json.JSONDecodeError, ValueError):
            return None

    return parsed if isinstance(parsed, dict) else None
