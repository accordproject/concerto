#!/bin/sh
# P5-88 (accordproject/concerto-rust#434): the targeted before/after for the
# productised validation plan. P5-77's harness (p577-run.sh), timed phase
# only, over the six instance ops: TS 5.0.0, the before side (the
# integration head without the plan) and the now side (with it) in the same
# run, three rounds, at crate and TS-API level, behind the same quiet gate.
# Each op runs in its own process; each round's per-op outputs are then
# folded into the one file per side and round that p515-report.mjs reads.
#
#   sh migration/bench/p588-run.sh timed <out dir> <now bench bin> <before bench bin>
#
# Environment: BEFORE_CORE_DIST and BEFORE_ENGINE (the before side's
# concerto-core dist and concerto-engine.cjs; the now side is this
# checkout), NOW_TARGET and BEFORE_TARGET (the CARGO_TARGET_DIR each crate
# bench binary was built with, where criterion writes), CONCERTO_REPO (for
# the crate benches' fixtures), P515_SELF (the gate's self-tag, default
# P5-88), P515_GATE_MAX (seconds the gate waits at most), P588_SAMPLES and
# P588_WARMUP (samples and warm-up per op, 30 and 5 as in P5-72); for a dry
# run only, P588_OPS (space-separated) and P588_CRATE_FILTER narrow it.
#
# p588-table.mjs turns the output into the tables.
#
# Run from the concerto checkout root.
set -u
PHASE=$1
OUT=$2
REF=migration/oracle/reference/node_modules/@accordproject/concerto-core/dist
OPS=${P588_OPS:-from_json to_json new_resource validate set_property_value add_array_value}
SAMPLES=${P588_SAMPLES:-30}
WARMUP=${P588_WARMUP:-5}
mkdir -p "$OUT/now/parts" "$OUT/before/parts"
# Absolute, because crate() copies the criterion estimates from inside the
# target dir (P5-72, P5-74).
OUT=$(CDPATH= cd -- "$OUT" && pwd)

loads() { awk '{print $1" "$2" "$3}' /proc/loadavg; }
log() { echo "$*"; echo "$(date -u +%H:%M:%S) $*" >> "$OUT/timed-loads.txt"; }

sweep() {
  side=$1; shift
  case "$side" in
    before) CONCERTO_ENGINE_MODULE="$BEFORE_ENGINE" node migration/bench/p515-sweep.mjs --core-dist "$BEFORE_CORE_DIST" "$@" ;;
    *) node migration/bench/p515-sweep.mjs "$@" ;;
  esac
}

if [ "$PHASE" = timed ]; then
  NOW_BIN=$3
  BEFORE_BIN=$4
  MAX=${P515_GATE_MAX:-14400}
  waited=0
  gate() {
    while :; do
      set -- $(loads)
      busy=$(pgrep -fa 'run-ts\.mjs|p5[0-9a-z]*-(sweep|rounds|profile)|--bench|criterion|wasm-instance|(^|/)cargo( |$)|mocha' | grep -v "${P515_SELF:-P5-88}" | grep -v pgrep | wc -l | tr -d ' ')
      if awk -v a="$1" -v b="$2" 'BEGIN{exit !(a<2 && b<3)}' && [ "$busy" = 0 ]; then
        return 0
      fi
      if [ $waited -ge "$MAX" ]; then
        log "gate: gave up after ${waited}s (load $1 $2 $3, other benches $busy)"
        exit 20
      fi
      sleep 30; waited=$((waited+30))
    done
  }
  # Folds one round's per-op outputs (<prefix>-<r>-<op>.json) into
  # <prefix>-<r>.json, the file p515-report.mjs reads.
  fold() {
    node -e '
      const fs = require("fs");
      const [out, ...parts] = process.argv.slice(1);
      const runs = parts.map((f) => JSON.parse(fs.readFileSync(f, "utf8")));
      fs.writeFileSync(out, JSON.stringify({ ...runs[0], results: runs.flatMap((r) => r.results), parts }, null, 2));
    ' "$@"
  }
  crate() {
    side=$1; bin=$2; tgt=$3; r=$4
    gate; log "round $r crate-$side start load $(loads)"
    rm -rf "$tgt/criterion/p515"
    CARGO_TARGET_DIR="$tgt" "$bin" --bench --warm-up-time 1 --measurement-time 3 "${P588_CRATE_FILTER:-^p515/((from_json|to_json|validate|set_property_value|add_array_value)/|new_resource/(conformance|synthetic-large))}" > "$OUT/$side/crate-$r.log" 2>&1
    rm -rf "$OUT/$side/crate-$r"; mkdir -p "$OUT/$side/crate-$r"
    (cd "$tgt/criterion/p515" && find . -path '*/new/estimates.json' | while read -r e; do
       id=$(dirname "$(dirname "$e")" | sed 's|^\./||'); mkdir -p "$OUT/$side/crate-$r/$id"; cp "$e" "$OUT/$side/crate-$r/$id/estimates.json"; done)
    cp "$tgt/criterion/p515-n.json" "$OUT/$side/crate-$r/n.json"
    log "round $r crate-$side end load $(loads)"
  }
  for r in 1 2 3; do
    if [ $((r % 2)) = 1 ]; then ORDER="now before"; else ORDER="before now"; fi
    for op in $OPS; do
      gate; log "round $r ts-ref $op start load $(loads)"
      node migration/bench/p515-sweep.mjs --core-dist "$REF" --ops "$op" --samples "$SAMPLES" --warmup "$WARMUP" --out "$OUT/now/parts/ts-reference-5.0.0-$r-$op.json" > "$OUT/now/ts-reference-5.0.0-$r-$op.log" 2>&1
      log "round $r ts-ref $op end load $(loads)"
      for side in $ORDER; do
        gate; log "round $r rust-engine-$side $op start load $(loads)"
        sweep "$side" --ops "$op" --samples "$SAMPLES" --warmup "$WARMUP" --out "$OUT/$side/parts/rust-engine-$r-$op.json" > "$OUT/$side/rust-engine-$r-$op.log" 2>&1
        log "round $r rust-engine-$side $op end load $(loads)"
      done
    done
    fold "$OUT/now/ts-reference-5.0.0-$r.json" $(for op in $OPS; do echo "$OUT/now/parts/ts-reference-5.0.0-$r-$op.json"; done)
    cp "$OUT/now/ts-reference-5.0.0-$r.json" "$OUT/before/ts-reference-5.0.0-$r.json"
    for side in now before; do
      fold "$OUT/$side/rust-engine-$r.json" $(for op in $OPS; do echo "$OUT/$side/parts/rust-engine-$r-$op.json"; done)
    done
    if [ $((r % 2)) = 1 ]; then
      crate now "$NOW_BIN" "$NOW_TARGET" "$r"; crate before "$BEFORE_BIN" "$BEFORE_TARGET" "$r"
    else
      crate before "$BEFORE_BIN" "$BEFORE_TARGET" "$r"; crate now "$NOW_BIN" "$NOW_TARGET" "$r"
    fi
  done
  log "timed done"
  exit 0
fi
echo "unknown phase $PHASE"; exit 2
