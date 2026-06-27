"""Core humanization: word replacement, coherence, optional LLM."""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from .coherence import CoherenceReport, analyze_coherence
from .latex import extract_prose, map_prose, split_latex
from .llm import LLMResult, humanize_with_llm, llm_available
from .replacements import PHRASES_BY_LENGTH, AI_WORD_REPLACEMENTS

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
    replacements: list[tuple[str, str, str]] = field(default_factory=list)  # (phrase, replacement, context)
    coherence_before: CoherenceReport | None = None
    coherence_after: CoherenceReport | None = None
    llm: LLMResult | None = None
    llm_skipped_reason: str | None = None


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
        replacement = alternatives[0]
        if " " in phrase or "-" in phrase:
            pat = re.compile(re.escape(phrase), re.I)
        else:
            pat = re.compile(r"\b" + re.escape(phrase) + r"\b", re.I)

        def sub_fn(m: re.Match[str], _rep=replacement) -> str:
            orig = m.group(0)
            new = _preserve_case(orig, _rep)
            # Trim double spaces from empty replacements
            log.append((phrase, new or "(removed)", orig))
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
        nonlocal all_log
        new, log = _replace_in_prose(prose)
        all_log.extend(log)
        return new

    return map_prose(text, _apply), all_log


def _merge_llm_prose(original: str, llm_prose: str) -> str:
    """Replace prose segments with LLM output, preserving LaTeX structure.

    When segment count matches, map 1:1. Otherwise replace concatenated prose
    in the first prose block (fallback for long documents).
    """
    segments = split_latex(original)
    prose_indices = [i for i, s in enumerate(segments) if s.kind == "prose" and s.text.strip()]
    llm_parts = [p.strip() for p in llm_prose.split("\n\n") if p.strip()]

    if len(prose_indices) == len(llm_parts) and llm_parts:
        for idx, llm_part in zip(prose_indices, llm_parts):
            segments[idx] = type(segments[idx])(kind="prose", text=llm_part)
        return "".join(s.text for s in segments)

    # Fallback: single blob replaces all prose
    out: list[str] = []
    llm_used = False
    for seg in segments:
        if seg.kind == "prose" and seg.text.strip() and not llm_used:
            out.append(llm_prose)
            llm_used = True
        elif seg.kind == "prose" and llm_used:
            continue  # skip duplicate prose chunks in fallback
        else:
            out.append(seg.text)
    return "".join(out)


def humanize_text(
    text: str,
    *,
    use_llm: bool = False,
    llm_only: bool = False,
) -> HumanizeResult:
    """Humanize *text* with dictionary replacement and optional LLM pass.

    Parameters
    ----------
    use_llm:
        If True, run an LLM rewrite after dictionary replacement (when configured).
    llm_only:
        Skip dictionary replacement; LLM only (requires *use_llm*).
    """
    prose = extract_prose(text)
    coherence_before = analyze_coherence(prose) if prose else None

    if llm_only and use_llm:
        working = text
        replacements: list[tuple[str, str, str]] = []
    else:
        working, replacements = replace_ai_words(text)

    result = HumanizeResult(
        text=working,
        replacements=replacements,
        coherence_before=coherence_before,
    )

    if use_llm:
        if not llm_available():
            result.llm_skipped_reason = (
                "No LLM credentials. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, "
                "or HUMANIZER_USE_OLLAMA=1."
            )
        else:
            llm_input = extract_prose(working)
            if llm_input.strip():
                llm_out = humanize_with_llm(llm_input)
                result.llm = llm_out
                result.text = _merge_llm_prose(working, llm_out.text)
            else:
                result.llm_skipped_reason = "No prose extracted for LLM pass."

    prose_after = extract_prose(result.text)
    result.coherence_after = analyze_coherence(prose_after) if prose_after else None
    return result
