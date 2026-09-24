#!/usr/bin/env bash
# P0-02(A): run the concerto-core suite once with the sinon-trace hook and
# the mocha JSON reporter, producing the two inputs tag-tests.mjs needs:
#   migration/tags/mocha-results.json   (runtime test list, source of truth)
#   migration/tags/runtime-stub-trace.json (which tests touched internals)
#
# Per the migration harness rules this never runs `npm test` (its pretest
# lint / nyc dirs collide with other agents); it invokes mocha directly, and
# writes nyc output to a caller-supplied scratch dir.
#
# Usage: run-tagging.sh <scratch-tmp-dir> [file...]
#   scratch-tmp-dir   required; nyc --temp-dir/--report-dir go under here.
#   file...           optional list of test files (relative to
#                      packages/concerto-core), defaults to every test file
#                      under test/** that contains an it() (only test/data is
#                      excluded, as pure fixtures with no specs at all;
#                      test/models/*.js DOES contain real it() specs and is
#                      included like any other test directory).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$MIGRATION_DIR/.." && pwd)"
CORE_DIR="$REPO_ROOT/packages/concerto-core"

SCRATCH="${1:?usage: run-tagging.sh <scratch-tmp-dir> [file...]}"
shift || true

mkdir -p "$SCRATCH/nyc-tmp" "$SCRATCH/nyc-report" "$SCRATCH/logs"

if [ "$#" -gt 0 ]; then
    FILES=("$@")
else
    mapfile -t FILES < <(cd "$CORE_DIR" && find test -name '*.js' -not -path 'test/data/*' | sort | while read -r f; do
        grep -q '\bit(' "$f" && echo "$f"
    done)
fi

echo "Running ${#FILES[@]} test file(s) with sinon-trace hook + JSON reporter..."

rm -f "$MIGRATION_DIR/tags/runtime-stub-trace.json"

cd "$CORE_DIR"
set +e
TS_NODE_PROJECT=tsconfig.build.json TZ=UTC npx nyc \
    --temp-dir "$SCRATCH/nyc-tmp" --report-dir "$SCRATCH/nyc-report" \
    mocha -r ts-node/register -r "$MIGRATION_DIR/tags/sinon-trace-hook.cjs" \
    --recursive -t 10000 --reporter json "${FILES[@]}" \
    > "$SCRATCH/logs/mocha-results.json" 2> "$SCRATCH/logs/mocha-stderr.log"
STATUS=$?
set -e

# The raw capture can have stray log lines before the JSON (console logging
# from the code under test) and nyc's text-summary reporter appended after
# it, so extract just the outermost {...} object.
node -e "
const fs = require('fs');
const raw = fs.readFileSync('$SCRATCH/logs/mocha-results.json', 'utf8');
const start = raw.indexOf('{');
const end = raw.lastIndexOf('}');
if (start === -1 || end === -1) { console.error('no JSON object found in mocha output'); process.exit(1); }
const jsonText = raw.slice(start, end + 1);
JSON.parse(jsonText); // throws if still malformed
fs.writeFileSync('$MIGRATION_DIR/tags/mocha-results.json', jsonText);
"

node -e "
const j = require('$MIGRATION_DIR/tags/mocha-results.json');
console.log('stats:', JSON.stringify(j.stats));
"

if [ "$STATUS" -ne 0 ]; then
    echo "NOTE: mocha exited $STATUS (some tests failed) — this is fine for tagging purposes; failures are tagged the same as passes. See $SCRATCH/logs/mocha-stderr.log" >&2
fi

echo "Wrote $MIGRATION_DIR/tags/mocha-results.json and $MIGRATION_DIR/tags/runtime-stub-trace.json"
