#!/bin/sh
# P5-73 (accordproject/concerto-rust#414): the targeted before/after for the
# fixed system models' precomputed verdict. P5-72's TS-API timed phase
# (p572-run.sh), cut to `mm_new` and the two load controls
# (`modelfile_new`, `add_model_file`), with TS 5.0.0, the before side and
# the now side in the same run, three rounds, behind the same quiet gate.
# Each op runs in its own process: in one process the ops after `mm_new`
# and `modelfile_new` can hit a V8 WeakMap stall in engine/views.ts
# `stages` (about 120 us per `stages.set`, from the GC's timing), on the
# before side as on the now side, which would swamp the controls.
#
#   sh migration/bench/p573-run.sh <out dir>
#
# Environment: BEFORE_CORE_DIST and BEFORE_ENGINE (the before side's
# concerto-core dist and concerto-engine.cjs), P515_SELF (the gate's
# self-tag), P515_GATE_MAX (seconds the gate waits at most), P573_SAMPLES
# and P573_WARMUP (the timed run's samples and warm-up per op, 30 and 5 as
# in P5-72 by default; 300 and 30 for the reported run). The now side is
# this checkout. Run from the concerto checkout root.
set -u
OUT=$1
REF=migration/oracle/reference/node_modules/@accordproject/concerto-core/dist
OPS=mm_new,modelfile_new,add_model_file
mkdir -p "$OUT/now" "$OUT/before" "$OUT/now-mmvoff"
OUT=$(cd "$OUT" && pwd)
MMVOFF='{"metamodelValidation":false}'
SAMPLES=${P573_SAMPLES:-30}
WARMUP=${P573_WARMUP:-5}

loads() { awk '{print $1" "$2" "$3}' /proc/loadavg; }
log() { echo "$*"; echo "$(date -u +%H:%M:%S) $*" >> "$OUT/timed-loads.txt"; }

MAX=${P515_GATE_MAX:-14400}
waited=0
gate() {
  while :; do
    set -- $(loads)
    busy=$(pgrep -fl 'run-ts\.mjs|p5[0-9a-z]*-(sweep|rounds|profile)|--bench|criterion|wasm-instance|(^|/)cargo( |$)|mocha' | grep -v "${P515_SELF:-P5-73}" | grep -v pgrep | wc -l | tr -d ' ')
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

sweep() {
  side=$1; shift
  ops=$OPS
  if [ "$1" = --only ]; then ops=$2; shift 2; fi
  case "$side" in
    before) CONCERTO_ENGINE_MODULE="$BEFORE_ENGINE" node migration/bench/p515-sweep.mjs --core-dist "$BEFORE_CORE_DIST" --ops "$ops" "$@" ;;
    now-mmvoff) node migration/bench/p515-sweep.mjs --mm-options "$MMVOFF" --ops "$ops" "$@" ;;
    *) node migration/bench/p515-sweep.mjs --ops "$ops" "$@" ;;
  esac
}

for side in before now now-mmvoff; do
  sweep "$side" --mode count --samples 10 --warmup 2 --out "$OUT/$side/crossings.json" > "$OUT/$side/crossings.log" 2>&1
done

for r in 1 2 3; do
  for op in $(echo "$OPS" | tr ',' ' '); do
    gate; log "round $r ts-ref $op start load $(loads)"
    node migration/bench/p515-sweep.mjs --core-dist "$REF" --ops "$op" --samples "$SAMPLES" --warmup "$WARMUP" --out "$OUT/now/ts-reference-5.0.0-$r-$op.json" > "$OUT/now/ts-reference-5.0.0-$r-$op.log" 2>&1
    cp "$OUT/now/ts-reference-5.0.0-$r-$op.json" "$OUT/before/ts-reference-5.0.0-$r-$op.json"
    cp "$OUT/now/ts-reference-5.0.0-$r-$op.json" "$OUT/now-mmvoff/ts-reference-5.0.0-$r-$op.json"
    log "round $r ts-ref $op end load $(loads)"
    if [ $((r % 2)) = 1 ]; then ORDER="now now-mmvoff before"; else ORDER="before now-mmvoff now"; fi
    for side in $ORDER; do
      gate; log "round $r rust-engine-$side $op start load $(loads)"
      sweep "$side" --only "$op" --samples "$SAMPLES" --warmup "$WARMUP" --out "$OUT/$side/rust-engine-$r-$op.json" > "$OUT/$side/rust-engine-$r-$op.log" 2>&1
      log "round $r rust-engine-$side $op end load $(loads)"
    done
  done
done
log "timed done"
