"""Make raw numbers read the way a person would write them.

This is "the data way" of humanizing: the PyPI `humanize` library turns machine
output like ``1234567`` into ``1,234,567`` and ``1048576`` bytes into ``1.0 MB``.
For an academic paper the safe, meaning-preserving win is thousands separators on
bare integers, so that's the default; file sizes and word-forms are opt-in.

The pass is prose-only (the orchestrator never feeds it LaTeX or math) and degrades
to a no-op when the library isn't installed (`pip install humanize`).
"""

from __future__ import annotations

import re

__all__ = ["humanize_available", "format_numbers", "library_version"]


def _import_humanize_library():
    """Import the PyPI `humanize` package, even if a local ``humanize.py`` shim is on
    the path (running from the paper dir used to shadow the real library)."""
    import importlib
    import os
    import sys

    cached = sys.modules.get("humanize")
    if cached is not None and hasattr(cached, "intcomma"):
        return cached

    saved_mod = sys.modules.pop("humanize", None)
    saved_path = list(sys.path)
    try:
        shim_dirs = {
            os.path.abspath(p or os.getcwd())
            for p in ("", ".", os.getcwd())
            if os.path.exists(os.path.join(os.path.abspath(p or os.getcwd()), "humanize.py"))
        }
        sys.path[:] = [p for p in sys.path if os.path.abspath(p or os.getcwd()) not in shim_dirs]
        sys.modules.pop("humanize", None)
        mod = importlib.import_module("humanize")
        return mod if hasattr(mod, "intcomma") else None
    except Exception:
        return None
    finally:
        sys.path[:] = saved_path
        if saved_mod is not None:
            sys.modules["humanize"] = saved_mod


_LIB = _import_humanize_library()


def humanize_available() -> bool:
    return _LIB is not None


def library_version() -> str | None:
    if _LIB is None:
        return None
    return getattr(_LIB, "__version__", "unknown")


# A bare run of digits, not glued to a letter/decimal/percent and not already grouped.
# Guards against touching identifiers (RFC2119), versions (3.14), or fractions.
_BARE_INT = re.compile(r"(?<![\w.,])(\d{5,})(?![\w.,%])")
# 4-digit values are usually years/ports/IDs — never group those even if matched.


def format_numbers(text: str, *, min_digits: int = 5) -> tuple[str, list[tuple[str, str]]]:
    """Insert thousands separators into large bare integers via ``humanize.intcomma``.

    Returns ``(new_text, changes)`` where each change is ``(original, formatted)``.
    No-op (and empty change list) when the library is unavailable.
    """
    if _LIB is None:
        return text, []

    changes: list[tuple[str, str]] = []

    def sub(m: re.Match[str]) -> str:
        raw = m.group(1)
        if len(raw) < min_digits:
            return raw
        grouped = _LIB.intcomma(int(raw))
        if grouped != raw:
            changes.append((raw, grouped))
        return grouped

    return _BARE_INT.sub(sub, text), changes
