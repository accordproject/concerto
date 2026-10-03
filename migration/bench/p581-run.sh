#!/bin/sh
# P5-81 (accordproject/concerto-rust#425): speed of the table-driven
# metamodel decoder against the serde-derived one (analysis only). P5-72's
# harness (as cut down by P5-77, p577-run.sh) on the load ops the decoder is
# on: modelfile_new, add_model_file and add_cto_model, with mm_new and
# dcs_decorate as controls. TS 5.0.0, the derived engine and the table
# engine in the same run, three rounds, at crate and TS-API level, on all
# three sets, behind the quiet gate. Each op runs in its own process, as in
# P5-73/P5-77; each round's per-op outputs are folded into the one file per
# side and round that p515-report.mjs reads.
#
#   sh migration/bench/p581-run.sh timed <out dir> <table bench bin> <derived bench bin>
#
# Environment: TABLE_ENGINE and DERIVED_ENGINE (the two concerto-engine.cjs
# builds, concerto-wasm `build.sh` with and without `--features
# table-decoder`; both run on this checkout's concerto-core dist),
# TABLE_TARGET and DERIVED_TARGET (the CARGO_TARGET_DIR each crate bench
# binary was built with, where criterion writes), CONCERTO_REPO (for the
# crate benches' fixtures), P515_SELF (the gate's self-tag, default P5-81),
# P515_GATE_MAX (seconds the gate waits at most), P581_SAMPLES and
# P581_WARMUP (samples and warm-up per op, 30 and 5 as in P5-72); for a dry
# run only, P581_OPS (space-separated) and P581_CRATE_FILTER narrow it.
#
# Sides: `now` is the table engine, `before` the derived one. The gate
# matches other work with `pgrep -fa` (the full command line), so the
# self-tag filter sees it; `pgrep -fl` prints only the process name, so its
# self-filter never matches and a leftover launcher shell can deadlock the
# gate (2026-10-02).
#
# Run from the concerto checkout root. p581-table.mjs turns the output into
# the tables.
set -u
PHASE=$1
OUT=$2
REF=migration/oracle/reference/node_modules/@accordproject/concerto-core/dist
OPS=${P581_OPS:-modelfile_new add_model_file add_cto_model mm_new dcs_decorate}
SAMPLES=${P581_SAMPLES:-30}
WARMUP=${P581_WARMUP:-5}
SELF=${P515_SELF:-P5-81}
mkdir -p "$OUT/now/parts" "$OUT/before/parts"
OUT=$(cd "$OUT" && pwd)

loads() { awk '{print $1" "$2" "$3}' /proc/loadavg; }
log() { echo "$*"; echo "$(date -u +%H:%M:%S) $*" >> "$OUT/timed-loads.txt"; }

sweep() {
  side=$1; shift
  case "$side" in
    before) CONCERTO_ENGINE_MODULE="$DERIVED_ENGINE" node migration/bench/p515-sweep.mjs "$@" ;;
    *) CONCERTO_ENGINE_MODULE="$TABLE_ENGINE" node migration/bench/p515-sweep.mjs "$@" ;;
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
      busy=$(pgrep -fa 'run-ts\.mjs|p5[0-9a-z]*-(sweep|rounds|profile)|--bench|criterion|wasm-instance|(^|/)cargo( |$)|mocha' | grep -v "$SELF" | grep -v pgrep | wc -l | tr -d ' ')
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
    CARGO_TARGET_DIR="$tgt" "$bin" --bench --warm-up-time 1 --measurement-time 3 "${P581_CRATE_FILTER:-p515/(mm_new|modelfile_new|add_model_file|add_cto_model|dcs_decorate)/}" > "$OUT/$side/crate-$r.log" 2>&1
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
      crate now "$NOW_BIN" "$TABLE_TARGET" "$r"; crate before "$BEFORE_BIN" "$DERIVED_TARGET" "$r"
    else
      crate before "$BEFORE_BIN" "$DERIVED_TARGET" "$r"; crate now "$NOW_BIN" "$TABLE_TARGET" "$r"
    fi
  done
  log "timed done"
  exit 0
fi
echo "unknown phase $PHASE"; exit 2
