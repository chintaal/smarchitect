#!/usr/bin/env python3
"""CLI for the SmArchitect paper humanizer."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .core import humanize_text, llm_available, replace_ai_words
from .coherence import analyze_coherence
from .latex import extract_prose


def _report(result, *, verbose: bool) -> None:
    if result.replacements:
        print(f"\nDictionary replacements ({len(result.replacements)}):")
        seen: set[str] = set()
        for phrase, repl, orig in result.replacements:
            key = (phrase, repl)
            if key in seen:
                continue
            seen.add(key)
            print(f"  {phrase!r} -> {repl!r}  (was: {orig!r})")
    else:
        print("\nNo dictionary replacements applied.")

    if result.coherence_before:
        print("\nCoherence (before):")
        for s in result.coherence_before.suggestions:
            print(f"  - {s}")

    if result.coherence_after and verbose:
        print("\nCoherence (after):")
        for s in result.coherence_after.suggestions:
            print(f"  - {s}")

    if result.llm:
        print(f"\nLLM pass: {result.llm.provider} / {result.llm.model}")
    elif result.llm_skipped_reason:
        print(f"\nLLM skipped: {result.llm_skipped_reason}")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description="Humanize academic prose in LaTeX (dictionary + optional LLM)."
    )
    ap.add_argument("--input", "-i", type=Path, help="Input .tex or .txt file")
    ap.add_argument("--output", "-o", type=Path, help="Output file (default: stdout)")
    ap.add_argument("--text", "-t", help="Inline text to humanize")
    ap.add_argument("--llm", action="store_true", help="Run optional LLM pass")
    ap.add_argument("--llm-only", action="store_true", help="LLM only, skip dictionary")
    ap.add_argument("--analyze", action="store_true", help="Coherence analysis only")
    ap.add_argument("--report", action="store_true", help="Print change report to stderr")
    ap.add_argument("--json", action="store_true", help="Emit JSON report to stderr")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args(argv)

    if args.input:
        text = args.input.read_text(encoding="utf-8")
    elif args.text:
        text = args.text
    else:
        ap.error("Provide --input or --text")

    if args.analyze:
        prose = extract_prose(text)
        report = analyze_coherence(prose)
        if args.json:
            print(json.dumps(report.to_dict(), indent=2), file=sys.stderr)
        else:
            print(json.dumps(report.to_dict(), indent=2))
        return 0

    if args.llm and not llm_available():
        print("Warning: --llm requested but no API key / Ollama configured.", file=sys.stderr)

    result = humanize_text(text, use_llm=args.llm, llm_only=args.llm_only)

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(result.text, encoding="utf-8")
        print(f"Wrote {args.output}", file=sys.stderr)
    else:
        print(result.text)

    if args.json:
        payload = {
            "replacements": [{"phrase": p, "replacement": r, "original": o} for p, r, o in result.replacements],
            "coherence_before": result.coherence_before.to_dict() if result.coherence_before else None,
            "coherence_after": result.coherence_after.to_dict() if result.coherence_after else None,
            "llm": {"provider": result.llm.provider, "model": result.llm.model} if result.llm else None,
            "llm_skipped_reason": result.llm_skipped_reason,
        }
        print(json.dumps(payload, indent=2), file=sys.stderr)
    elif args.report or args.verbose:
        _report(result, verbose=args.verbose)

    return 0


if __name__ == "__main__":
    sys.exit(main())
