#!/bin/sh
# CFLAGS on the make command line (as a packager passes them) or in the
# environment add to the library's own flags (-fPIC, -Wall), never replace them.
set -eu
R=$(cd "$(dirname "$0")/.." && pwd)
fails=0
check() {
    what=$1; shift
    line=$("$@" | grep -e '-shared' || true)
    for f in -fPIC -Wall -O1; do
        case " $line " in
            *" $f "*) ;;
            *) echo "FAIL $what: no $f in: $line"; fails=1; return ;;
        esac
    done
    echo "ok   $what: -O1 with -fPIC and -Wall"
}
check "make CFLAGS=-O1" make -s -n -B -C "$R" O=out/test/flags CFLAGS=-O1 out/test/flags/libglassine-ui.so.1.2.0
check "CFLAGS=-O1 make" env CFLAGS=-O1 make -s -n -B -C "$R" O=out/test/flags out/test/flags/libglassine-ui.so.1.2.0
echo "build-flags: $([ $fails = 0 ] && echo all passed || echo FAILED)"
exit $fails
