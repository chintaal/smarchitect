"""Optional LLM pass for deeper humanization (OpenAI, Anthropic, Ollama)."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from dataclasses import dataclass

HUMANIZE_SYSTEM = """You rewrite academic prose to sound naturally human-written while preserving \
technical accuracy, citations, and meaning. Rules:
- Remove AI buzzwords (delve, leverage, robust, comprehensive, furthermore, moreover, \
it's important to note, in conclusion, landscape, paradigm, utilize, facilitate, etc.)
- Vary sentence length and structure; prefer active voice when clear
- Keep domain terms, equations, and proper nouns unchanged
- Do NOT add fluff, hype, or first-person unless already present
- Return ONLY the rewritten prose — no commentary"""


@dataclass
class LLMResult:
    text: str
    provider: str
    model: str


def _detect_provider() -> tuple[str, str] | None:
    """Return (provider, model) from env, or None if no credentials."""
    if os.environ.get("OPENAI_API_KEY"):
        return "openai", os.environ.get("HUMANIZER_MODEL", "gpt-4o-mini")
    if os.environ.get("ANTHROPIC_API_KEY"):
        return "anthropic", os.environ.get("HUMANIZER_MODEL", "claude-3-5-haiku-20241022")
    # Ollama needs no key; only use if explicitly enabled
    if os.environ.get("OLLAMA_HOST") or os.environ.get("HUMANIZER_USE_OLLAMA", "").lower() in ("1", "true", "yes"):
        return "ollama", os.environ.get("HUMANIZER_MODEL", "llama3.2")
    return None


def llm_available() -> bool:
    return _detect_provider() is not None


def _http_post(url: str, headers: dict[str, str], body: dict) -> dict:
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _call_openai(prose: str, model: str) -> str:
    key = os.environ["OPENAI_API_KEY"]
    base = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": HUMANIZE_SYSTEM},
            {"role": "user", "content": f"Rewrite this academic prose:\n\n{prose}"},
        ],
        "temperature": 0.4,
    }
    resp = _http_post(
        f"{base.rstrip('/')}/chat/completions",
        {"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        payload,
    )
    return resp["choices"][0]["message"]["content"].strip()


def _call_anthropic(prose: str, model: str) -> str:
    key = os.environ["ANTHROPIC_API_KEY"]
    payload = {
        "model": model,
        "max_tokens": 8192,
        "system": HUMANIZE_SYSTEM,
        "messages": [{"role": "user", "content": f"Rewrite this academic prose:\n\n{prose}"}],
    }
    resp = _http_post(
        "https://api.anthropic.com/v1/messages",
        {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        },
        payload,
    )
    return resp["content"][0]["text"].strip()


def _call_ollama(prose: str, model: str) -> str:
    host = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": HUMANIZE_SYSTEM},
            {"role": "user", "content": f"Rewrite this academic prose:\n\n{prose}"},
        ],
        "stream": False,
        "options": {"temperature": 0.4},
    }
    resp = _http_post(
        f"{host}/api/chat",
        {"Content-Type": "application/json"},
        payload,
    )
    return resp["message"]["content"].strip()


def humanize_with_llm(prose: str) -> LLMResult:
    """Run LLM humanization on plain prose. Raises RuntimeError if no provider configured."""
    detected = _detect_provider()
    if not detected:
        raise RuntimeError(
            "No LLM configured. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, "
            "or HUMANIZER_USE_OLLAMA=1 (with Ollama running)."
        )
    provider, model = detected
    try:
        if provider == "openai":
            text = _call_openai(prose, model)
        elif provider == "anthropic":
            text = _call_anthropic(prose, model)
        else:
            text = _call_ollama(prose, model)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{provider} API error ({exc.code}): {body[:500]}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"{provider} connection failed: {exc.reason}") from exc
    return LLMResult(text=text, provider=provider, model=model)
