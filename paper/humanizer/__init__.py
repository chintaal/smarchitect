"""SmArchitect paper humanizer — de-AI academic prose with LaTeX safety."""

from .core import (
    AI_WORD_REPLACEMENTS,
    HumanizeResult,
    humanize_text,
    llm_available,
    replace_ai_words,
)
from .coherence import CoherenceReport, analyze_coherence

__all__ = [
    "AI_WORD_REPLACEMENTS",
    "CoherenceReport",
    "HumanizeResult",
    "analyze_coherence",
    "humanize_text",
    "llm_available",
    "replace_ai_words",
]
