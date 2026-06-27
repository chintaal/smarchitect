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
