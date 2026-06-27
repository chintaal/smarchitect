# Convenience wrapper around build.py. `make` builds the PDF.
PY ?= python

.PHONY: all pdf compsoc springer html docx md tex list clean humanize analyze
all:      ; $(PY) build.py all
pdf:      ; $(PY) build.py pdf
compsoc:  ; $(PY) build.py compsoc
springer: ; $(PY) build.py springer
html:  ; $(PY) build.py html
docx:  ; $(PY) build.py docx
md:    ; $(PY) build.py md
tex:   ; $(PY) build.py tex
list:  ; $(PY) build.py --list
clean: ; $(PY) build.py clean
humanize: ; $(PY) humanize.py --input main.tex --output build/main-humanized.tex --report
analyze:  ; $(PY) humanize.py --input main.tex --analyze
