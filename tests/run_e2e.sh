#!/usr/bin/env bash
# Runs every tests/*_e2e.py plus regression.py against one served copy of this folder.
# The suites need the base URL as argv[1] and, for the dev build, FF_KEY=flossfox-dev.v1
# (regression.py otherwise defaults to the production key and reads null storage).
# backup_forward_e2e.py also needs PROD_URL (a locally served production copy); it is skipped without it.
BASE="${1:-http://localhost:8765/}"
export FF_KEY="${FF_KEY:-flossfox-dev.v1}"
cd "$(dirname "$0")/.."
fail=0
for f in tests/regression.py tests/*_e2e.py; do
  if [ "$f" = tests/backup_forward_e2e.py ]; then
    [ -n "$PROD_URL" ] || { echo "SKIP $f (set PROD_URL)"; continue; }
    python3 "$f" "$PROD_URL" "$BASE" || fail=1; continue
  fi
  # Legacy suites see compact rows and Help expanders opened (tests/compat/sitecustomize.py);
  # compact_e2e.py tests the closed-by-default behavior itself, so it runs without the shim.
  if [ "$f" = tests/compact_e2e.py ]; then echo "== $f"; python3 "$f" "$BASE" || fail=1; continue; fi
  echo "== $f"; PYTHONPATH="$PWD/tests/compat${PYTHONPATH:+:$PYTHONPATH}" FF_COMPAT_ALL=1 python3 "$f" "$BASE" || fail=1
done
exit $fail
