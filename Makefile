# glassine-ui: the voices (voices/voices.json) and the drawing built on them.
#   make                 the C library and the pkg-config file (out/)
#   make install         PREFIX=/usr/local DESTDIR=; PYTHONDIR= for the Python package
#   make generate        the generated forms of voices/voices.json (tools/gen-voices)
#   make check           the generated forms are current, the library builds, the tests pass
VERSION = 1.0.0
SOMAJOR = 1
PREFIX ?= /usr/local
LIBDIR ?= $(PREFIX)/lib
INCLUDEDIR ?= $(PREFIX)/include
DATADIR ?= $(PREFIX)/share
PYTHON ?= python3
PYTHONDIR ?= $(shell $(PYTHON) -c 'import sysconfig; print(sysconfig.get_path("purelib", vars={"base": "$(PREFIX)"}))' 2>/dev/null)
CC ?= cc
CFLAGS ?= -O2
CFLAGS += -Wall -Wno-format-truncation -fPIC
PKGS = pangocairo librsvg-2.0 glib-2.0
O = out
LIB = $(O)/libglassine-ui.so.$(VERSION)
SRC = src/glassine-ui-draw.c src/glassine-ui-voices.c
HDR = src/glassine-ui.h src/glassine-ui-scheme.h

all: $(LIB) $(O)/glassine-ui.pc

$(LIB): $(SRC) $(HDR)
	@mkdir -p $(O)
	$(CC) $(CFLAGS) -shared -Wl,-soname,libglassine-ui.so.$(SOMAJOR) -o $@ $(SRC) \
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

check: all
	$(PYTHON) tools/gen-voices --check
	$(PYTHON) test/test_voices.py
	sh test/c-api.sh
	sh test/pc-prefix.sh
	sh test/sheet.sh

clean:
	rm -f $(O)/libglassine-ui.so* $(O)/glassine-ui.pc $(O)/pc.vars
	rm -rf $(O)/test

.PHONY: all generate install check clean FORCE
FORCE:
