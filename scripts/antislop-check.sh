#!/usr/bin/env bash
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAIL=0

scan() {
  local label="$1" pattern="$2" include="$3"
  local hits
  hits=$(grep -rnE "$pattern" "$ROOT/frontend/src" "$ROOT/backend" --include="$include" \
    --exclude-dir=node_modules --exclude-dir=__pycache__ 2>/dev/null)
  if [ -n "$hits" ]; then
    echo "✗ $label"; echo "$hits"; FAIL=1
  else
    echo "✓ $label"
  fi
}

scan "no 'as any'" '\bas any\b' '*.ts*'
scan "no @ts-ignore / @ts-nocheck" '@ts-(ignore|nocheck)' '*.ts*'
scan "no silent catch returning null" 'catch *(\([^)]*\))? *\{ *return (null|undefined);? *\}' '*.[jt]s*'
scan "no bare except/pass" 'except( Exception)?: *(pass|return None)' '*.py'
scan "no purple/indigo gradient" '(from|via|to)-(purple|indigo|violet)-' '*.[jt]sx'

echo "→ tsc --noEmit"
(cd "$ROOT/frontend" && yarn -s tsc --noEmit) && echo "✓ typecheck" || FAIL=1

if command -v ruff >/dev/null 2>&1; then
  echo "→ ruff"
  ruff check "$ROOT/backend" && echo "✓ ruff" || FAIL=1
fi

exit $FAIL
