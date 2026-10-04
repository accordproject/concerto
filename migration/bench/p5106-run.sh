#!/bin/sh
# P5-106 (accordproject/concerto-rust#460, BC-52) benchmark: the rows that
# call the retired JsContext bindings, TS-API x TS 5.0.0, before (the
# integration head) and after (the P5-106 branch), with the P5-96 driver
# (p515-sweep.mjs): the ModelUtil.isAssignableTo-heavy instance rows
# (add_array_value, set_property_value, new_resource) and the subclass
# queries (get_assignable_class_declarations, get_direct_subclasses, added
# to the driver by P5-106); 3 rounds, the order reversed every other round;
# then crossings per item (count mode) on both sides. Measure only.
# Tables: node migration/bench/p5100-table.mjs migration/bench/results/P5-106
#
# Run from the concerto checkout root. Environment:
#   BEFORE_ENGINE  the integration head's concerto-wasm pkg/concerto-engine.cjs
#   BEFORE_DIST    the integration head's concerto-core dist/, inside this
#                  checkout's packages/concerto-core so its dependencies
#                  resolve (with its package.json next to it)
#   AFTER_ENGINE   this branch's concerto-wasm pkg/concerto-engine.cjs
set -u
OUT=${OUT:-migration/bench/results/P5-106}
OPS=add_array_value,set_property_value,new_resource,get_assignable_class_declarations,get_direct_subclasses
REF=migration/oracle/reference/node_modules/@accordproject/concerto-core/dist
BEFORE_DIST=${BEFORE_DIST:-packages/concerto-core/.bench-before/dist}
mkdir -p "$OUT/before" "$OUT/after" "$OUT/ts-reference"
loads() { uptime | sed 's/.*load average[s]*: //'; }
log() { echo "$(date -u +%H:%M:%S) $*" >> "$OUT/run-log.txt"; }
side() {
  case $1 in
    ts-reference) node migration/bench/p515-sweep.mjs --core-dist "$REF" --ops $OPS --samples 30 --warmup 5 --out "$OUT/ts-reference/time-$2.json" ;;
    before) CONCERTO_ENGINE_MODULE=$BEFORE_ENGINE node migration/bench/p515-sweep.mjs --core-dist "$BEFORE_DIST" --ops $OPS --samples 30 --warmup 5 --out "$OUT/before/time-$2.json" ;;
    after) CONCERTO_ENGINE_MODULE=$AFTER_ENGINE node migration/bench/p515-sweep.mjs --ops $OPS --samples 30 --warmup 5 --out "$OUT/after/time-$2.json" ;;
  esac
}
for r in 1 2 3; do
  if [ $((r % 2)) = 1 ]; then ORDER="ts-reference before after"; else ORDER="after before ts-reference"; fi
  for s in $ORDER; do
    log "round $r $s start load $(loads)"
    side $s $r > "$OUT/$s/time-$r.log" 2>&1
    log "round $r $s end exit $? load $(loads)"
  done
done
log "count before start"
CONCERTO_ENGINE_MODULE=$BEFORE_ENGINE node migration/bench/p515-sweep.mjs --core-dist "$BEFORE_DIST" --ops $OPS --mode count --samples 10 --warmup 2 --out "$OUT/before/crossings.json" > "$OUT/before/crossings.log" 2>&1
log "count before end exit $?"
CONCERTO_ENGINE_MODULE=$AFTER_ENGINE node migration/bench/p515-sweep.mjs --ops $OPS --mode count --samples 10 --warmup 2 --out "$OUT/after/crossings.json" > "$OUT/after/crossings.log" 2>&1
log "count after end exit $?"
log "done"
