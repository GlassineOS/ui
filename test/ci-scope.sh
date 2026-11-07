#!/bin/sh
# SPDX-License-Identifier: GPL-2.0-or-later
# tools/ci-scope: library paths give "lib", everything else "forms".
cd "$(dirname "$0")/.." || exit 1
fails=0
t() {
    got=$(printf '%s\n' "$2" | sh tools/ci-scope)
    if [ "$got" = "$1" ]; then echo "ok   $1: $2"; else echo "FAIL $1 (got $got): $2"; fails=$((fails + 1)); fi
}
t forms "interleaf/components/bundle.css"
t forms "interleaf/tokens.json
web/tokens.css"
t forms "README.md
specs/002-interleaf/spec.md"
t forms "test/test_interleaf.py"
t forms "tools/gen-interleaf"
t forms "tools/gen-reference
test/test_reference.py
.github/workflows/reference.yml"
t lib   "interleaf/tokens.json
voices/voices.json"
t lib   "src/glassine-ui-draw.c"
t lib   "python/glassine_ui/paint.py"
t lib   "Makefile"
t lib   "test/sheet.py"
t lib   ".github/workflows/build.yml"
t lib   "tools/ci-scope"
t forms ""
echo "ci-scope: $([ $fails = 0 ] && echo all passed || echo $fails FAILED)"
[ $fails = 0 ]
