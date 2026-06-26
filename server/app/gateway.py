"""LiteLLM gateway wrapper.

Every agent call goes through one stable endpoint, so the platform stays
model-agnostic and resilient. Falls back gracefully when no gateway/key is
configured, so the API runs end-to-end with zero credentials.
"""
from __future__ import annotations

import os
from typing import Optional

# Map agent task -> model alias defined in litellm.config.yaml.
TASK_MODEL = {
    "requirements": "requirements",
    "research": "research",
    "architect": "architect",
    "cost": "cheap",
    "security": "security",
    "compliance": "compliance",
    "labels": "cheap",
    "edit": "architect",
}


def gateway_available() -> bool:
    """True when a LiteLLM proxy or a provider key is configured."""
    return bool(
        os.environ.get("LITELLM_BASE_URL")
        or os.environ.get("ANTHROPIC_API_KEY")
        or os.environ.get("OPENAI_API_KEY")
    )


def complete(task: str, system: str, user: str, *, model: str = "auto") -> Optional[str]:
    """Route a single completion through LiteLLM. Returns None if unavailable,
    letting callers fall back to the deterministic planner."""
    if not gateway_available():
        return None
    try:
        import litellm  # imported lazily so the API runs without the dep
    except ImportError:
        return None

    selected = model if model and model != "auto" else TASK_MODEL.get(task, "requirements")
    kwargs: dict = {
        "model": selected,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.2,
    }
    base = os.environ.get("LITELLM_BASE_URL")
    if base:
        kwargs["base_url"] = base
        kwargs["api_key"] = os.environ.get("LITELLM_MASTER_KEY", "sk-anything")

    try:
        resp = litellm.completion(**kwargs)
        return resp["choices"][0]["message"]["content"]
    except Exception:
        # Resilient by design — a throttled/unavailable model never breaks the API.
        return None
