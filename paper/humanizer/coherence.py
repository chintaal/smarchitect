"""Sentence-level coherence and AI-style pattern analysis."""

from __future__ import annotations

import re
import statistics
from dataclasses import dataclass, field

from .replacements import AI_WORD_REPLACEMENTS

# Heuristic passive: (is|was|were|be|been|being) + optional adverb + past participle
_PASSIVE = re.compile(
    r"\b(?:is|are|was|were|be|been|being)\s+(?:\w+ly\s+)?(?:\w+ed|built|done|given|known|made|seen|shown|written|taken|found|held|kept|left|met|put|read|run|said|sent|set|sit|spoken|stood|struck|taught|thought|told|understood|won|worn)\b",
    re.I,
)

_TRANSITIONS = {
    "furthermore", "moreover", "additionally", "however", "nevertheless",
    "nonetheless", "consequently", "therefore", "thus", "hence", "accordingly",
    "in conclusion", "in summary", "to summarize", "overall", "firstly",
    "secondly", "thirdly", "finally", "in addition", "on the other hand",
}

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+(?=[A-Z\"'])")


@dataclass
class CoherenceReport:
    sentence_count: int = 0
    avg_sentence_length: float = 0.0
    sentence_length_std: float = 0.0
    length_uniformity_score: float = 0.0  # 0=varied, 1=uniform (AI-like)
    passive_voice_ratio: float = 0.0
    transition_density: float = 0.0
    ai_phrase_hits: dict[str, int] = field(default_factory=dict)
    repetitive_starters: list[tuple[str, int]] = field(default_factory=list)
    suggestions: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "sentence_count": self.sentence_count,
            "avg_sentence_length": round(self.avg_sentence_length, 1),
            "sentence_length_std": round(self.sentence_length_std, 1),
            "length_uniformity_score": round(self.length_uniformity_score, 2),
            "passive_voice_ratio": round(self.passive_voice_ratio, 2),
            "transition_density": round(self.transition_density, 3),
            "ai_phrase_hits": self.ai_phrase_hits,
            "repetitive_starters": self.repetitive_starters,
            "suggestions": self.suggestions,
        }


def _sentences(text: str) -> list[str]:
    text = re.sub(r"\s+", " ", text.strip())
    if not text:
        return []
    parts = _SENTENCE_SPLIT.split(text)
    return [s.strip() for s in parts if s.strip()]


def _word_count(s: str) -> int:
    return len(re.findall(r"\b\w+\b", s))


def analyze_coherence(text: str) -> CoherenceReport:
    """Analyze prose for AI-like patterns and readability issues."""
    report = CoherenceReport()
    sents = _sentences(text)
    report.sentence_count = len(sents)
    if not sents:
        report.suggestions.append("No prose sentences detected.")
        return report

    lengths = [_word_count(s) for s in sents]
    report.avg_sentence_length = statistics.mean(lengths)
    report.sentence_length_std = statistics.stdev(lengths) if len(lengths) > 1 else 0.0

    # Low coefficient of variation → uniform sentence length (common in AI text)
    if report.avg_sentence_length > 0:
        cv = report.sentence_length_std / report.avg_sentence_length
        report.length_uniformity_score = max(0.0, min(1.0, 1.0 - cv))
    if report.length_uniformity_score > 0.75:
        report.suggestions.append(
            "Sentence lengths are very uniform; mix short and long sentences."
        )

    passive = sum(1 for s in sents if _PASSIVE.search(s))
    report.passive_voice_ratio = passive / len(sents)
    if report.passive_voice_ratio > 0.35:
        report.suggestions.append(
            f"Passive voice in ~{report.passive_voice_ratio:.0%} of sentences; prefer active voice where possible."
        )

    lower = text.lower()
    trans_count = sum(lower.count(t) for t in _TRANSITIONS)
    report.transition_density = trans_count / max(len(sents), 1)
    if report.transition_density > 0.4:
        report.suggestions.append(
            "Heavy use of transition words (furthermore, moreover, …); trim or vary openings."
        )

    for phrase in AI_WORD_REPLACEMENTS:
        if len(phrase.split()) >= 2 or len(phrase) > 8:
            pat = re.compile(re.escape(phrase), re.I)
            n = len(pat.findall(lower))
            if n:
                report.ai_phrase_hits[phrase] = n

    starters: dict[str, int] = {}
    for s in sents:
        m = re.match(r"^(\w+)", s)
        if m:
            w = m.group(1).lower()
            starters[w] = starters.get(w, 0) + 1
    report.repetitive_starters = sorted(
        [(w, c) for w, c in starters.items() if c >= 3],
        key=lambda x: -x[1],
    )[:5]
    if report.repetitive_starters:
        words = ", ".join(f"'{w}' ({c}×)" for w, c in report.repetitive_starters)
        report.suggestions.append(f"Repeated sentence starters: {words}.")

    if not report.suggestions:
        report.suggestions.append("No major AI-style patterns detected.")

    return report
