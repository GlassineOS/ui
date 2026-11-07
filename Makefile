# glassine-ui: Interleaf (interleaf/), the voices (voices/voices.json) and the drawing built on them.
#   make                 the C library and the pkg-config file (out/)
#   make install         PREFIX=/usr/local DESTDIR=; PYTHONDIR= for the Python package
#   make generate        the generated forms of the tokens (tools/gen-interleaf: the voices'
#                        scheme, web/) and of voices/voices.json (tools/gen-voices)
#   make check           the generated forms are current, the library builds, the tests pass
#   make boards-check    the design-board samples in headless Chromium (in Alpine: tools/in-alpine)
#   make export-claude   Interleaf staged for claude.ai in $(CLAUDE_OUT) (tools/export-claude)
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
CLAUDE_OUT ?= $(O)/claude/interleaf
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

# only the default folder is cleaned: a CLAUDE_OUT of your own must be empty, the tool refuses it otherwise
export-claude:
	[ "$(CLAUDE_OUT)" != "$(O)/claude/interleaf" ] || rm -rf $(CLAUDE_OUT)
	$(PYTHON) tools/export-claude $(CLAUDE_OUT)

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

check: all
	$(PYTHON) tools/gen-interleaf --check
	$(PYTHON) tools/gen-voices --check
	$(PYTHON) test/test_voices.py
	$(PYTHON) test/test_interleaf.py
	$(PYTHON) test/test_paint.py
	sh test/c-api.sh
	sh test/pc-prefix.sh
	sh test/build-flags.sh
	sh test/sheet.sh
	$(NODE) --test test/boards/*.test.js

# the sample boards rendered and clicked through (needs Chromium; tools/in-alpine provides one)
BOARDS_INTERLEAF = test/boards/fixtures/interleaf
boards-check:
	tools/boards check boards/samples --interleaf $(BOARDS_INTERLEAF) --json $(O)/boards-check.json
	$(NODE) test/boards/samples-e2e.js

clean:
	rm -f $(O)/libglassine-ui.so* $(O)/glassine-ui.pc $(O)/pc.vars
	rm -rf $(O)/test $(O)/claude

.PHONY: all generate export-claude install check boards-check clean FORCE
FORCE:
