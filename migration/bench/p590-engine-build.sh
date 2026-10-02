#!/bin/sh
# P5-90 (accordproject/concerto-rust#436): builds a concerto-wasm engine
# (concerto-engine.cjs) from a concerto-rust tree into its own directory,
# for profiling and timing. Measure only.
#
#   sh migration/bench/p590-engine-build.sh <concerto-rust dir> <out dir> [named|shipped]
#
# named:   function names kept (wasm-bindgen --keep-debug, wasm-opt -O3 -g),
#          so a V8 CPU profile shows the Rust frames (as P5-48/P5-76).
# shipped: exactly build.sh's optimisation (wasm-opt -O3, names stripped).
# Environment: CARGO_TARGET_DIR (required: one per tree and kind),
# WASM_OPT (default: the tree's concerto-wasm/node_modules/.bin/wasm-opt).
set -eu
SRC=$(CDPATH= cd -- "$1" && pwd)
mkdir -p "$2"
OUT=$(CDPATH= cd -- "$2" && pwd)
KIND=${3:-named}
NAME=concerto_wasm
: "${CARGO_TARGET_DIR:?set CARGO_TARGET_DIR}"
export CARGO_INCREMENTAL=0
if [ "$KIND" = named ]; then
  export CARGO_PROFILE_RELEASE_STRIP=false CARGO_PROFILE_RELEASE_DEBUG=0
  KEEP=--keep-debug; G=-g
else
  KEEP=; G=
fi
(cd "$SRC/concerto-wasm" && cargo build --release --target wasm32-unknown-unknown)
RAW=$CARGO_TARGET_DIR/wasm32-unknown-unknown/release/$NAME.wasm
WO=${WASM_OPT:-$SRC/concerto-wasm/node_modules/.bin/wasm-opt}
rm -rf "$OUT/pkg"; mkdir -p "$OUT/scripts"
cp "$SRC/concerto-wasm/scripts/inline.mjs" "$OUT/scripts/"
cd "$OUT"
wasm-bindgen $KEEP --target web --out-dir pkg/web "$RAW"
wasm-bindgen $KEEP --target nodejs --out-dir pkg/node "$RAW"
"$WO" -O3 $G --enable-bulk-memory --enable-nontrapping-float-to-int --enable-sign-ext \
  --enable-reference-types --enable-multivalue --enable-mutable-globals \
  "pkg/web/${NAME}_bg.wasm" -o "pkg/${NAME}.wasm"
node scripts/inline.mjs
ls -la pkg/concerto-engine.cjs "pkg/${NAME}.wasm"
