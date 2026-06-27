"""LaTeX-aware text segmentation — only prose is humanized."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Callable

# Match \command, \command{...}, \command[opt]{...}, with nested braces one level.
_CMD = r"\\[a-zA-Z@]+(?:\*)?(?:\[[^\]]*\])?(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})*"
# Inline / display math
_MATH = r"\$\$[^$]+\$\$|\$[^$\n]+\$"
# Verbatim-like environments
_VERBATIM = r"\\begin\{(?:verbatim|lstlisting|minted|Verbatim)\}.*?\\end\{(?:verbatim|lstlisting|minted|Verbatim)\}"


@dataclass
class Segment:
    kind: str  # "prose" | "latex"
    text: str


def _compile_patterns() -> re.Pattern[str]:
    parts = [_VERBATIM, _MATH, _CMD]
    return re.compile("|".join(f"(?:{p})" for p in parts), re.DOTALL)


_SKIP_RE = _compile_patterns()


def split_latex(text: str) -> list[Segment]:
    """Split *text* into prose and protected LaTeX segments."""
    segments: list[Segment] = []
    last = 0
    for m in _SKIP_RE.finditer(text):
        if m.start() > last:
            segments.append(Segment("prose", text[last : m.start()]))
        segments.append(Segment("latex", m.group(0)))
        last = m.end()
    if last < len(text):
        segments.append(Segment("prose", text[last:]))
    return segments if segments else [Segment("prose", text)]


def map_prose(text: str, fn: Callable[[str], str]) -> str:
    """Apply *fn* only to prose segments; leave LaTeX constructs untouched."""
    out: list[str] = []
    for seg in split_latex(text):
        out.append(fn(seg.text) if seg.kind == "prose" else seg.text)
    return "".join(out)


def extract_prose(text: str) -> str:
    """Concatenate prose segments (for analysis / LLM input)."""
    return "\n".join(seg.text.strip() for seg in split_latex(text) if seg.kind == "prose" and seg.text.strip())
