#!/usr/bin/env bash
# Usage: scripts/refresh-grades.sh [eligibility.json]
#   1. Copies Civic's grade eligibility in (default /workspace/townhall/civic/grades_eligibility.json, else grade_races.json).
#      No file = no grades (fail closed). Judicial races, measures and unopposed races are never eligible.
#   2. Runs the tests (npm test).
#   3. Commits the copied files locally (no push) and packs a PREVIEW deploy (never production) with scripts/deploy-preview.sh;
#      the upload itself goes through the Vercel MCP (upload_file + create_deployment with no target), see that script.
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/sync-grades.mjs ${1:+"$1"}
npm test --silent
git add lib/gradesEligibility.gen.mjs data/civic/grades_eligibility.json data/civic/grade_races.json 2>/dev/null || true
git diff --cached --quiet || git commit -q -m "Grades: refresh Civic eligibility file"
bash scripts/deploy-preview.sh
