#!/usr/bin/env python3
"""Entry point for the paper humanizer.

    python humanize_paper.py --input main.tex --output build/main-humanized.tex --report

Equivalent to ``python -m humanizer``. Named ``humanize_paper`` (not ``humanize``) so it
never shadows the PyPI ``humanize`` library that the number-formatting pass relies on.
"""
from humanizer.__main__ import main

if __name__ == "__main__":
    raise SystemExit(main())
