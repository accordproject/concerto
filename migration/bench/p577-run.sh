#!/bin/sh
# P5-77 (accordproject/concerto-rust#419): the targeted before/after for the
# DCS extract* result path (P5-72 follow-up 4). P5-72's harness
# (p572-run.sh) cut to the four extract* ops, with dcs_decorate and
# dcs_validate as controls: TS 5.0.0, the before side and the now side in
# the same run, three rounds, at crate and TS-API level, behind the same
# quiet gate. As in P5-73 (p573-run.sh), each op runs in its own process,
# so one op's WASM memory and V8 heap do not carry into the next; each
# round's per-op outputs are then folded into the one file per side and
# round that p515-report.mjs reads.
#
#   sh migration/bench/p577-run.sh profiles <out dir>
#   sh migration/bench/p577-run.sh timed <out dir> <now bench bin> <before bench bin>
#
# Environment: BEFORE_CORE_DIST and BEFORE_ENGINE (the before side's
# concerto-core dist and concerto-engine.cjs; the now side is this
# checkout), NOW_TARGET and BEFORE_TARGET (the CARGO_TARGET_DIR each crate
# bench binary was built with, where criterion writes), CONCERTO_REPO (for
# the crate benches' fixtures), P515_SELF (the gate's self-tag, default
# P5-77), P515_GATE_MAX (seconds the gate waits at most), P577_SAMPLES and
# P577_WARMUP (samples and warm-up per op, 30 and 5 as in P5-72); for a
# dry run only, P577_OPS (space-separated) and P577_CRATE_FILTER narrow it.
#
# The profiles phase writes, per side, summary/cpuprof-<op>-<set>.json (the
# V8 stage split, GC included, of a 6-second `--mode loop` run, as P5-72)
# and summary/crossings.json (count mode). The timed phase writes, per side,
# ts-reference-5.0.0-<r>.json, rust-engine-<r>.json and crate-<r>/.
# p577-table.mjs turns both into the tables.
#
# Run from the concerto checkout root.
set -u
PHASE=$1
OUT=$2
REF=migration/oracle/reference/node_modules/@accordproject/concerto-core/dist
SETS="concerto-core-test-data conformance synthetic-large"
OPS=${P577_OPS:-extract_decorators extract_vocabularies extract_cold extract_keep dcs_decorate dcs_validate}
SAMPLES=${P577_SAMPLES:-30}
WARMUP=${P577_WARMUP:-5}
mkdir -p "$OUT/now" "$OUT/before"
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

if [ "$PHASE" = profiles ]; then
  for side in now before; do
    O="$OUT/$side"
    mkdir -p "$O/cpuprof" "$O/summary"
    for op in $OPS; do
      for s in $SETS; do
        d="$O/cpuprof/$op-$s"
        rm -rf "$d"; mkdir -p "$d"
        if [ "$side" = before ]; then
          CONCERTO_ENGINE_MODULE="$BEFORE_ENGINE" node --cpu-prof --cpu-prof-dir="$d" --cpu-prof-interval 250 migration/bench/p515-sweep.mjs --core-dist "$BEFORE_CORE_DIST" --mode loop --ops "$op" --sets "$s" --seconds 6 2> "$d/loop.log"
        else
          node --cpu-prof --cpu-prof-dir="$d" --cpu-prof-interval 250 migration/bench/p515-sweep.mjs --mode loop --ops "$op" --sets "$s" --seconds 6 2> "$d/loop.log"
        fi
        node migration/bench/p515-cpuprof.mjs "$d"/*.cpuprofile --json > "$O/summary/cpuprof-$op-$s.json"
        rm -f "$d"/*.cpuprofile
        echo "$side cpuprof $op/$s done ($(loads))"
      done
    done
    sweep "$side" --ops "$(echo $OPS | tr ' ' ',')" --mode count --samples 10 --warmup 2 --out "$O/summary/crossings.json" > "$O/crossings.log" 2>&1
    echo "$side crossings done ($(loads))"
  done
  echo "profiles done"
  exit 0
fi

if [ "$PHASE" = timed ]; then
  NOW_BIN=$3
  BEFORE_BIN=$4
  MAX=${P515_GATE_MAX:-14400}
  waited=0
  gate() {
    while :; do
      set -- $(loads)
      busy=$(pgrep -fl 'run-ts\.mjs|p5[0-9a-z]*-(sweep|rounds|profile)|--bench|criterion|wasm-instance|(^|/)cargo( |$)|mocha' | grep -v "${P515_SELF:-P5-77}" | grep -v pgrep | wc -l | tr -d ' ')
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
    CARGO_TARGET_DIR="$tgt" "$bin" --bench --warm-up-time 1 --measurement-time 3 "${P577_CRATE_FILTER:-p515/(dcs_|extract_)}" > "$OUT/$side/crate-$r.log" 2>&1
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
