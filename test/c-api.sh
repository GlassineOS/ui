#!/bin/sh
# The C API from a separate program: install into a stage prefix, build
# test/c-api.c with pkg-config glassine-ui from there, run it.
set -eu
R=$(cd "$(dirname "$0")/.." && pwd)
T=$R/out/test
STAGE=$T/stage
mkdir -p "$T"
# its own object dir: the stage's pc file names the stage, not PREFIX
make -s -C "$R" install O=out/test/build PREFIX="$STAGE" >/dev/null
export PKG_CONFIG_PATH="$STAGE/lib/pkgconfig"
${CC:-cc} -O2 -Wall -o "$T/c-api" "$R/test/c-api.c" $(pkg-config --cflags --libs glassine-ui)
LD_LIBRARY_PATH="$STAGE/lib" "$T/c-api"
