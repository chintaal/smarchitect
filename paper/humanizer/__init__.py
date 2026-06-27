"""SmArchitect paper humanizer — de-AI academic prose with LaTeX safety.

Pipeline: dictionary replacement → (optional) contractions → (optional) number
formatting via the `humanize` library → (optional) register-aware LLM rewrite with a
burstiness feedback loop. Everything except the LLM pass runs fully offline.
"""

from .core import (
    AI_WORD_REPLACEMENTS,
    HumanizeResult,
    humanize_text,
    llm_available,
    replace_ai_words,
)
from .coherence import CoherenceReport, analyze_coherence
from .contractions import apply_contractions
from .llm import LLMConfig, LLMResult, REGISTERS
from .metrics import TextMetrics, burstiness, compute_metrics
from .numbers import format_numbers, humanize_available

__all__ = [
    "AI_WORD_REPLACEMENTS",
    "CoherenceReport",
    "HumanizeResult",
    "LLMConfig",
    "LLMResult",
    "REGISTERS",
    "TextMetrics",
    "analyze_coherence",
    "apply_contractions",
    "burstiness",
    "compute_metrics",
    "format_numbers",
    "humanize_available",
    "humanize_text",
    "llm_available",
    "replace_ai_words",
]
