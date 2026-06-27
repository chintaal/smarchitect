# SmArchitect paper — one source, any format

A single LaTeX source (`main.tex`, IEEE journal class) is the ground truth for the
paper. Compile it to a PDF on **Overleaf** as-is, or run the Python build tool to
render **any format** (PDF, HTML, DOCX, ODT, Markdown, EPUB, RTF, JATS).

```
paper/
├── main.tex         the paper (IEEEtran, self-contained — no external figure files)
├── references.bib   seed bibliography (entries marked VERIFY before camera-ready)
├── build.py         single-source → any-format converter
├── metadata.yaml    pandoc citation settings
├── Makefile         `make pdf` / `make html` / ...
└── build/           output (gitignored)
```

## Overleaf (zero setup)
Upload `main.tex` + `references.bib`, set the compiler to **pdfLaTeX**, and
compile. The document needs only standard TeX Live packages (IEEEtran, amsmath,
amsthm, booktabs, algorithmicx, hyperref) and ships **no image files** — every
figure is a self-contained framed placeholder until the experiment scripts emit
real artifacts.

## Local / CI — any format
```bash
python build.py --list          # what toolchains do I have?
python build.py pdf             # PDF  (tectonic → latexmk → pdflatex, whichever exists)
python build.py html docx md    # via pandoc
python build.py all             # pdf + html + docx + md + tex
python build.py clean
```

### Tools (install what you need)
| Output | Needs | Install |
|---|---|---|
| PDF | `tectonic` *(recommended)*, or `latexmk`/`pdflatex`+`bibtex` | https://tectonic-typesetting.github.io · TeX Live · MiKTeX |
| HTML/DOCX/MD/… | `pandoc` | https://pandoc.org/installing.html |

`build.py` detects whatever is present and tells you what's missing — nothing is
required to be installed for the source to be valid.

## How conversion works
- **PDF** is produced by a real LaTeX engine, so IEEEtran is honored exactly.
- **Every other format** goes through pandoc. Because pandoc only partially models
  IEEEtran and the custom draft macros (`\result`, `\todo`, `\figplaceholder`,
  `\IEEEPARstart`, `IEEEkeywords`), `build.py` first runs a small, auditable
  preprocessor (`preprocess_for_pandoc`) that rewrites them into portable LaTeX in
  `build/_pandoc.tex`. **`main.tex` is never modified.**

## Draft markers
- `\result{...}` — an experimental number to be filled from `results/`; renders as
  **[R: …]** in draft mode. No numbers are fabricated.
- `\todo{...}` — author note (hidden in non-PDF output).
- Set `\draftfalse` in the preamble for a clean camera-ready (hides `[R:…]`/TODOs).

## Filling in results
Numbers come from the platform's experiment harness (see the paper plan,
`~/.claude/plans/...`): `experiments/run.py` → `results/*.csv` →
`experiments/plots.py` regenerates the figures/tables. Replace each `\result{…}`
with the corresponding value; no figure should exist without a generating script.

## Humanizer (optional)
De-AI prose in `main.tex` without touching LaTeX commands, math, or citations. The
pipeline runs in stages — each is independent and LaTeX-safe:

1. **Dictionary** — swaps ~200 AI buzzwords/phrases for plain alternatives (delve→examine,
   leverage→use, "it is important to note"→"note").
2. **Contractions** — *casual register only* (you'll, it's, don't). Off for academic prose.
3. **Numbers** — *opt-in* via the [`humanize`](https://pypi.org/project/humanize/) library:
   `1234567` → `1,234,567`.
4. **LLM rewrite** — *opt-in*. A register-aware prompt rewrites paragraph-by-paragraph
   (separate API calls), then a **burstiness feedback loop** measures sentence-length
   variance and re-rewrites until the rhythm reads human.

It also scores the prose: a composite **AI-likelihood** (0 = human … 1 = AI) built from
burstiness, lexical diversity, passive-voice ratio, transition density, and buzzword count.

```bash
cd paper
python -m humanizer --input main.tex --output build/main-humanized.tex --report
python -m humanizer --input main.tex --analyze            # metrics/coherence only
python -m humanizer --input main.tex --numbers --report   # + thousands separators
python -m humanizer --input main.tex --llm --report       # + LLM rewrite loop
python -m humanizer --text "It is worth noting..." --register casual --llm
# shortcut: python humanize_paper.py ...   (same flags)
```

Install the optional deps with `pip install -r humanizer/requirements.txt` (only
`humanize`, needed for `--numbers`). For the `--llm` pass set `OPENAI_API_KEY`,
`ANTHROPIC_API_KEY`, or `HUMANIZER_USE_OLLAMA=1` — no SDK required (plain HTTP). Useful
flags: `--register {academic,casual}`, `--provider`, `--model`, `--target-burstiness`,
`--max-iterations`, `--no-per-paragraph`. Output goes to `build/`; **`main.tex` is never
modified.**
