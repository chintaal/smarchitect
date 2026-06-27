"""Human-readable coherence report built on the quantitative metrics.

Thin presentation layer over :mod:`humanizer.metrics`: it turns the numeric
fingerprint into actionable suggestions ("mix short and long sentences", etc.).
The public ``CoherenceReport`` / ``analyze_coherence`` API is preserved; the
report now also surfaces ``burstiness`` and the composite ``ai_likelihood``.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .metrics import TextMetrics, compute_metrics


@dataclass
class CoherenceReport:
    sentence_count: int = 0
    avg_sentence_length: float = 0.0
    sentence_length_std: float = 0.0
    length_uniformity_score: float = 0.0  # 0=varied, 1=uniform (AI-like)
    burstiness: float = 0.0  # std/mean of sentence length; higher = more human
    lexical_diversity: float = 1.0
    passive_voice_ratio: float = 0.0
    transition_density: float = 0.0
    ai_likelihood: float = 0.0  # composite 0=human .. 1=AI
    ai_phrase_hits: dict[str, int] = field(default_factory=dict)
    repetitive_starters: list[tuple[str, int]] = field(default_factory=list)
    suggestions: list[str] = field(default_factory=list)
    metrics: TextMetrics | None = None

    def to_dict(self) -> dict:
        return {
            "sentence_count": self.sentence_count,
            "avg_sentence_length": round(self.avg_sentence_length, 1),
            "sentence_length_std": round(self.sentence_length_std, 1),
            "length_uniformity_score": round(self.length_uniformity_score, 2),
            "burstiness": round(self.burstiness, 3),
            "lexical_diversity": round(self.lexical_diversity, 3),
            "passive_voice_ratio": round(self.passive_voice_ratio, 2),
            "transition_density": round(self.transition_density, 3),
            "ai_likelihood": round(self.ai_likelihood, 3),
            "ai_phrase_hits": self.ai_phrase_hits,
            "repetitive_starters": self.repetitive_starters,
            "suggestions": self.suggestions,
        }


def analyze_coherence(text: str) -> CoherenceReport:
    """Analyze prose for AI-like patterns and turn the metrics into advice."""
    m = compute_metrics(text)
    report = CoherenceReport(
        sentence_count=m.sentence_count,
        avg_sentence_length=m.avg_sentence_length,
        sentence_length_std=m.sentence_length_std,
        length_uniformity_score=_uniformity(m.burstiness),
        burstiness=m.burstiness,
        lexical_diversity=m.lexical_diversity,
        passive_voice_ratio=m.passive_voice_ratio,
        transition_density=m.transition_density,
        ai_likelihood=m.ai_likelihood,
        ai_phrase_hits=m.ai_phrase_hits,
        repetitive_starters=m.repetitive_starters,
        metrics=m,
    )

    if m.sentence_count == 0:
        report.suggestions.append("No prose sentences detected.")
        return report

    if m.sentence_count > 1 and m.burstiness < 0.4:
        report.suggestions.append(
            f"Sentence rhythm is flat (burstiness {m.burstiness:.2f}); "
            "mix short punchy sentences with longer ones."
        )
    if m.passive_voice_ratio > 0.35:
        report.suggestions.append(
            f"Passive voice in ~{m.passive_voice_ratio:.0%} of sentences; "
            "prefer active voice where possible."
        )
    if m.transition_density > 0.4:
        report.suggestions.append(
            "Heavy use of transition words (furthermore, moreover, …); "
            "trim or vary openings."
        )
    if m.lexical_diversity < 0.6:
        report.suggestions.append(
            f"Vocabulary is repetitive (diversity {m.lexical_diversity:.2f}); "
            "vary word choice."
        )
    if m.repetitive_starters:
        words = ", ".join(f"'{w}' ({c}×)" for w, c in m.repetitive_starters)
        report.suggestions.append(f"Repeated sentence starters: {words}.")
    if m.ai_phrase_hits:
        top = sorted(m.ai_phrase_hits.items(), key=lambda x: -x[1])[:5]
        words = ", ".join(f"'{w}' ({c}×)" for w, c in top)
        report.suggestions.append(f"AI-flavored phrases present: {words}.")

    report.suggestions.insert(
        0, f"AI-likelihood score: {m.ai_likelihood:.0%} (lower is more human)."
    )
    if len(report.suggestions) == 1:
        report.suggestions.append("No major AI-style patterns detected.")
    return report


def _uniformity(b: float) -> float:
    lo, hi = 0.25, 0.7
    return max(0.0, min(1.0, (hi - b) / (hi - lo)))
