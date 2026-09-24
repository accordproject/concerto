#!/usr/bin/env bash
# Corpus-only coverage of the reference (task P0-05, plan §2.4).
#
# Usage: migration/oracle/bin/coverage.sh <work dir> [--with-suite]
#
# Replays the whole corpus under nyc, with the corpus as the only driver:
#
# 1. against the frozen reference (reference/node_modules/@accordproject/
#    concerto-core, bin/replay.js --engine reference): nyc instruments its
#    CommonJS dist/*.js and remaps the counts through the package's own source
#    maps to src/*.ts, so the result has the same files and the same branch
#    map as the workspace src/ (the gap list is taken from this run);
# 2. against packages/concerto-core/src through ts-node (--engine src), the
#    same code as the reference, as a cross-check: coverage-gaps.js reports
#    every branch on which the two runs disagree.
#
# With --with-suite it also runs the unit suite under nyc over src/ (same
# command as migration/baseline.json) to learn which branches the suite
# covers. Then writes migration/oracle/coverage-gaps.json and
# migration/oracle/results/coverage.json.
set -euo pipefail
WORK="${1:?usage: coverage.sh <work dir> [--with-suite]}"
ORACLE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "$ORACLE_DIR/../.." && pwd)"
CORE_DIR="$REPO_DIR/packages/concerto-core"
REF_PKG="$ORACLE_DIR/reference/node_modules/@accordproject/concerto-core"
NYC="$REPO_DIR/node_modules/.bin/nyc"
mkdir -p "$WORK"
WORK="$(cd "$WORK" && pwd)"
export TZ=UTC

# 1. corpus -> frozen reference. --cwd is the reference package so that its
# dist/ is instrumented even though it lives under node_modules; src/**/*.ts
# must also be included because nyc filters the report after the source-map
# remap. esm/ and esm-browser/ are bundles the CommonJS entry never loads.
rm -rf "$WORK/corpus-ref-nyc-tmp" "$WORK/corpus-ref-nyc-report"
(cd "$REF_PKG" && "$NYC" --cwd "$REF_PKG" --no-exclude-node-modules \
  --include 'dist/**/*.js' --include 'src/**/*.ts' --exclude 'dist/esm/**' --exclude 'dist/esm-browser/**' \
  --all --temp-dir "$WORK/corpus-ref-nyc-tmp" --report-dir "$WORK/corpus-ref-nyc-report" \
  --reporter json --reporter json-summary --reporter text-summary --check-coverage=false \
  node "$ORACLE_DIR/bin/replay.js" --engine reference > "$WORK/corpus-ref-coverage.log" 2>&1) || true
grep -E 'engine=|Statements|Branches|Functions|Lines' "$WORK/corpus-ref-coverage.log"

# 2. corpus -> workspace src/ (cross-check).
cd "$CORE_DIR"
export TS_NODE_PROJECT=tsconfig.build.json
rm -rf "$WORK/corpus-nyc-tmp" "$WORK/corpus-nyc-report"
npx nyc --temp-dir "$WORK/corpus-nyc-tmp" --report-dir "$WORK/corpus-nyc-report" \
  --reporter json --reporter json-summary --reporter text-summary --check-coverage=false \
  node -r ts-node/register "$ORACLE_DIR/bin/replay.js" --engine src > "$WORK/corpus-coverage.log" 2>&1 || true
grep -E 'engine=|Statements|Branches|Functions|Lines' "$WORK/corpus-coverage.log"

SUITE_ARGS=()
if [[ "${2:-}" == "--with-suite" ]]; then
  rm -rf "$WORK/suite-nyc-tmp" "$WORK/suite-nyc-report"
  npx nyc --temp-dir "$WORK/suite-nyc-tmp" --report-dir "$WORK/suite-nyc-report" \
    --reporter json --reporter json-summary --reporter text-summary --check-coverage=false \
    mocha -r ts-node/register --recursive -t 10000 --reporter dot test/ > "$WORK/suite-coverage.log" 2>&1 || true
  grep -E 'passing|failing|Statements|Branches|Functions|Lines' "$WORK/suite-coverage.log"
  SUITE_ARGS=(--suite "$WORK/suite-nyc-report/coverage-final.json" --suite-summary "$WORK/suite-nyc-report/coverage-summary.json")
fi

node "$ORACLE_DIR/bin/coverage-gaps.js" \
  --corpus "$WORK/corpus-ref-nyc-report/coverage-final.json" \
  --corpus-summary "$WORK/corpus-ref-nyc-report/coverage-summary.json" \
  --corpus-src "$WORK/corpus-nyc-report/coverage-final.json" \
  --corpus-src-summary "$WORK/corpus-nyc-report/coverage-summary.json" \
  "${SUITE_ARGS[@]}"
