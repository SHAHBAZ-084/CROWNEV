#!/bin/sh
set -euo pipefail
cd "$(dirname "$0")/.."
export FILTER_BRANCH_SQUELCH_WARNING=1
git filter-branch -f --msg-filter "grep -v '^Co-authored-by: Cursor <cursoragent@cursor.com>\$'" HEAD
echo "Done. Verify with: git log -1 --format=%B"
