#!/usr/bin/env python3
"""Offline tests for the humanizer (no API keys, no network).

Run directly (``python test_humanizer.py``) or under pytest. Only the deterministic
passes are exercised — the LLM loop is integration-tested by hand with credentials.
"""

from __future__ import annotations

import sys

from humanizer import (
    analyze_coherence,
    apply_contractions,
    burstiness,
    compute_metrics,
    format_numbers,
    humanize_text,
    replace_ai_words,
)
from humanizer.latex import extract_prose


# --- dictionary replacement -------------------------------------------------

def test_replaces_ai_buzzwords():
    out, log = replace_ai_words("We leverage a robust framework to delve into the realm.")
    assert "leverage" not in out.lower()
    assert "delve" not in out.lower()
    assert "robust" not in out.lower()
    assert log, "expected a replacement log"


def test_preserves_case_at_sentence_start():
    out, _ = replace_ai_words("Furthermore, results hold.")
    assert out.startswith("Also") or out.startswith("And"), out


def test_does_not_touch_latex_commands_or_math():
    src = r"We \cite{smith2020} leverage $\alpha = \beta$ and \textbf{delve} markup."
    out, _ = replace_ai_words(src)
    assert r"\cite{smith2020}" in out
    assert r"$\alpha = \beta$" in out
    # delve inside \textbf{...} is a LaTeX arg and must be protected
    assert r"\textbf{delve}" in out


# --- contractions -----------------------------------------------------------

def test_contractions_basic():
    out, n = apply_contractions("You will see that it is here and we do not stop.")
    assert "you'll" in out.lower()
    assert "it's" in out.lower()
    assert "don't" in out.lower()
    assert n >= 3


def test_contractions_preserve_leading_capital():
    out, _ = apply_contractions("It is fine. We will go.")
    assert out.startswith("It's")
    assert "We'll" in out


def test_contractions_skip_ambiguous_that_is():
    # "that is" is intentionally not contracted (appositive risk).
    out, _ = apply_contractions("The result, that is, the planner, holds.")
    assert "that is" in out


# --- numbers (humanize library; graceful when absent) -----------------------

def test_format_numbers_graceful_or_grouped():
    out, changes = format_numbers("We processed 1234567 records.")
    from humanizer.numbers import humanize_available
    if humanize_available():
        assert "1,234,567" in out
        assert changes == [("1234567", "1,234,567")]
    else:
        assert out == "We processed 1234567 records."
        assert changes == []


def test_format_numbers_leaves_small_and_years():
    out, _ = format_numbers("In 2024 we ran 42 trials.")
    assert "2024" in out and "42" in out  # untouched regardless of library


# --- metrics ----------------------------------------------------------------

def test_burstiness_uniform_vs_varied():
    uniform = " ".join(["The cat sat on the mat today."] * 6)
    varied = ("Stop. The system, which spans three planes and many services, "
              "coordinates them. It works. Then everything changed overnight "
              "in ways nobody on the team had predicted or planned for. Fast.")
    assert burstiness(varied) > burstiness(uniform)


def test_ai_likelihood_drops_after_humanizing():
    ai = ("Furthermore, it is important to note that we leverage a robust and "
          "comprehensive framework. Moreover, we leverage a robust and comprehensive "
          "methodology. Additionally, we leverage a robust and comprehensive approach.")
    before = compute_metrics(ai).ai_likelihood
    out = humanize_text(ai, register="academic").text
    after = compute_metrics(extract_prose(out)).ai_likelihood
    assert after < before, (before, after)


# --- end-to-end pipeline ----------------------------------------------------

def test_humanize_text_academic_no_contractions_by_default():
    res = humanize_text("You will not delve into it.", register="academic")
    assert res.contractions_applied == 0
    assert "delve" not in res.text.lower()


def test_humanize_text_casual_enables_contractions():
    res = humanize_text("You will not delve into it.", register="casual")
    assert res.contractions_applied >= 1
    assert "won't" in res.text.lower() or "you'll" in res.text.lower()


def test_humanize_text_reports_metrics():
    res = humanize_text("Furthermore, we leverage robust methods. Moreover, we utilize them.")
    assert res.metrics_before is not None and res.metrics_after is not None


def test_invalid_register_raises():
    try:
        humanize_text("x", register="bogus")
    except ValueError:
        return
    raise AssertionError("expected ValueError for bad register")


def test_analyze_coherence_smoke():
    rep = analyze_coherence("We leverage robust frameworks. We leverage robust systems.")
    d = rep.to_dict()
    assert "ai_likelihood" in d and "burstiness" in d


# --- runner -----------------------------------------------------------------

def _run() -> int:
    tests = sorted(
        (name, obj)
        for name, obj in globals().items()
        if name.startswith("test_") and callable(obj)
    )
    failures = 0
    for name, fn in tests:
        try:
            fn()
            print(f"  PASS  {name}")
        except Exception as exc:  # noqa: BLE001
            failures += 1
            print(f"  FAIL  {name}: {type(exc).__name__}: {exc}")
    print(f"\n{len(tests) - failures}/{len(tests)} passed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(_run())
