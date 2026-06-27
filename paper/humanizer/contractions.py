"""Contractions pass — the fastest way to drop the stiffness out of AI prose.

"You will need to" -> "You'll need to". Small change, big drop in rob0t-ness.

This is deliberately conservative: every entry is grammatically unambiguous, and a
couple of genuinely ambiguous expansions ("that is" as an appositive, "it has" vs
"it is") are left out on purpose. Case is preserved and matching is word-boundary
safe. Contractions belong to the *casual* register — academic prose (IEEE journals)
conventionally avoids them, so the orchestrator only runs this when asked.
"""

from __future__ import annotations

import re

__all__ = ["apply_contractions", "CONTRACTIONS"]

# Unambiguous expansions only. Order doesn't matter (each is matched independently),
# but multi-word keys are compiled with internal-whitespace tolerance.
CONTRACTIONS: dict[str, str] = {
    # pronoun + auxiliary
    "i am": "I'm",
    "i will": "I'll",
    "i have": "I've",
    "i would": "I'd",
    "you are": "you're",
    "you will": "you'll",
    "you have": "you've",
    "you would": "you'd",
    "we are": "we're",
    "we will": "we'll",
    "we have": "we've",
    "we would": "we'd",
    "they are": "they're",
    "they will": "they'll",
    "they have": "they've",
    "they would": "they'd",
    "it is": "it's",
    "it will": "it'll",
    "he is": "he's",
    "she is": "she's",
    "who is": "who's",
    "what is": "what's",
    "here is": "here's",
    "there is": "there's",
    "let us": "let's",
    # negations
    "do not": "don't",
    "does not": "doesn't",
    "did not": "didn't",
    "is not": "isn't",
    "are not": "aren't",
    "was not": "wasn't",
    "were not": "weren't",
    "have not": "haven't",
    "has not": "hasn't",
    "had not": "hadn't",
    "will not": "won't",
    "would not": "wouldn't",
    "should not": "shouldn't",
    "could not": "couldn't",
    "cannot": "can't",
    "can not": "can't",
    "must not": "mustn't",
    "does nt": "doesn't",  # tolerate stray-space artifacts from upstream edits
}

# "that's"/"that is" is intentionally excluded: ", that is," is an appositive and
# must not contract. So is "it has" (collides with "it is" -> "it's").


def _preserve_case(original: str, replacement: str) -> str:
    if original[:1].isupper():
        return replacement[0].upper() + replacement[1:]
    return replacement


def _compile(phrase: str) -> re.Pattern[str]:
    # Allow flexible internal whitespace; require word boundaries on the ends.
    inner = r"\s+".join(re.escape(p) for p in phrase.split())
    return re.compile(rf"\b{inner}\b", re.IGNORECASE)


_COMPILED: list[tuple[re.Pattern[str], str]] = sorted(
    ((_compile(k), v) for k, v in CONTRACTIONS.items()),
    key=lambda kv: -len(kv[0].pattern),  # longer phrases first
)


def apply_contractions(text: str) -> tuple[str, int]:
    """Contract expanded forms in *text*. Returns (new_text, count_applied)."""
    count = 0

    for pat, replacement in _COMPILED:
        def sub(m: re.Match[str], _rep=replacement) -> str:
            nonlocal count
            count += 1
            return _preserve_case(m.group(0), _rep)

        text = pat.sub(sub, text)
    return text, count
