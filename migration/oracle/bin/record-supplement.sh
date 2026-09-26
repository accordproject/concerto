#!/usr/bin/env bash
# Record the additive corpus supplement (task P2-11b) next to the pinned
# canonical corpus, without re-recording or changing any pinned file.
#
# Usage: migration/oracle/bin/record-supplement.sh <work dir> <pinned oracle-corpus-*.tgz> <pin content hash>
#
# Runs only drivers/supplement.spec.js under the recorder (ORACLE_SOURCE=
# supplement; the frozen clock and seeded random/uuid of lib/env.js), then
# bin/build-supplement.js, which checks the pin before and after, drops exact
# duplicates of pinned fixtures, fails on an id collision and writes
# migration/oracle/fixtures/supplement/. The pinned corpus must already be
# extracted at the checkout root. Record from a checkout whose
# packages/concerto-core/src is the frozen reference's own source (v5.0.0),
# as README.md "Corpus supplement" describes.
#
# Raw records, staging blobs and logs stay in <work dir>.
set -euo pipefail

WORK="${1:?usage: record-supplement.sh <work dir> <pin tgz> <pin hash>}"
PIN="${2:?usage: record-supplement.sh <work dir> <pin tgz> <pin hash>}"
PIN_HASH="${3:?usage: record-supplement.sh <work dir> <pin tgz> <pin hash>}"
ORACLE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "$ORACLE_DIR/../.." && pwd)"
CORE_DIR="$REPO_DIR/packages/concerto-core"
mkdir -p "$WORK"
WORK="$(cd "$WORK" && pwd)"
PIN="$(cd "$(dirname "$PIN")" && pwd)/$(basename "$PIN")"

rm -rf "$WORK/raw" "$WORK/blobs" "$WORK/logs"
mkdir -p "$WORK/raw/supplement" "$WORK/blobs" "$WORK/logs"

export TS_NODE_PROJECT=tsconfig.build.json TZ=UTC ORACLE_BLOB_DIR="$WORK/blobs"
unset CONCERTO_ENGINE

cd "$CORE_DIR"
echo "supplement driver"
ORACLE_SOURCE=supplement ORACLE_RAW_DIR="$WORK/raw/supplement" npx mocha -r ts-node/register -r "$ORACLE_DIR/lib/recorder.js" \
  -t 600000 --reporter dot "$ORACLE_DIR/drivers/supplement.spec.js" > "$WORK/logs/supplement.log" 2>&1 \
  || { echo "ERROR supplement driver failed (see $WORK/logs/supplement.log)"; exit 1; }
tail -3 "$WORK/logs/supplement.log"

node "$ORACLE_DIR/bin/build-supplement.js" --raw "$WORK/raw/supplement" --blobs "$WORK/blobs" \
  --pin "$PIN" --pin-hash "$PIN_HASH" --base "$(git -C "$REPO_DIR" rev-parse --short=9 HEAD)" \
  --summary "$WORK/SUPPLEMENT.md"
