#!/bin/sh
# The interface size (README "Interface size"; GlassineOS/shell spec 012) on the built library:
# - test_size.py through C (size-cli.c) and Python: the factor, the files, the text size, the
#   minimums (the elements that reach one: out/test/size-minimums-{c,python}.txt);
# - the sample sheet with the metrics of Default on a display of 8.943 px/mm (factor 2, text
#   100 %), byte for byte the sheet without metrics: nothing changes there;
# - the sample sheet at the fractional factors (scale.py): edges on whole device pixels, no
#   rule thinner than one, text grown by the text size.
# Shots in out/test/size/.
set -eu
R=$(cd "$(dirname "$0")/.." && pwd)
T=$R/out/test
D=$T/size
PY=${PYTHON:-python3}
rm -rf "$D"
mkdir -p "$D"
${CC:-cc} -O2 -Wall -I"$R/src" -o "$T/size-cli" "$R/test/size-cli.c" -L"$R/out" -lglassine-ui \
    $(pkg-config --cflags --libs cairo)
${CC:-cc} -O2 -Wall -I"$R/src" -o "$T/sheet" "$R/test/sheet.c" -L"$R/out" -lglassine-ui \
    $(pkg-config --cflags --libs cairo) -lm
export LD_LIBRARY_PATH="$R/out" PYTHONPATH="$R/python"
"$PY" "$R/test/test_size.py" --cli "$T/size-cli" --out "$T"
fails=0
for v in white editorial stationery; do
    "$T/sheet" $v "$D/c-$v-plain.png" "$D/cells.txt"
    "$T/sheet" $v "$D/c-$v-default.png" "$D/cells.txt" 2 0.22363859 1
    "$PY" "$R/test/sheet.py" $v "$D/py-$v-plain.png" "$D/cells.txt"
    "$PY" "$R/test/sheet.py" $v "$D/py-$v-default.png" "$D/cells.txt" 2 0.22363859 1
    for f in c py; do
        if cmp -s "$D/$f-$v-plain.png" "$D/$f-$v-default.png"; then
            echo "ok   $f $v: Default at 8.943 px/mm, text 100 %: byte for byte the sheet without metrics"
        else
            echo "FAIL $f $v: Default at 8.943 px/mm, text 100 %: the sheet changed"; fails=1
        fi
    done
    # the metrics that change something: Smaller, the text size at 150 %
    "$T/sheet" $v "$D/c-$v-text150.png" "$D/cells.txt" 2 0.1792 1.5
    "$PY" "$R/test/sheet.py" $v "$D/py-$v-text150.png" "$D/cells.txt" 2 0.1792 1.5
    for s in 0.8 1.6 1.8 2.4; do
        "$T/sheet" $v "$D/c-$v-$s.png" "$D/cells.txt" $s
        "$PY" "$R/test/sheet.py" $v "$D/py-$v-$s.png" "$D/cells.txt" $s
    done
done
"$PY" "$R/test/scale.py" "$D" || fails=1
echo "size: $([ $fails = 0 ] && echo all passed || echo FAILED)"
exit $fails
