#!/bin/sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
export FILTER_BRANCH_SQUELCH_WARNING=1
git filter-branch -f --msg-filter "node \"$ROOT/scripts/strip-cursor-coauthor.mjs\"" HEAD
echo "Done. Verify with: git log -1 --format=%B"
