"""LLM rewrite pass — the heavy lifting for sounding human.

Three upgrades over a single blind rewrite:

1. **Register-aware prompts.** An academic register preserves the formality an IEEE
   paper needs (no contractions, no "you", no hype) while still killing AI tells; a
   casual register opens up the full toolkit — contractions, second person, concrete
   analogies, deliberate burstiness.
2. **Separate API calls per paragraph.** Each paragraph is rewritten on its own so the
   model can give it real attention and so paragraph structure is preserved 1:1 for the
   LaTeX merge.
3. **A burstiness feedback loop.** After the first pass we measure sentence-length
   variance; if the prose is still too flat we send it back with a targeted "vary the
   rhythm" instruction, up to ``max_iterations`` times.

Providers: OpenAI, Anthropic, Ollama. Everything is gated on credentials and degrades
loudly (raises) rather than silently when misconfigured.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from dataclasses import dataclass, field

from .metrics import burstiness

__all__ = [
    "LLMConfig",
    "LLMResult",
    "humanize_with_llm",
    "llm_available",
    "REGISTERS",
]

REGISTERS = ("academic", "casual")

_ACADEMIC_SYSTEM = """You are an expert academic copyeditor. Rewrite the passage so it \
reads as if a careful human researcher wrote it, while preserving every fact, citation, \
number, equation, and technical term exactly.

Do:
- Vary sentence length and structure. Mix short, direct sentences with longer, layered \
ones so the rhythm is not flat.
- Prefer active voice and concrete subjects ("we measured", "the planner emits") over \
passive constructions.
- Cut AI tells and filler: delve, leverage, utilize, robust, comprehensive, holistic, \
furthermore, moreover, additionally, "it is important to note", "in conclusion", \
landscape, paradigm, tapestry, testament, realm, seamless, pivotal, underscore.
- Replace vague hedges with precise statements where the meaning is clear.

Do NOT:
- Add contractions, second person ("you"), opinions, hype, or first person that was not \
already there.
- Add, remove, or change any claim, citation key (\\cite{...}), equation, or numeric \
result.
- Add commentary, preamble, or markdown. Return only the rewritten passage."""

_CASUAL_SYSTEM = """You are a sharp human writer. Rewrite the passage so it sounds like a \
real person wrote it, not a machine. Keep the meaning and every fact intact — do not \
invent new information.

Do:
- Vary sentence length hard. Short, punchy sentences. Then a longer one that builds and \
breathes. Burstiness is the goal.
- Use contractions (you'll, it's, don't, won't).
- Address the reader as "you" where it fits; lead with the reader's question, not the topic.
- Use active voice and plain words (use, not utilize; start, not commence).
- Ground an abstract point in a concrete example or analogy when one is natural.
- Where the original hedges, keep an honest human hedge ("this depends on your setup") \
rather than fake confidence.

Do NOT:
- Use AI clichés: delve, tapestry, testament, landscape, realm, furthermore, moreover, \
"in conclusion", "it's worth noting", multifaceted, holistic, seamless.
- Sound like a textbook or a press release.
- Add information that is not in the original.

Return only the rewritten text — no preamble, no markdown."""

_SYSTEM_BY_REGISTER = {"academic": _ACADEMIC_SYSTEM, "casual": _CASUAL_SYSTEM}


@dataclass
class LLMConfig:
    register: str = "academic"
    per_paragraph: bool = True
    max_iterations: int = 2          # rhythm-refinement passes
    target_burstiness: float = 0.55  # stop once sentence variance is human-like
    temperature: float = 0.7
    model: str | None = None
    provider: str | None = None      # force a provider; None = auto-detect

    def system_prompt(self) -> str:
        return _SYSTEM_BY_REGISTER.get(self.register, _ACADEMIC_SYSTEM)


@dataclass
class LLMResult:
    text: str
    provider: str
    model: str
    register: str = "academic"
    api_calls: int = 0
    iterations: int = 0
    burstiness_before: float = 0.0
    burstiness_after: float = 0.0
    notes: list[str] = field(default_factory=list)


def _detect_provider(forced: str | None = None) -> tuple[str, str] | None:
    """Return (provider, default_model) from env, or None if no credentials."""
    if forced == "openai" or (forced is None and os.environ.get("OPENAI_API_KEY")):
        return "openai", os.environ.get("HUMANIZER_MODEL", "gpt-4o-mini")
    if forced == "anthropic" or (forced is None and os.environ.get("ANTHROPIC_API_KEY")):
        return "anthropic", os.environ.get("HUMANIZER_MODEL", "claude-haiku-4-5-20251001")
    use_ollama = os.environ.get("OLLAMA_HOST") or os.environ.get(
        "HUMANIZER_USE_OLLAMA", ""
    ).lower() in ("1", "true", "yes")
    if forced == "ollama" or (forced is None and use_ollama):
        return "ollama", os.environ.get("HUMANIZER_MODEL", "llama3.2")
    return None


def llm_available(provider: str | None = None) -> bool:
    return _detect_provider(provider) is not None


def _http_post(url: str, headers: dict[str, str], body: dict) -> dict:
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=180) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _call_openai(system: str, user: str, model: str, temperature: float) -> str:
    key = os.environ["OPENAI_API_KEY"]
    base = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")
    resp = _http_post(
        f"{base.rstrip('/')}/chat/completions",
        {"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        {
            "model": model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": temperature,
        },
    )
    return resp["choices"][0]["message"]["content"].strip()


def _call_anthropic(system: str, user: str, model: str, temperature: float) -> str:
    key = os.environ["ANTHROPIC_API_KEY"]
    resp = _http_post(
        "https://api.anthropic.com/v1/messages",
        {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        },
        {
            "model": model,
            "max_tokens": 8192,
            "temperature": temperature,
            "system": system,
            "messages": [{"role": "user", "content": user}],
        },
    )
    return resp["content"][0]["text"].strip()


def _call_ollama(system: str, user: str, model: str, temperature: float) -> str:
    host = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
    resp = _http_post(
        f"{host}/api/chat",
        {"Content-Type": "application/json"},
        {
            "model": model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "stream": False,
            "options": {"temperature": temperature},
        },
    )
    return resp["message"]["content"].strip()


_DISPATCH = {
    "openai": _call_openai,
    "anthropic": _call_anthropic,
    "ollama": _call_ollama,
}


def _call(provider: str, system: str, user: str, model: str, temperature: float) -> str:
    try:
        return _DISPATCH[provider](system, user, model, temperature)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{provider} API error ({exc.code}): {body[:500]}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"{provider} connection failed: {exc.reason}") from exc


def _split_paragraphs(prose: str) -> list[str]:
    return [p.strip() for p in prose.split("\n\n") if p.strip()]


def _rhythm_prompt(text: str, register: str) -> str:
    extra = (
        " Keep it formal: no contractions, no second person."
        if register == "academic"
        else ""
    )
    return (
        "The passage below is grammatically fine but its sentences are too uniform in "
        "length, which reads as machine-generated. Rewrite it to increase burstiness: "
        "split some sentences into short ones, fuse others into longer ones, so lengths "
        "vary widely. Keep every fact, citation, number, and term unchanged." + extra +
        " Return only the rewritten passage.\n\n" + text
    )


def humanize_with_llm(prose: str, config: LLMConfig | None = None) -> LLMResult:
    """Rewrite *prose* to read as human-written, with chunking + a burstiness loop.

    Raises RuntimeError if no provider is configured.
    """
    config = config or LLMConfig()
    detected = _detect_provider(config.provider)
    if not detected:
        raise RuntimeError(
            "No LLM configured. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, "
            "or HUMANIZER_USE_OLLAMA=1 (with Ollama running)."
        )
    provider, default_model = detected
    model = config.model or default_model
    system = config.system_prompt()

    result = LLMResult(
        text=prose, provider=provider, model=model, register=config.register
    )
    result.burstiness_before = burstiness(prose)

    # Pass 1: rewrite, one API call per paragraph (or one for the whole blob).
    chunks = _split_paragraphs(prose) if config.per_paragraph else [prose]
    chunks = chunks or [prose]
    rewritten: list[str] = []
    for chunk in chunks:
        user = (
            "Rewrite this passage as one paragraph, following the rules:\n\n" + chunk
            if config.per_paragraph
            else "Rewrite this passage:\n\n" + chunk
        )
        rewritten.append(_call(provider, system, user, model, config.temperature))
        result.api_calls += 1
    text = "\n\n".join(rewritten)

    # Pass 2..N: tighten the rhythm until burstiness clears the target.
    b = burstiness(text)
    while b < config.target_burstiness and result.iterations < config.max_iterations:
        text = _call(
            provider, system, _rhythm_prompt(text, config.register), model,
            min(0.9, config.temperature + 0.1),
        )
        result.api_calls += 1
        result.iterations += 1
        new_b = burstiness(text)
        result.notes.append(
            f"rhythm pass {result.iterations}: burstiness {b:.2f} -> {new_b:.2f}"
        )
        if new_b <= b:  # not improving — stop spending calls
            break
        b = new_b

    result.text = text
    result.burstiness_after = b
    return result
