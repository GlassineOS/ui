#!/bin/sh
# FR-012: the sample sheet of every element in the three voices, drawn by the C
# library (sheet.c) and by the Python module (sheet.py), compared (compare.py).
# Shots in out/test/sheet-{c,py}-VOICE.png.
set -eu
R=$(cd "$(dirname "$0")/.." && pwd)
T=$R/out/test
mkdir -p "$T"
${CC:-cc} -O2 -Wall -I"$R/src" -o "$T/sheet" "$R/test/sheet.c" -L"$R/out" -lglassine-ui \
    $(pkg-config --cflags --libs cairo)
for v in white editorial stationery; do
    LD_LIBRARY_PATH="$R/out" "$T/sheet" $v "$T/sheet-c-$v.png" "$T/sheet-c-$v.txt"
    PYTHONPATH="$R/python" ${PYTHON:-python3} "$R/test/sheet.py" $v "$T/sheet-py-$v.png" "$T/sheet-py-$v.txt"
done
${PYTHON:-python3} "$R/test/compare.py" "$T"
