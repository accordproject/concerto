#!/usr/bin/env bash
# Record the oracle corpus (task P0-05, plan §2.2).
#
# Usage: migration/oracle/bin/record-all.sh <work dir>
#
# 1. unit:        every test file of packages/concerto-core/test, each in its
#                 own mocha process (so a stub leaked by one file cannot
#                 distort another), against src/ via ts-node;
# 2. data:        drivers/data.spec.js over test/data and test/1.0.0;
# 3. conformance: drivers/conformance.spec.js over concerto-conformance.
# Then build-corpus.js dedupes into migration/oracle/fixtures.
#
# Raw records, staging blobs and logs stay in <work dir>.
set -euo pipefail

WORK="${1:?usage: record-all.sh <work dir>}"
ORACLE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CORE_DIR="$(cd "$ORACLE_DIR/../.." && pwd)/packages/concerto-core"
JOBS="${JOBS:-4}"

rm -rf "$WORK/raw" "$WORK/blobs" "$WORK/logs"
mkdir -p "$WORK/raw/unit" "$WORK/raw/data" "$WORK/raw/conformance" "$WORK/blobs" "$WORK/logs/unit"

export TS_NODE_PROJECT=tsconfig.build.json TZ=UTC ORACLE_BLOB_DIR="$WORK/blobs"
MOCHA=(npx mocha -r ts-node/register -r "$ORACLE_DIR/lib/recorder.js" -t 10000 --reporter dot)

cd "$CORE_DIR"
find test -name '*.js' -not -path 'test/data/*' | sort > "$WORK/unit-files.txt"
echo "unit: $(wc -l < "$WORK/unit-files.txt") test files, $JOBS parallel"
export WORK ORACLE_DIR
xargs -P "$JOBS" -I{} sh -c 'f="{}"; log="$WORK/logs/unit/$(echo "$f" | tr / _).log"; ORACLE_SOURCE=unit ORACLE_RAW_DIR="$WORK/raw/unit" npx mocha -r ts-node/register -r "$ORACLE_DIR/drivers/unit-setup.js" -r "$ORACLE_DIR/lib/recorder.js" -t 10000 --reporter dot "$f" > "$log" 2>&1 || echo "ERROR unit file had failures: $f (see $log)"' < "$WORK/unit-files.txt"
node -e '
const fs=require("fs");const d=process.argv[1];let p=0,f=0,pe=0;
for(const x of fs.readdirSync(d)){const t=fs.readFileSync(d+"/"+x,"utf8");
const m=t.match(/(\d+) passing/);if(m)p+=+m[1];const n=t.match(/(\d+) failing/);if(n)f+=+n[1];const q=t.match(/(\d+) pending/);if(q)pe+=+q[1];}
console.log(`unit suite under recorder: ${p} passing, ${f} failing, ${pe} pending`);' "$WORK/logs/unit" | tee "$WORK/logs/unit-summary.txt"

echo "data driver"
ORACLE_SOURCE=data ORACLE_RAW_DIR="$WORK/raw/data" "${MOCHA[@]}" -t 600000 "$ORACLE_DIR/drivers/data.spec.js" > "$WORK/logs/data.log" 2>&1 || echo "ERROR data driver failed (see $WORK/logs/data.log)"
tail -3 "$WORK/logs/data.log"

echo "conformance driver"
ORACLE_SOURCE=conformance ORACLE_RAW_DIR="$WORK/raw/conformance" "${MOCHA[@]}" -t 600000 "$ORACLE_DIR/drivers/conformance.spec.js" > "$WORK/logs/conformance.log" 2>&1 || echo "ERROR conformance driver failed (see $WORK/logs/conformance.log)"
tail -3 "$WORK/logs/conformance.log"

node "$ORACLE_DIR/bin/build-corpus.js" --raw "$WORK/raw/unit" --raw "$WORK/raw/data" --raw "$WORK/raw/conformance" --blobs "$WORK/blobs" --out "$ORACLE_DIR/fixtures"
