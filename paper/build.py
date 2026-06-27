#!/usr/bin/env python3
"""
SmArchitect paper — single source, any format.

One LaTeX source (`main.tex`) is the ground truth. This script renders it to
whatever you need:

    python build.py pdf            # IEEE journal PDF (tectonic/latexmk/pdflatex)
    python build.py compsoc        # IEEE Computer Society journal PDF
    python build.py springer       # Springer Nature PDF (sn-jnl)
    python build.py html docx md   # via pandoc
    python build.py all            # pdf + html + docx + md + tex
    python build.py --list         # show which toolchains are available
    python build.py clean          # remove build/

PDF uses a real LaTeX engine (so venue classes are honored exactly). Every other
format goes through pandoc; because pandoc only partially understands IEEEtran
and our custom draft macros, we first run a small, transparent preprocessor that
rewrites those macros into portable LaTeX. `main.tex` itself is never modified.
"""
from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent
MAIN = ROOT / "main.tex"
BIB = ROOT / "references.bib"
META = ROOT / "metadata.yaml"
BUILD = ROOT / "build"
FIGURES = ROOT / "figures"
SN_TEMPLATE = REPO / "sn-article-template"

PANDOC_FORMATS = {
    "html": {"ext": "html", "args": ["--mathjax", "--toc", "--standalone", "--embed-resources"]},
    "docx": {"ext": "docx", "args": ["--standalone"]},
    "odt": {"ext": "odt", "args": ["--standalone"]},
    "md": {"ext": "md", "args": ["--to", "gfm", "--standalone"]},
    "markdown": {"ext": "md", "args": ["--to", "gfm", "--standalone"]},
    "epub": {"ext": "epub", "args": ["--mathml"]},
    "rtf": {"ext": "rtf", "args": ["--standalone"]},
    "latex": {"ext": "tex", "args": ["--standalone"]},  # normalized/portable LaTeX
    "jats": {"ext": "xml", "args": ["--standalone"]},
}

# LaTeX PDF variants derived from main.tex (main.tex is never modified).
LATEX_VARIANTS = {
    "pdf": {
        "label": "IEEE journal (IEEEtran)",
        "jobname": "paper",
        "source_name": "main.tex",
        "preprocess": None,  # compile main.tex in place
        "stage_assets": None,
    },
    "compsoc": {
        "label": "IEEE Computer Society (IEEEtran compsoc)",
        "jobname": "paper-compsoc",
        "source_name": "paper-compsoc.tex",
        "preprocess": "compsoc",
        "stage_assets": None,
    },
    "springer": {
        "label": "Springer Nature (sn-jnl)",
        "jobname": "paper-springer",
        "source_name": "paper-springer.tex",
        "preprocess": "springer",
        "stage_assets": "springer",
    },
}

ALIASES = {
    "tex": "latex",
    "word": "docx",
    "web": "html",
    "ieee": "pdf",
    "ieee-journal": "pdf",
    "ieee-compsoc": "compsoc",
    "ieee-cs": "compsoc",
    "springer-nature": "springer",
    "sn": "springer",
}


def which(*names: str) -> str | None:
    for n in names:
        p = shutil.which(n)
        if p:
            return p
    return None


def run(cmd: list[str], cwd: Path) -> int:
    print("  $", " ".join(cmd))
    return subprocess.run(cmd, cwd=str(cwd)).returncode


def read_main() -> str:
    return MAIN.read_text(encoding="utf-8")


# --------------------------------------------------------------------------- #
#  LaTeX variant preprocessors (main.tex is never modified)                   #
# --------------------------------------------------------------------------- #
def fix_algorithm_math(tex: str) -> str:
    """algpseudocode requires braced superscripts (\\G^\\* -> \\G^{*})."""
    return tex.replace(r"\G^\*", r"\G^{*}")


def preprocess_for_compsoc(tex: str) -> str:
    """IEEE Computer Society journal: IEEEtran with compsoc option."""
    tex = tex.replace(
        r"\documentclass[journal]{IEEEtran}",
        r"\documentclass[10pt,journal,compsoc]{IEEEtran}",
    )
    return fix_algorithm_math(tex)


def preprocess_for_springer(tex: str) -> str:
    """Springer Nature: sn-jnl class + front-matter mapping."""
    tex = tex.replace(
        r"\documentclass[journal]{IEEEtran}",
        r"\documentclass[pdflatex,sn-mathphys-num]{sn-jnl}" + "\n"
        r"\usepackage{manyfoot}" + "\n"
        r"\DeclareNewFootnote{A}[gobble]",
    )

    # sn-jnl loads amsthm and hyperref; booktabs/algorithm stay in main.tex.
    for pkg in (
        r"\usepackage{amsthm}",
        r"\usepackage[hidelinks]{hyperref}",
    ):
        tex = tex.replace(pkg, f"% {pkg}  % provided by sn-jnl")

    sn_theorems = (
        "% ----- theorem environments (sn-jnl styles) ---------------------\n"
        "\\theoremstyle{thmstyleone}\n"
        "\\newtheorem{theorem}{Theorem}\n"
        "\\newtheorem{proposition}[theorem]{Proposition}\n"
        "\\theoremstyle{thmstylethree}\n"
        "\\newtheorem{definition}{Definition}"
    )
    tex = re.sub(
        r"% ----- theorem environments.*?"
        r"\\newtheorem\{definition\}\{Definition\}",
        lambda _m: sn_theorems,
        tex,
        flags=re.DOTALL,
    )

    # IEEE front matter -> Springer front matter.
    springer_front = (
        r"\author*[1]{\fnm{First} \sur{Author}}"
        r"\author[1]{\fnm{Second} \sur{Author}}"
        r"\author[1]{\fnm{Third} \sur{Author}}"
        r"\affil*[1]{\orgname{Affiliation omitted for review}}"
        r"\artnote{Artifact (SmArchitect) available to reviewers.}"
        r"\maketitle"
    )
    tex = re.sub(
        r"\\author\{First~Author,~Second~Author,~and~Third~Author%\s*"
        r"\\thanks\{.*?\}\}\s*"
        r"\\markboth\{.*?\}\{.*?\}\s*"
        r"\\maketitle",
        lambda _m: springer_front,
        tex,
        flags=re.DOTALL,
    )

    tex = re.sub(
        r"\\begin\{IEEEkeywords\}(.*?)\\end\{IEEEkeywords\}",
        r"\\keywords{\1}",
        tex,
        flags=re.DOTALL,
    )
    tex = re.sub(r"\\IEEEPARstart\{(.)\}\{([^{}]*)\}", r"\1\2", tex)
    tex = re.sub(r"\\bibliographystyle\{IEEEtran\}\s*\n", "", tex)
    if r"\raggedbottom" not in tex:
        tex = tex.replace(r"\begin{document}", r"\raggedbottom" + "\n" + r"\begin{document}")
    return fix_algorithm_math(tex)


def preprocess_variant(name: str, tex: str) -> str:
    if name == "compsoc":
        return preprocess_for_compsoc(tex)
    if name == "springer":
        return preprocess_for_springer(tex)
    return tex


def stage_figures() -> None:
    """Copy figures/ into build/ so variant PDFs resolve \\graphicspath{{figures/}}."""
    if not FIGURES.is_dir():
        return
    dest = BUILD / "figures"
    dest.mkdir(parents=True, exist_ok=True)
    for path in FIGURES.iterdir():
        if path.is_file() and path.name != ".gitkeep":
            shutil.copy(path, dest / path.name)


def stage_springer_assets() -> None:
    cls = SN_TEMPLATE / "sn-jnl.cls"
    bst = SN_TEMPLATE / "bst" / "sn-mathphys-num.bst"
    if not cls.is_file():
        raise FileNotFoundError(f"Springer class not found: {cls}")
    if not bst.is_file():
        raise FileNotFoundError(f"Springer bst not found: {bst}")
    shutil.copy(cls, BUILD / cls.name)
    shutil.copy(bst, BUILD / bst.name)


def prepare_variant_source(variant: str) -> tuple[Path, str]:
    """Write the variant .tex into build/; return (path, jobname)."""
    spec = LATEX_VARIANTS[variant]
    BUILD.mkdir(exist_ok=True)
    shutil.copy(BIB, BUILD / BIB.name)

    if spec["preprocess"] is None:
        return MAIN, spec["jobname"]

    stage_figures()
    tex = preprocess_variant(spec["preprocess"], read_main())
    out = BUILD / spec["source_name"]
    out.write_text(tex, encoding="utf-8")

    if spec["stage_assets"] == "springer":
        stage_springer_assets()

    return out, spec["jobname"]


# --------------------------------------------------------------------------- #
#  Pandoc preprocessor: make our IEEEtran + draft macros portable.            #
# --------------------------------------------------------------------------- #
def preprocess_for_pandoc(tex: str) -> str:
    """Rewrite engine-specific constructs into LaTeX pandoc understands.
    Pure, line-level transforms — easy to audit."""

    tex = re.sub(r"\\newif\\ifdraft.*\n", "", tex)
    tex = re.sub(r"\\draft(true|false)\s*.*\n", "", tex)
    tex = re.sub(r"\\newcommand\{\\result\}.*\n", "", tex)
    tex = re.sub(r"\\newcommand\{\\todo\}.*\n", "", tex)
    tex = re.sub(r"\\newcommand\{\\contribbox\}.*?\n\}\n", "", tex, flags=re.DOTALL)
    tex = re.sub(r"\\graphicspath\{\{figures/\}\}\s*\n", "", tex)

    tex = re.sub(r"\\result\{([^{}]*)\}", r"[R: \1]", tex)
    tex = re.sub(r"\\todo\{[^{}]*\}", "", tex)
    # Figures: keep \includegraphics paths; pandoc resolves via --resource-path.
    tex = re.sub(
        r"\\includegraphics(\[[^\]]*\])?\{([^}]+)\}",
        r"\\includegraphics\1{figures/\2}",
        tex,
    )

    tex = re.sub(r"\\IEEEPARstart\{(.)\}\{([^{}]*)\}", r"\1\2", tex)
    tex = re.sub(r"(?m)^\\markboth.*\n?", "", tex)
    tex = re.sub(r"\\IEEEpeerreviewmaketitle", "", tex)
    tex = re.sub(
        r"\\begin\{IEEEkeywords\}(.*?)\\end\{IEEEkeywords\}",
        r"\\medskip\\noindent\\textbf{Index Terms---}\1\\medskip",
        tex,
        flags=re.DOTALL,
    )
    tex = re.sub(r"\\thanks\{.*?\}", "", tex, flags=re.DOTALL)
    tex = tex.replace(r"\documentclass[journal]{IEEEtran}", r"\documentclass{article}")
    return tex


def pandoc_source() -> Path:
    BUILD.mkdir(exist_ok=True)
    out = BUILD / "_pandoc.tex"
    out.write_text(preprocess_for_pandoc(read_main()), encoding="utf-8")
    return out


# --------------------------------------------------------------------------- #
#  LaTeX compilation                                                           #
# --------------------------------------------------------------------------- #
def compile_latex(tex: Path, jobname: str, label: str) -> bool:
    BUILD.mkdir(exist_ok=True)
    compile_cwd = BUILD if tex.parent == BUILD else ROOT

    # Ensure bibliography and figures are reachable from the aux file directory.
    if not (BUILD / BIB.name).exists():
        shutil.copy(BIB, BUILD / BIB.name)
    stage_figures()

    tectonic = which("tectonic")
    if tectonic:
        print(f"[{label}] tectonic -> {jobname}.pdf")
        rc = run([tectonic, "--outdir", str(BUILD), str(tex)], compile_cwd)
        if rc == 0:
            produced = BUILD / f"{tex.stem}.pdf"
            target = BUILD / f"{jobname}.pdf"
            if produced.is_file() and produced != target:
                produced.replace(target)
        return rc == 0

    latexmk = which("latexmk")
    if latexmk:
        print(f"[{label}] latexmk -> {jobname}.pdf")
        rc = run(
            [
                latexmk,
                "-pdf",
                "-bibtex",
                "-interaction=nonstopmode",
                f"-outdir={BUILD}",
                f"-jobname={jobname}",
                str(tex),
            ],
            compile_cwd,
        )
        return rc == 0

    pdflatex, bibtex = which("pdflatex"), which("bibtex")
    if pdflatex:
        print(f"[{label}] pdflatex + bibtex -> {jobname}.pdf")
        args = [
            pdflatex,
            "-interaction=nonstopmode",
            f"-output-directory={BUILD}",
            f"-jobname={jobname}",
            str(tex),
        ]
        run(args, compile_cwd)
        if bibtex:
            run([bibtex, jobname], BUILD)
        run(args, compile_cwd)
        rc = run(args, compile_cwd)
        return rc == 0

    print("  ! No LaTeX engine found. Install one of:")
    print("      tectonic   (recommended, single binary)  https://tectonic-typesetting.github.io")
    print("      TeX Live / MiKTeX (provides latexmk, pdflatex, bibtex)")
    print("    ...or upload main.tex to Overleaf and compile there.")
    return False


def build_latex_variant(variant: str) -> bool:
    spec = LATEX_VARIANTS[variant]
    print(f"[{variant}] {spec['label']}")
    try:
        tex, jobname = prepare_variant_source(variant)
    except FileNotFoundError as exc:
        print(f"  ! {exc}")
        return False
    ok = compile_latex(tex, jobname, variant)
    pdf = BUILD / f"{jobname}.pdf"
    if ok and pdf.is_file():
        print(f"  -> {pdf.relative_to(ROOT)}")
    return ok


def build_pdf() -> bool:
    return build_latex_variant("pdf")


def build_pandoc(fmt: str) -> bool:
    fmt = ALIASES.get(fmt, fmt)
    spec = PANDOC_FORMATS[fmt]
    src = pandoc_source()
    pandoc = which("pandoc")
    if not pandoc:
        print(f"  ! pandoc not found (needed for {fmt}). Install: https://pandoc.org/installing.html")
        print(f"    (portable LaTeX still written to {src.relative_to(ROOT)})")
        return False
    out = BUILD / f"paper.{spec['ext']}"
    cmd = [
        pandoc,
        str(src),
        "-o",
        str(out),
        "--citeproc",
        f"--bibliography={BIB}",
        "--number-sections",
        "--resource-path",
        str(ROOT),
    ]
    if META.exists():
        cmd += [f"--metadata-file={META}"]
    cmd += spec["args"]
    print(f"[{fmt}] pandoc -> {out.name}")
    return run(cmd, ROOT) == 0


def do_clean() -> None:
    if BUILD.exists():
        shutil.rmtree(BUILD)
        print("removed", BUILD)
    else:
        print("nothing to clean")


def resolve_format(fmt: str) -> str:
    return ALIASES.get(fmt.lower(), fmt.lower())


def list_tools() -> None:
    print("Toolchain availability:")
    for label, names in [
        ("PDF (tectonic)", ("tectonic",)),
        ("PDF (latexmk)", ("latexmk",)),
        ("PDF (pdflatex)", ("pdflatex",)),
        ("bibtex", ("bibtex",)),
        ("pandoc (html/docx/md/...)", ("pandoc",)),
    ]:
        path = which(*names)
        print(f"  {'OK ' if path else '-- '} {label:28} {path or 'not found'}")
    print("\nLaTeX PDF variants:")
    for key, spec in LATEX_VARIANTS.items():
        print(f"  {key:10}  {spec['label']}")
    print("\nOther formats:  html  docx  odt  md  epub  rtf  tex  jats  all")


def main() -> int:
    ap = argparse.ArgumentParser(description="Build the SmArchitect paper to any format.")
    ap.add_argument(
        "formats",
        nargs="*",
        default=["pdf"],
        help="pdf compsoc springer html docx ... all (default: pdf)",
    )
    ap.add_argument("--list", action="store_true", help="show available toolchains and exit")
    args = ap.parse_args()

    if args.list:
        list_tools()
        return 0
    if "clean" in args.formats:
        do_clean()
        return 0

    targets = [resolve_format(f) for f in args.formats]
    if "all" in targets:
        targets = ["pdf", "compsoc", "springer", "html", "docx", "md", "tex"]

    ok = True
    for fmt in targets:
        if fmt in LATEX_VARIANTS:
            ok &= build_latex_variant(fmt)
        elif fmt in PANDOC_FORMATS:
            ok &= build_pandoc(fmt)
        else:
            print(f"  ! unknown format: {fmt} (try --list)")
            ok = False

    print("\nartifacts in:", BUILD if BUILD.exists() else "(none produced)")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
