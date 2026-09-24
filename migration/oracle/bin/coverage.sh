#!/usr/bin/env bash
# Corpus-only coverage of the reference (task P0-05, plan §2.4).
#
# Usage: migration/oracle/bin/coverage.sh <work dir> [--with-suite]
#
# Replays the whole corpus against packages/concerto-core/src (TypeScript via
# ts-node, the same code as the frozen reference) under nyc, with the corpus as
# the only driver. With --with-suite it also runs the unit suite under nyc
# (same command as migration/baseline.json) to learn which branches the suite
# covers. Then writes migration/oracle/coverage-gaps.json and
# migration/oracle/results/coverage.json.
set -euo pipefail
WORK="${1:?usage: coverage.sh <work dir> [--with-suite]}"
ORACLE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CORE_DIR="$(cd "$ORACLE_DIR/../.." && pwd)/packages/concerto-core"
mkdir -p "$WORK"
cd "$CORE_DIR"
export TS_NODE_PROJECT=tsconfig.build.json TZ=UTC

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
  --corpus "$WORK/corpus-nyc-report/coverage-final.json" \
  --corpus-summary "$WORK/corpus-nyc-report/coverage-summary.json" \
  "${SUITE_ARGS[@]}"
