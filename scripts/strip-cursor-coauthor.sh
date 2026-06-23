#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
export FILTER_BRANCH_SQUELCH_WARNING=1
git filter-branch -f --msg-filter "sed '/^Co-authored-by: Cursor <cursoragent@cursor.com>\$/d'" HEAD
echo "Done. Verify with: git log -1 --format=%B"
