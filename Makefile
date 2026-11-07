# glassine-ui: Interleaf (interleaf/), the voices (voices/voices.json) and the drawing built on them.
#   make                 the C library and the pkg-config file (out/)
#   make install         PREFIX=/usr/local DESTDIR=; PYTHONDIR= for the Python package
#   make generate        the generated forms of the tokens (tools/gen-interleaf: the voices'
#                        scheme, web/) and of voices/voices.json (tools/gen-voices)
#   make check           the generated forms are current, the library builds, the tests pass:
#                        check-forms (python3 alone, seconds), check-lib, check-boards (node)
#   make boards-check    the design-board samples in headless Chromium (in Alpine: tools/in-alpine)
#   make contrast-check  the contrast check of every component (Chromium; tools/in-alpine)
#   make contrast-test   the contrast check's self-test and the known failures it must catch
#   make reference       the browsable Interleaf reference (tools/gen-reference) in out/reference/
#   make serve-reference build it and serve it on http://127.0.0.1:8000/ (REFERENCE_HOST, REFERENCE_PORT)
VERSION = 1.0.0
SOMAJOR = 1
PREFIX ?= /usr/local
LIBDIR ?= $(PREFIX)/lib
INCLUDEDIR ?= $(PREFIX)/include
DATADIR ?= $(PREFIX)/share
PYTHON ?= python3
NODE ?= node
PYTHONDIR ?= $(shell $(PYTHON) -c 'import sysconfig; print(sysconfig.get_path("purelib", vars={"base": "$(PREFIX)"}))' 2>/dev/null)
CC ?= cc
CFLAGS ?= -O2
# the library's own flags, kept apart so that make CFLAGS=... doesn't drop them
UI_CFLAGS = -Wall -Wno-format-truncation -fPIC
PKGS = pangocairo librsvg-2.0 glib-2.0
O = out
LIB = $(O)/libglassine-ui.so.$(VERSION)
SRC = src/glassine-ui-draw.c src/glassine-ui-voices.c src/glassine-ui-icons.c
HDR = src/glassine-ui.h src/glassine-ui-scheme.h

all: $(LIB) $(O)/glassine-ui.pc

$(LIB): $(SRC) $(HDR)
	@mkdir -p $(O)
	$(CC) $(CFLAGS) $(UI_CFLAGS) -shared -Wl,-soname,libglassine-ui.so.$(SOMAJOR) -o $@ $(SRC) \
	    $$(pkg-config --cflags --libs $(PKGS)) -lm
	ln -sf libglassine-ui.so.$(VERSION) $(O)/libglassine-ui.so.$(SOMAJOR)
	ln -sf libglassine-ui.so.$(SOMAJOR) $(O)/libglassine-ui.so

# the paths the .pc names, kept in a stamp that changes only when they do: a
# make install PREFIX=/usr after a plain make writes the .pc again
PCVARS = $(PREFIX)|$(LIBDIR)|$(INCLUDEDIR)|$(VERSION)
$(O)/pc.vars: FORCE
	@mkdir -p $(O)
	@echo '$(PCVARS)' | cmp -s - $@ || echo '$(PCVARS)' > $@

$(O)/glassine-ui.pc: glassine-ui.pc.in Makefile $(O)/pc.vars
	@mkdir -p $(O)
	sed -e 's|@PREFIX@|$(PREFIX)|' -e 's|@LIBDIR@|$(LIBDIR)|' -e 's|@INCLUDEDIR@|$(INCLUDEDIR)|' \
	    -e 's|@VERSION@|$(VERSION)|' glassine-ui.pc.in > $@

generate:
	$(PYTHON) tools/gen-interleaf
	$(PYTHON) tools/gen-voices

install: all
	install -d $(DESTDIR)$(LIBDIR)/pkgconfig $(DESTDIR)$(INCLUDEDIR)/glassine-ui \
	    $(DESTDIR)$(DATADIR)/glassine-ui $(DESTDIR)$(PYTHONDIR)/glassine_ui
	install -m 755 $(LIB) $(DESTDIR)$(LIBDIR)/
	ln -sf libglassine-ui.so.$(VERSION) $(DESTDIR)$(LIBDIR)/libglassine-ui.so.$(SOMAJOR)
	ln -sf libglassine-ui.so.$(SOMAJOR) $(DESTDIR)$(LIBDIR)/libglassine-ui.so
	install -m 644 $(O)/glassine-ui.pc $(DESTDIR)$(LIBDIR)/pkgconfig/
	install -m 644 $(HDR) $(DESTDIR)$(INCLUDEDIR)/glassine-ui/
	install -m 644 voices/voices.json $(DESTDIR)$(DATADIR)/glassine-ui/
	install -m 644 python/glassine_ui/*.py $(DESTDIR)$(PYTHONDIR)/glassine_ui/

check: check-forms check-lib check-boards

# the tokens and the voice data and their generated forms; needs python3 only
check-forms:
	$(PYTHON) tools/gen-interleaf --check
	$(PYTHON) tools/gen-voices --check
	$(PYTHON) test/test_voices.py
	$(PYTHON) test/test_interleaf.py
	$(PYTHON) test/test_reference.py
	sh test/ci-scope.sh

# the library: the build, the drawing APIs, the sample sheet
check-lib: all
	$(PYTHON) test/test_paint.py
	sh test/c-api.sh
	sh test/pc-prefix.sh
	sh test/build-flags.sh
	sh test/sheet.sh

# the design-board tools under node (reader, renderer, server, import); no browser
check-boards:
	$(NODE) --test test/boards/*.test.js test/contrast/*.test.js

# the sample boards rendered and clicked through (needs Chromium; tools/in-alpine provides one)
# the samples read the real Interleaf (default); BOARDS_INTERLEAF=DIR serves another copy as is
BOARDS_INTERLEAF ?=
boards-check:
	tools/boards check boards/samples $(if $(BOARDS_INTERLEAF),--interleaf $(BOARDS_INTERLEAF)) --json $(O)/boards-check.json
	$(NODE) test/boards/samples-e2e.js

# the contrast check (spec 002 FR-020): every component in all 27 combinations, desktop and phone
# width, hover, focus, current and open states, against WCAG 2.2 AA (needs Chromium: tools/in-alpine).
# Known open failures are listed in test/contrast/open.json, the least cases per page in
# test/contrast/coverage.json. contrast-test: the check's self-test, and the known failures of the
# acceptance set, each of which it must catch.
CONTRAST_JOBS ?= 8
contrast-check:
	$(NODE) tools/contrast --jobs $(CONTRAST_JOBS) --open test/contrast/open.json --coverage test/contrast/coverage.json --json $(O)/contrast.json
contrast-test:
	$(NODE) test/contrast/selftest.js
	CONTRAST_JOBS=$(CONTRAST_JOBS) $(NODE) test/contrast/known-failures.js

# the Interleaf reference (spec 002 FR-030, FR-031): static, every link relative; CI publishes it
# from main (.github/workflows/reference.yml)
REFERENCE_HOST ?= 127.0.0.1
REFERENCE_PORT ?= 8000
reference:
	$(PYTHON) tools/gen-reference --out $(O)/reference

serve-reference: reference
	@echo "Interleaf reference: http://$(REFERENCE_HOST):$(REFERENCE_PORT)/ (Ctrl-C stops it)"
	$(PYTHON) -m http.server --bind $(REFERENCE_HOST) --directory $(O)/reference $(REFERENCE_PORT)

clean:
	rm -f $(O)/libglassine-ui.so* $(O)/glassine-ui.pc $(O)/pc.vars
	rm -rf $(O)/test $(O)/reference

.PHONY: all generate install check check-forms check-lib check-boards boards-check contrast-check contrast-test reference serve-reference clean FORCE
FORCE:
