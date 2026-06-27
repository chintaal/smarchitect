"""Core humanization pipeline: dictionary → contractions → numbers → optional LLM.

The orchestrator wires the deterministic, offline passes together and then (optionally)
hands the prose to the LLM rewrite loop. Two registers are supported:

* ``academic`` (default) — conservative. Swaps AI buzzwords, normalizes numbers if
  asked, and rewrites with a formal LLM prompt. No contractions, no second person.
  This is the right setting for the IEEE paper.
* ``casual`` — the full humanizing toolkit: contractions on, a conversational LLM
  prompt, deliberate burstiness.

Every pass is LaTeX-safe: commands, math, citations, and verbatim blocks are never
touched (see :mod:`humanizer.latex`).
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .coherence import CoherenceReport, analyze_coherence
from .contractions import apply_contractions
from .latex import extract_prose, map_prose, split_latex
from .llm import LLMConfig, LLMResult, humanize_with_llm, llm_available
from .metrics import TextMetrics, compute_metrics
from .numbers import format_numbers, humanize_available
from .replacements import PHRASES_BY_LENGTH, AI_WORD_REPLACEMENTS

import re

__all__ = [
    "AI_WORD_REPLACEMENTS",
    "HumanizeResult",
    "replace_ai_words",
    "analyze_coherence",
    "humanize_text",
    "llm_available",
]


@dataclass
class HumanizeResult:
    text: str
    register: str = "academic"
    replacements: list[tuple[str, str, str]] = field(default_factory=list)  # (phrase, repl, ctx)
    contractions_applied: int = 0
    number_changes: list[tuple[str, str]] = field(default_factory=list)
    coherence_before: CoherenceReport | None = None
    coherence_after: CoherenceReport | None = None
    metrics_before: TextMetrics | None = None
    metrics_after: TextMetrics | None = None
    llm: LLMResult | None = None
    llm_skipped_reason: str | None = None
    notes: list[str] = field(default_factory=list)


def _preserve_case(original: str, replacement: str) -> str:
    if not replacement:
        return ""
    if original.isupper():
        return replacement.upper()
    if original[0].isupper():
        return replacement[0].upper() + replacement[1:]
    return replacement


def _replace_in_prose(prose: str) -> tuple[str, list[tuple[str, str, str]]]:
    """Replace AI phrases in plain prose; return (new_text, log)."""
    log: list[tuple[str, str, str]] = []
    result = prose

    for phrase, alternatives in PHRASES_BY_LENGTH:
        if not alternatives or alternatives[0] == phrase:
            continue
        if " " in phrase or "-" in phrase:
            pat = re.compile(re.escape(phrase), re.I)
        else:
            pat = re.compile(r"\b" + re.escape(phrase) + r"\b", re.I)

        # Rotate through the alternatives so repeated buzzwords don't all collapse to
        # the same word (avoids "use ... use ... use" — a fresh AI tell of its own).
        counter = [0]

        def sub_fn(m: re.Match[str], _alts=alternatives, _ph=phrase, _c=counter) -> str:
            rep = _alts[_c[0] % len(_alts)]
            _c[0] += 1
            orig = m.group(0)
            new = _preserve_case(orig, rep)
            log.append((_ph, new or "(removed)", orig))
            return new

        new_result = pat.sub(sub_fn, result)
        if new_result != result:
            result = re.sub(r"  +", " ", new_result)
            result = re.sub(r" ([,.;:])", r"\1", result)

    return result, log


def replace_ai_words(text: str) -> tuple[str, list[tuple[str, str, str]]]:
    """Replace AI buzzwords in *text*, preserving LaTeX commands and math."""
    all_log: list[tuple[str, str, str]] = []

    def _apply(prose: str) -> str:
        new, log = _replace_in_prose(prose)
        all_log.extend(log)
        return new

    return map_prose(text, _apply), all_log


def _contractions_in_prose(text: str) -> tuple[str, int]:
    total = 0

    def _apply(prose: str) -> str:
        nonlocal total
        new, n = apply_contractions(prose)
        total += n
        return new

    return map_prose(text, _apply), total


def _numbers_in_prose(text: str) -> tuple[str, list[tuple[str, str]]]:
    changes: list[tuple[str, str]] = []

    def _apply(prose: str) -> str:
        new, ch = format_numbers(prose)
        changes.extend(ch)
        return new

    return map_prose(text, _apply), changes


def _merge_llm_prose(original: str, llm_prose: str) -> str:
    """Replace prose segments with LLM output, preserving LaTeX structure."""
    segments = split_latex(original)
    prose_indices = [i for i, s in enumerate(segments) if s.kind == "prose" and s.text.strip()]
    llm_parts = [p.strip() for p in llm_prose.split("\n\n") if p.strip()]

    if len(prose_indices) == len(llm_parts) and llm_parts:
        for idx, llm_part in zip(prose_indices, llm_parts):
            segments[idx] = type(segments[idx])(kind="prose", text=llm_part)
        return "".join(s.text for s in segments)

    # Fallback: single blob replaces all prose.
    out: list[str] = []
    llm_used = False
    for seg in segments:
        if seg.kind == "prose" and seg.text.strip() and not llm_used:
            out.append(llm_prose)
            llm_used = True
        elif seg.kind == "prose" and llm_used:
            continue
        else:
            out.append(seg.text)
    return "".join(out)


def humanize_text(
    text: str,
    *,
    register: str = "academic",
    use_contractions: bool | None = None,
    use_numbers: bool = False,
    use_llm: bool = False,
    llm_only: bool = False,
    llm_config: LLMConfig | None = None,
) -> HumanizeResult:
    """Humanize *text* through the full pipeline.

    Parameters
    ----------
    register:
        ``"academic"`` (conservative, default) or ``"casual"`` (full toolkit).
    use_contractions:
        Apply the contractions pass. ``None`` (default) means *on* for casual,
        *off* for academic.
    use_numbers:
        Run the ``humanize``-library number-formatting pass (thousands separators).
    use_llm / llm_only:
        Run the LLM rewrite (after / instead of the deterministic passes).
    llm_config:
        Override LLM behavior; its ``register`` is forced to match *register*.
    """
    if register not in ("academic", "casual"):
        raise ValueError(f"register must be 'academic' or 'casual', got {register!r}")
    if use_contractions is None:
        use_contractions = register == "casual"

    prose = extract_prose(text)
    metrics_before = compute_metrics(prose) if prose else None
    coherence_before = analyze_coherence(prose) if prose else None

    result = HumanizeResult(
        text=text,
        register=register,
        coherence_before=coherence_before,
        metrics_before=metrics_before,
    )

    if llm_only and use_llm:
        working = text
    else:
        working, result.replacements = replace_ai_words(text)
        if use_contractions:
            working, result.contractions_applied = _contractions_in_prose(working)
        if use_numbers:
            if not humanize_available():
                result.notes.append(
                    "Number pass skipped: `humanize` library not installed "
                    "(pip install humanize)."
                )
            else:
                working, result.number_changes = _numbers_in_prose(working)

    result.text = working

    if use_llm:
        if not llm_available(llm_config.provider if llm_config else None):
            result.llm_skipped_reason = (
                "No LLM credentials. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, "
                "or HUMANIZER_USE_OLLAMA=1."
            )
        else:
            cfg = llm_config or LLMConfig()
            cfg.register = register  # keep prompt register in sync
            llm_input = extract_prose(working)
            if llm_input.strip():
                llm_out = humanize_with_llm(llm_input, cfg)
                result.llm = llm_out
                result.text = _merge_llm_prose(working, llm_out.text)
            else:
                result.llm_skipped_reason = "No prose extracted for LLM pass."

    prose_after = extract_prose(result.text)
    result.coherence_after = analyze_coherence(prose_after) if prose_after else None
    result.metrics_after = compute_metrics(prose_after) if prose_after else None
    return result
