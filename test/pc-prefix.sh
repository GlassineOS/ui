#!/bin/sh
# The installed pkg-config file names the prefix it was installed with, not the
# one of an earlier build: make (PREFIX=/usr/local), then make install
# PREFIX=/usr DESTDIR=..., the packaging order.
set -eu
R=$(cd "$(dirname "$0")/.." && pwd)
T=$R/out/test/pc
rm -rf "$T"
mkdir -p "$T"
make -s -C "$R" all O=out/test/pc/build PREFIX=/opt/built-with >/dev/null
make -s -C "$R" install O=out/test/pc/build PREFIX=/usr DESTDIR="$T/dest" PYTHONDIR=/usr/lib/python3/site-packages >/dev/null
pc=$T/dest/usr/lib/pkgconfig/glassine-ui.pc
fails=0
for want in prefix=/usr libdir=/usr/lib includedir=/usr/include; do
    if grep -qx "$want" "$pc"; then echo "ok   $want"; else echo "FAIL $want: $(grep "^${want%%=*}=" "$pc")"; fails=1; fi
done
if grep -q -e /opt/built-with -e "$T" "$pc"; then echo "FAIL the build's prefix or DESTDIR in the .pc"; fails=1; else echo "ok   neither the build's prefix nor DESTDIR in the .pc"; fi
# nothing changed: the .pc is not written again
t0=$(stat -c %Y "$R/out/test/pc/build/glassine-ui.pc")
sleep 1
make -s -C "$R" all O=out/test/pc/build PREFIX=/usr >/dev/null
[ "$(stat -c %Y "$R/out/test/pc/build/glassine-ui.pc")" = "$t0" ] && echo "ok   same paths: the .pc stays" || { echo "FAIL same paths: the .pc was written again"; fails=1; }
echo "pc-prefix: $([ $fails = 0 ] && echo all passed || echo FAILED)"
exit $fails
