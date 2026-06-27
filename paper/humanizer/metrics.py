"""Quantitative AI-likelihood metrics: burstiness, lexical diversity, composite score.

AI detectors lean on two signals above all:

* **Perplexity** — how predictable the word choices are. We approximate the *opposite*
  of perplexity locally with lexical diversity and repeated-bigram density (no model,
  no API needed).
* **Burstiness** — how much sentence length varies. Human writing swings between short,
  punchy lines and long, layered ones; AI writing tends to a flat, uniform rhythm.

Everything here is pure-Python and offline so it can drive a feedback loop and be
unit-tested without credentials. :mod:`humanizer.coherence` builds its human-readable
report on top of these primitives.
"""

from __future__ import annotations

import re
import statistics
from dataclasses import dataclass, field

from .replacements import AI_WORD_REPLACEMENTS

# Sentence boundary: terminal punct + space + capital/quote/paren opener.
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+(?=[A-Z\"'(“])")
_WORD = re.compile(r"[A-Za-z][A-Za-z'-]*")

_TRANSITIONS = {
    "furthermore", "moreover", "additionally", "however", "nevertheless",
    "nonetheless", "consequently", "therefore", "thus", "hence", "accordingly",
    "in conclusion", "in summary", "to summarize", "overall", "firstly",
    "secondly", "thirdly", "finally", "in addition", "on the other hand",
}

# Heuristic passive: (be-verb) + optional adverb + past participle.
_PASSIVE = re.compile(
    r"\b(?:is|are|was|were|be|been|being)\s+(?:\w+ly\s+)?"
    r"(?:\w+ed|built|done|given|known|made|seen|shown|written|taken|found|held|kept|"
    r"left|met|put|read|run|said|sent|set|spoken|stood|struck|taught|thought|told|"
    r"understood|won|worn)\b",
    re.I,
)

# Words so common they say nothing about lexical diversity.
_STOPWORDS = frozenset(
    """a an the of to in on at for and or but nor so yet is are was were be been being
    this that these those it its as by with from into than then there here we you they
    i he she them us our your their his her not no do does did has have had will would
    can could should may might must shall about over under more most such which who whom
    whose what when where why how if while because though although which""".split()
)


def split_sentences(text: str) -> list[str]:
    """Split prose into sentences (whitespace-normalized)."""
    text = re.sub(r"\s+", " ", text.strip())
    if not text:
        return []
    return [s.strip() for s in _SENTENCE_SPLIT.split(text) if s.strip()]


def word_count(sentence: str) -> int:
    return len(_WORD.findall(sentence))


def burstiness(text: str) -> float:
    """Coefficient of variation of sentence length (std / mean).

    Low (~0.3) reads as uniform and machine-like; human prose typically lands
    around 0.6-1.2. Returns 0.0 when there are too few sentences to judge.
    """
    sents = split_sentences(text)
    lengths = [word_count(s) for s in sents if word_count(s) > 0]
    if len(lengths) < 2:
        return 0.0
    mean = statistics.mean(lengths)
    if mean == 0:
        return 0.0
    return statistics.pstdev(lengths) / mean


def lexical_diversity(text: str) -> float:
    """Type-token ratio over content words (a cheap inverse-perplexity proxy).

    1.0 = every content word unique; lower = repetitive/predictable. Normalized for
    length so longer passages aren't unfairly penalized (Moving-Average-style cap).
    """
    words = [w.lower() for w in _WORD.findall(text)]
    content = [w for w in words if w not in _STOPWORDS and len(w) > 2]
    if not content:
        return 1.0
    # Sample-size correction: TTR drifts down with length, so measure over windows.
    window = 80
    if len(content) <= window:
        return len(set(content)) / len(content)
    ratios = [
        len(set(content[i : i + window])) / window
        for i in range(0, len(content) - window + 1, window)
    ]
    return statistics.mean(ratios) if ratios else len(set(content)) / len(content)


def repeated_bigram_ratio(text: str) -> float:
    """Fraction of word bigrams that recur — high recurrence reads as templated."""
    words = [w.lower() for w in _WORD.findall(text)]
    if len(words) < 2:
        return 0.0
    bigrams = list(zip(words, words[1:]))
    seen: dict[tuple[str, str], int] = {}
    for bg in bigrams:
        seen[bg] = seen.get(bg, 0) + 1
    repeated = sum(c for c in seen.values() if c > 1)
    return repeated / len(bigrams)


def _clamp(x: float) -> float:
    return max(0.0, min(1.0, x))


def _uniformity_from_burstiness(b: float) -> float:
    """Map burstiness CV to a 0..1 'too uniform' score (1 = AI-flat, 0 = varied)."""
    # b >= 0.7 -> fully varied (0); b <= 0.25 -> fully uniform (1).
    lo, hi = 0.25, 0.7
    return _clamp((hi - b) / (hi - lo))


def _ai_phrase_hits(text: str) -> dict[str, int]:
    lower = text.lower()
    hits: dict[str, int] = {}
    for phrase in AI_WORD_REPLACEMENTS:
        if len(phrase.split()) >= 2 or len(phrase) > 8:
            n = len(re.findall(re.escape(phrase), lower))
            if n:
                hits[phrase] = n
    return hits


@dataclass
class TextMetrics:
    """A quantitative fingerprint of how machine-generated a passage reads."""

    sentence_count: int = 0
    avg_sentence_length: float = 0.0
    sentence_length_std: float = 0.0
    burstiness: float = 0.0  # higher = more human rhythm
    lexical_diversity: float = 1.0  # higher = less predictable
    repeated_bigram_ratio: float = 0.0
    passive_voice_ratio: float = 0.0
    transition_density: float = 0.0
    ai_phrase_density: float = 0.0  # AI-cliche hits per sentence
    repeated_starter_ratio: float = 0.0
    ai_likelihood: float = 0.0  # 0 = human, 1 = AI
    ai_phrase_hits: dict[str, int] = field(default_factory=dict)
    repetitive_starters: list[tuple[str, int]] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "sentence_count": self.sentence_count,
            "avg_sentence_length": round(self.avg_sentence_length, 1),
            "sentence_length_std": round(self.sentence_length_std, 1),
            "burstiness": round(self.burstiness, 3),
            "lexical_diversity": round(self.lexical_diversity, 3),
            "repeated_bigram_ratio": round(self.repeated_bigram_ratio, 3),
            "passive_voice_ratio": round(self.passive_voice_ratio, 2),
            "transition_density": round(self.transition_density, 3),
            "ai_phrase_density": round(self.ai_phrase_density, 3),
            "repeated_starter_ratio": round(self.repeated_starter_ratio, 3),
            "ai_likelihood": round(self.ai_likelihood, 3),
            "ai_phrase_hits": self.ai_phrase_hits,
            "repetitive_starters": self.repetitive_starters,
        }


# Weights for the composite AI-likelihood score (sum to 1.0).
_AI_WEIGHTS = {
    "uniformity": 0.28,        # flat sentence rhythm
    "ai_phrases": 0.24,        # buzzword density
    "transitions": 0.14,       # furthermore/moreover overuse
    "passive": 0.12,           # passive voice
    "low_diversity": 0.12,     # predictable vocabulary
    "repeated_starters": 0.10, # every sentence opens the same way
}


def compute_metrics(text: str) -> TextMetrics:
    """Compute the full metric fingerprint, including the composite AI-likelihood."""
    m = TextMetrics()
    sents = split_sentences(text)
    m.sentence_count = len(sents)
    if not sents:
        return m

    lengths = [word_count(s) for s in sents]
    m.avg_sentence_length = statistics.mean(lengths)
    m.sentence_length_std = statistics.stdev(lengths) if len(lengths) > 1 else 0.0
    m.burstiness = burstiness(text)
    m.lexical_diversity = lexical_diversity(text)
    m.repeated_bigram_ratio = repeated_bigram_ratio(text)
    m.passive_voice_ratio = sum(1 for s in sents if _PASSIVE.search(s)) / len(sents)

    lower = text.lower()
    m.transition_density = sum(lower.count(t) for t in _TRANSITIONS) / len(sents)

    m.ai_phrase_hits = _ai_phrase_hits(text)
    m.ai_phrase_density = sum(m.ai_phrase_hits.values()) / len(sents)

    starters: dict[str, int] = {}
    for s in sents:
        mt = re.match(r"^(\w+)", s)
        if mt:
            w = mt.group(1).lower()
            starters[w] = starters.get(w, 0) + 1
    m.repetitive_starters = sorted(
        ((w, c) for w, c in starters.items() if c >= 3), key=lambda x: -x[1]
    )[:5]
    m.repeated_starter_ratio = (
        max((c for _, c in m.repetitive_starters), default=0) / len(sents)
    )

    # Composite: each signal normalized to 0..1, then weighted.
    signals = {
        "uniformity": _uniformity_from_burstiness(m.burstiness),
        "ai_phrases": _clamp(m.ai_phrase_density / 0.6),
        "transitions": _clamp(m.transition_density / 0.6),
        "passive": _clamp(m.passive_voice_ratio / 0.5),
        "low_diversity": _clamp((0.85 - m.lexical_diversity) / 0.45),
        "repeated_starters": _clamp(m.repeated_starter_ratio / 0.5),
    }
    m.ai_likelihood = _clamp(sum(_AI_WEIGHTS[k] * v for k, v in signals.items()))
    return m
