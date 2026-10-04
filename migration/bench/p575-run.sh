#!/bin/sh
# P5-75 (accordproject/concerto-rust#417): the targeted benchmark for the
# incremental namespace list. P5-72's timed phase (p572-run.sh: the quiet
# gate, TS 5.0.0 first in every round, the sides' order reversed every other
# round, an absolute output dir), cut down to the ops this task touches and
# its controls, through the TS API only: the change is in concerto-core's
# TypeScript, so the crate is the same on both sides.
#
#   sh migration/bench/p575-run.sh <out dir>
#
# Environment: BEFORE_CORE_DIST (a concerto-core dist built from the
# integration head, before the change), P515_SELF (this run's tag, left out
# of the gate's count of other benchmarks), P515_GATE_MAX (seconds, default
# 14400). Both sides use this checkout's engine (concerto-wasm is
# unchanged).
#
# Per round: TS 5.0.0, `before` and `now`, each with p515-sweep.mjs over
# OPS and p575-change.mjs (the read just after a real change of the same
# manager). Run from the concerto checkout root.
set -u
OUT=$1
REF=migration/oracle/reference/node_modules/@accordproject/concerto-core/dist
OPS=${P575_OPS:-get_namespaces_first,get_namespaces,add_model_file,mm_new}
mkdir -p "$OUT/now" "$OUT/before" "$OUT/ts"
# Absolute, as in p572-run.sh.
OUT=$(CDPATH= cd -- "$OUT" && pwd)

loads() { awk '{print $1" "$2" "$3}' /proc/loadavg; }
log() { echo "$*"; echo "$(date -u +%H:%M:%S) $*" >> "$OUT/timed-loads.txt"; }

MAX=${P515_GATE_MAX:-14400}
waited=0
gate() {
  while :; do
    set -- $(loads)
    busy=$(pgrep -fl 'run-ts\.mjs|p5[0-9a-z]*-(sweep|rounds|profile|change)|--bench|criterion|wasm-instance|(^|/)cargo( |$)|mocha' | grep -v "${P515_SELF:-P5-75}" | grep -v pgrep | wc -l | tr -d ' ')
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

side() {
  name=$1; dist=$2; r=$3
  gate; log "round $r $name start load $(loads)"
  node migration/bench/p515-sweep.mjs --core-dist "$dist" --ops "$OPS" --samples 30 --warmup 5 --out "$OUT/$name/sweep-$r.json" > "$OUT/$name/sweep-$r.log" 2>&1
  node migration/bench/p575-change.mjs --core-dist "$dist" --samples 30 --warmup 5 --out "$OUT/$name/change-$r.json" > "$OUT/$name/change-$r.log" 2>&1
  log "round $r $name end load $(loads)"
}

for r in 1 2 3; do
  side ts "$REF" "$r"
  if [ $((r % 2)) = 1 ]; then ORDER="now before"; else ORDER="before now"; fi
  for s in $ORDER; do
    if [ "$s" = before ]; then side before "$BEFORE_CORE_DIST" "$r"; else side now packages/concerto-core/dist "$r"; fi
  done
done
log "timed done"
