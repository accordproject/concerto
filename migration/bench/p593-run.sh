#!/bin/sh
# P5-93 (accordproject/concerto-rust#443): the typed read's allocations and
# time before and after its allocation cuts, in one run. Run from the
# concerto checkout root, with this checkout's concerto-core built.
#
#   sh migration/bench/p593-run.sh <out dir>
#
# Environment (each required):
#   BEFORE_ENGINE  concerto-engine.cjs built from concerto-rust before the
#                  change (p590-engine-build.sh <tree> <out> shipped)
#   AFTER_ENGINE   the same from the change's tree (or its build.sh pkg/)
#   BEFORE_BIN     concerto-rust benches' p590_typed_read example, before
#   AFTER_BIN      the same, after
#   P593_GATE_MAX  seconds the quiet gate waits at most before a part runs
#                  anyway (default 1800); every wait and every give-up is
#                  logged in <out dir>/timed-loads.txt
#
# Three rounds, the order of the sides rotated every round, each part behind
# the quiet gate of p590-run.sh (1-minute load < 2, 5-minute < 3, no other
# bench, cargo or mocha process):
# - the TS-API ops modelfile_new, add_model_file and add_cto_model, one op
#   per process (300 samples, 30 warm-up), on TS 5.0.0 (the oracle
#   reference) and on the Rust engine through the TS API, before and after
#   (CONCERTO_ENGINE_MODULE);
# - the WASM typed read alone (p590-typedread.mjs), before and after;
# - the native typed read (p590_typed_read time), before and after.
# Then the native allocation counts (p590_typed_read alloc), before and
# after, once each (they do not vary).
set -u
mkdir -p "$1/timed"
OUT=$(CDPATH= cd -- "$1" && pwd)
: "${BEFORE_ENGINE:?}" "${AFTER_ENGINE:?}" "${BEFORE_BIN:?}" "${AFTER_BIN:?}"
REF=migration/oracle/reference/node_modules/@accordproject/concerto-core/dist
OPS="modelfile_new add_model_file add_cto_model"
MAX=${P593_GATE_MAX:-1800}

loads() { awk '{print $1" "$2" "$3}' /proc/loadavg; }
log() { echo "$*"; echo "$(date -u +%H:%M:%S) $*" >> "$OUT/timed-loads.txt"; }
gate() {
  waited=0
  while :; do
    set -- $(loads)
    busy=$(pgrep -fl 'run-ts\.mjs|p5[0-9a-z]*-(sweep|rounds|profile|typedread)|--bench|criterion|wasm-instance|(^|/)cargo( |$)|mocha' | grep -v P5-93 | grep -v pgrep | wc -l | tr -d ' ')
    if awk -v a="$1" -v b="$2" 'BEGIN{exit !(a<2 && b<3)}' && [ "$busy" = 0 ]; then
      [ $waited -gt 0 ] && log "gate: quiet after ${waited}s"
      return 0
    fi
    if [ $waited -ge "$MAX" ]; then
      log "gate: not quiet after ${waited}s (load $1 $2 $3, other processes $busy); running anyway"
      return 0
    fi
    sleep 30; waited=$((waited+30))
  done
}

rotate() { # round -> order of three sides
  case $(($1 % 3)) in 1) echo "ts before after" ;; 2) echo "before after ts" ;; *) echo "after ts before" ;; esac
}

for r in 1 2 3; do
  for op in $OPS; do
    for side in $(rotate $r); do
      gate; log "round $r $side $op start load $(loads)"
      case $side in
        ts) node migration/bench/p515-sweep.mjs --core-dist $REF --ops "$op" --samples 300 --warmup 30 --out "$OUT/timed/ts-$r-$op.json" > "$OUT/timed/ts-$r-$op.log" 2>&1 ;;
        before) CONCERTO_ENGINE_MODULE="$BEFORE_ENGINE" node migration/bench/p515-sweep.mjs --ops "$op" --samples 300 --warmup 30 --out "$OUT/timed/before-$r-$op.json" > "$OUT/timed/before-$r-$op.log" 2>&1 ;;
        after) CONCERTO_ENGINE_MODULE="$AFTER_ENGINE" node migration/bench/p515-sweep.mjs --ops "$op" --samples 300 --warmup 30 --out "$OUT/timed/after-$r-$op.json" > "$OUT/timed/after-$r-$op.log" 2>&1 ;;
      esac
      log "round $r $side $op end load $(loads)"
    done
  done
  if [ $((r % 2)) = 1 ]; then ORDER="before after"; else ORDER="after before"; fi
  for side in $ORDER; do
    if [ $side = before ]; then E=$BEFORE_ENGINE; B=$BEFORE_BIN; else E=$AFTER_ENGINE; B=$AFTER_BIN; fi
    gate; log "round $r typedread-$side start load $(loads)"
    node migration/bench/p590-typedread.mjs --engine "$E" --out "$OUT/timed/typedread-$side-$r.json" > "$OUT/timed/typedread-$side-$r.log" 2>&1
    log "round $r typedread-$side end load $(loads)"
    gate; log "round $r native-$side start load $(loads)"
    "$B" time migration/bench/fixtures/p515 > "$OUT/timed/native-$side-$r.tsv" 2>&1
    log "round $r native-$side end load $(loads)"
  done
done
"$BEFORE_BIN" alloc migration/bench/fixtures/p515 > "$OUT/timed/native-alloc-before.tsv" 2>&1
"$AFTER_BIN" alloc migration/bench/fixtures/p515 > "$OUT/timed/native-alloc-after.tsv" 2>&1
log "timed done"
