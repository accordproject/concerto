#!/bin/sh
# P5-91 (accordproject/concerto-rust#437): the before/after of the views.ts
# load-path bookkeeping trim, in one run. Measure only. Run from the concerto
# checkout root, with this checkout's concerto-core built (dist/) as the now
# side and BEFORE_CORE_DIST the before side's dist/ (the integration head
# without P5-91, built the same way; place it inside packages/concerto-core,
# e.g. packages/concerto-core/dist-before, so it resolves the same
# node_modules). Both sides use the engine this checkout links (P5-91 changes
# no engine code).
#
#   BEFORE_CORE_DIST=packages/concerto-core/dist-before \
#     sh migration/bench/p591-run.sh <out dir>
#
# Writes, per side: weak-<side>.json (weak-collection operations per item,
# p591-load.mjs --mode weak), alloc-<side>.json (JS heap bytes allocated per
# item, --mode alloc) and count-<side>.log (engine crossings per item,
# p515-sweep.mjs --mode count); ab.json (in-process interleaved timing of
# modelfile_new and add_model_file, --mode ab); and time-<round>-<side>.log
# (p515-sweep.mjs --mode time, one process per side, the order swapped every
# round) for modelfile_new, add_model_file and extract_cold.
# Environment: P591_ROUNDS (default 3), P591_SAMPLES (default 100; extract_cold
# takes 30).
set -eu
OUT=$1
mkdir -p "$OUT"
NOW=packages/concerto-core/dist
BEFORE=${BEFORE_CORE_DIST:?set BEFORE_CORE_DIST to the before side dist/}
ROUNDS=${P591_ROUNDS:-3}
SAMPLES=${P591_SAMPLES:-100}

for side in now before; do
  if [ "$side" = now ]; then DIST=$NOW; else DIST=$BEFORE; fi
  node migration/bench/p591-load.mjs --core-dist "$DIST" --mode weak > "$OUT/weak-$side.json"
  node --expose-gc --min-semi-space-size=128 --max-semi-space-size=128 \
    migration/bench/p591-load.mjs --core-dist "$DIST" --mode alloc --items 41 --rounds 11 > "$OUT/alloc-$side.json"
  node migration/bench/p515-sweep.mjs --core-dist "$DIST" --mode count \
    --ops modelfile_new,add_model_file,extract_cold --samples 20 --warmup 3 \
    --out "$OUT/count-$side.json" > "$OUT/count-$side.log" 2>&1
done

node --expose-gc migration/bench/p591-load.mjs --mode ab --core-dist "$NOW" --before-dist "$BEFORE" \
  --items 82 --rounds 31 > "$OUT/ab.json"

r=1
while [ $r -le "$ROUNDS" ]; do
  if [ $((r % 2)) = 1 ]; then ORDER="now before"; else ORDER="before now"; fi
  for side in $ORDER; do
    if [ "$side" = now ]; then DIST=$NOW; else DIST=$BEFORE; fi
    node migration/bench/p515-sweep.mjs --core-dist "$DIST" --ops modelfile_new,add_model_file \
      --samples "$SAMPLES" --warmup 10 --out "$OUT/time-$r-$side-load.json" > "$OUT/time-$r-$side.log" 2>&1
    node migration/bench/p515-sweep.mjs --core-dist "$DIST" --ops extract_cold \
      --samples 30 --warmup 5 --out "$OUT/time-$r-$side-extract.json" >> "$OUT/time-$r-$side.log" 2>&1
  done
  r=$((r + 1))
done
