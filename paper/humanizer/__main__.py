#!/usr/bin/env python3
"""CLI for the SmArchitect paper humanizer."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .coherence import analyze_coherence
from .core import humanize_text, llm_available
from .latex import extract_prose
from .llm import LLMConfig
from .numbers import humanize_available, library_version


def _report(result, *, verbose: bool) -> None:
    print(f"\nRegister: {result.register}")

    if result.replacements:
        print(f"\nDictionary replacements ({len(result.replacements)}):")
        seen: set[tuple[str, str]] = set()
        for phrase, repl, orig in result.replacements:
            key = (phrase, repl)
            if key in seen:
                continue
            seen.add(key)
            print(f"  {phrase!r} -> {repl!r}  (was: {orig!r})")
    else:
        print("\nNo dictionary replacements applied.")

    if result.contractions_applied:
        print(f"\nContractions applied: {result.contractions_applied}")
    if result.number_changes:
        print(f"\nNumbers reformatted ({len(result.number_changes)}):")
        for raw, grouped in result.number_changes:
            print(f"  {raw} -> {grouped}")
    for note in result.notes:
        print(f"\nNote: {note}")

    mb, ma = result.metrics_before, result.metrics_after
    if mb and ma:
        print("\nMetrics (before -> after):")
        print(f"  AI-likelihood : {mb.ai_likelihood:.0%} -> {ma.ai_likelihood:.0%}")
        print(f"  Burstiness    : {mb.burstiness:.2f} -> {ma.burstiness:.2f}  (higher = more human)")
        print(f"  Lexical div.  : {mb.lexical_diversity:.2f} -> {ma.lexical_diversity:.2f}")
        print(f"  Passive ratio : {mb.passive_voice_ratio:.0%} -> {ma.passive_voice_ratio:.0%}")

    if result.coherence_before:
        print("\nCoherence (before):")
        for s in result.coherence_before.suggestions:
            print(f"  - {s}")
    if result.coherence_after and verbose:
        print("\nCoherence (after):")
        for s in result.coherence_after.suggestions:
            print(f"  - {s}")

    if result.llm:
        llm = result.llm
        print(f"\nLLM pass: {llm.provider} / {llm.model}  ({llm.api_calls} API calls, "
              f"{llm.iterations} rhythm passes)")
        for n in llm.notes:
            print(f"  - {n}")
    elif result.llm_skipped_reason:
        print(f"\nLLM skipped: {result.llm_skipped_reason}")


def _force_utf8() -> None:
    """Emit UTF-8 so report glyphs (×, …) survive a legacy Windows code page."""
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
        except (AttributeError, ValueError):
            pass


def main(argv: list[str] | None = None) -> int:
    _force_utf8()
    ap = argparse.ArgumentParser(
        description="Humanize prose in LaTeX (dictionary + contractions + numbers + optional LLM).",
    )
    ap.add_argument("--input", "-i", type=Path, help="Input .tex or .txt file")
    ap.add_argument("--output", "-o", type=Path, help="Output file (default: stdout)")
    ap.add_argument("--text", "-t", help="Inline text to humanize")
    ap.add_argument(
        "--register", choices=["academic", "casual"], default="academic",
        help="Tone: academic (conservative, default) or casual (full toolkit)",
    )
    ap.add_argument("--contractions", dest="contractions", action="store_true", default=None,
                    help="Force the contractions pass on (default: on for casual)")
    ap.add_argument("--no-contractions", dest="contractions", action="store_false",
                    help="Force the contractions pass off")
    ap.add_argument("--numbers", action="store_true",
                    help="Reformat large numbers via the `humanize` library")
    ap.add_argument("--llm", action="store_true", help="Run the LLM rewrite pass")
    ap.add_argument("--llm-only", action="store_true", help="LLM only, skip deterministic passes")
    ap.add_argument("--provider", choices=["openai", "anthropic", "ollama"],
                    help="Force an LLM provider (default: auto-detect from env)")
    ap.add_argument("--model", help="Override the LLM model id")
    ap.add_argument("--no-per-paragraph", dest="per_paragraph", action="store_false",
                    default=True, help="Rewrite the whole blob in one call (default: per paragraph)")
    ap.add_argument("--max-iterations", type=int, default=2,
                    help="Max burstiness-refinement passes (default: 2)")
    ap.add_argument("--target-burstiness", type=float, default=0.55,
                    help="Stop refining once burstiness reaches this (default: 0.55)")
    ap.add_argument("--temperature", type=float, default=0.7, help="LLM temperature (default: 0.7)")
    ap.add_argument("--analyze", action="store_true", help="Coherence/metrics analysis only")
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
        report = analyze_coherence(extract_prose(text))
        out = json.dumps(report.to_dict(), indent=2)
        print(out, file=sys.stderr if args.json else sys.stdout)
        return 0

    if args.llm and not llm_available(args.provider):
        print("Warning: --llm requested but no API key / Ollama configured.", file=sys.stderr)
    if args.numbers and not humanize_available():
        print("Warning: --numbers requested but `humanize` library not installed "
              "(pip install humanize).", file=sys.stderr)

    llm_config = LLMConfig(
        register=args.register,
        per_paragraph=args.per_paragraph,
        max_iterations=args.max_iterations,
        target_burstiness=args.target_burstiness,
        temperature=args.temperature,
        provider=args.provider,
        model=args.model,
    )

    result = humanize_text(
        text,
        register=args.register,
        use_contractions=args.contractions,
        use_numbers=args.numbers,
        use_llm=args.llm,
        llm_only=args.llm_only,
        llm_config=llm_config,
    )

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(result.text, encoding="utf-8")
        print(f"Wrote {args.output}", file=sys.stderr)
    else:
        print(result.text)

    if args.json:
        payload = {
            "register": result.register,
            "replacements": [
                {"phrase": p, "replacement": r, "original": o}
                for p, r, o in result.replacements
            ],
            "contractions_applied": result.contractions_applied,
            "number_changes": [{"from": a, "to": b} for a, b in result.number_changes],
            "metrics_before": result.metrics_before.to_dict() if result.metrics_before else None,
            "metrics_after": result.metrics_after.to_dict() if result.metrics_after else None,
            "llm": (
                {
                    "provider": result.llm.provider,
                    "model": result.llm.model,
                    "api_calls": result.llm.api_calls,
                    "iterations": result.llm.iterations,
                    "burstiness_before": round(result.llm.burstiness_before, 3),
                    "burstiness_after": round(result.llm.burstiness_after, 3),
                    "notes": result.llm.notes,
                }
                if result.llm
                else None
            ),
            "llm_skipped_reason": result.llm_skipped_reason,
            "notes": result.notes,
            "humanize_library": library_version(),
        }
        print(json.dumps(payload, indent=2), file=sys.stderr)
    elif args.report or args.verbose:
        _report(result, verbose=args.verbose)

    return 0


if __name__ == "__main__":
    sys.exit(main())
