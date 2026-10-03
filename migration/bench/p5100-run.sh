#!/bin/sh
# P5-100 (accordproject/concerto-rust#454) benchmark: TS-API x TS 5.0.0,
# before (the integration head) and after (the P5-100 branch), with the P5-96
# driver (p515-sweep.mjs): 3 rounds, the order reversed every other round;
# then crossings per item (count mode) on both sides. Measure only.
# Tables: node migration/bench/p5100-table.mjs migration/bench/results/P5-100
#
# Environment (the paths of the run recorded in results/P5-100):
#   W              the task's work directory, holding concerto/ (this
#                  checkout, built), concerto-rust/ (built), and before/pkg
#                  (the integration head's concerto-wasm pkg)
#   BEFORE_DIST    the integration head's concerto-core dist/, inside this
#                  checkout's packages/concerto-core so its dependencies resolve
W=${W:-/home/user/wt/P5-100}
C=$W/concerto
OUT=$C/migration/bench/results/P5-100
mkdir -p $OUT/before $OUT/after $OUT/ts-reference
cd $C
REF=migration/oracle/reference/node_modules/@accordproject/concerto-core/dist
[ -d $REF ] || REF=/home/user/concerto/migration/oracle/reference/node_modules/@accordproject/concerto-core/dist
BEFORE_DIST=${BEFORE_DIST:-$C/packages/concerto-core/.bench-before/dist}
BEFORE_ENGINE=$W/before/pkg/concerto-engine.cjs
AFTER_ENGINE=$W/concerto-rust/concerto-wasm/pkg/concerto-engine.cjs
loads() { awk '{print $1" "$2" "$3}' /proc/loadavg; }
log() { echo "$(date -u +%H:%M:%S) $*" >> $OUT/run-log.txt; }
side() {
  case $1 in
    ts-reference) node migration/bench/p515-sweep.mjs --core-dist $REF --samples 30 --warmup 5 --out $OUT/ts-reference/time-$2.json ;;
    before) CONCERTO_ENGINE_MODULE=$BEFORE_ENGINE node migration/bench/p515-sweep.mjs --core-dist $BEFORE_DIST --samples 30 --warmup 5 --out $OUT/before/time-$2.json ;;
    after) CONCERTO_ENGINE_MODULE=$AFTER_ENGINE node migration/bench/p515-sweep.mjs --samples 30 --warmup 5 --out $OUT/after/time-$2.json ;;
  esac
}
for r in 1 2 3; do
  if [ $((r % 2)) = 1 ]; then ORDER="ts-reference before after"; else ORDER="after before ts-reference"; fi
  for s in $ORDER; do
    log "round $r $s start load $(loads)"
    side $s $r > $OUT/$s/time-$r.log 2>&1
    log "round $r $s end exit $? load $(loads)"
  done
done
log "count before start"
CONCERTO_ENGINE_MODULE=$BEFORE_ENGINE node migration/bench/p515-sweep.mjs --core-dist $BEFORE_DIST --mode count --samples 10 --warmup 2 --out $OUT/before/crossings.json > $OUT/before/crossings.log 2>&1
log "count before end exit $?"
CONCERTO_ENGINE_MODULE=$AFTER_ENGINE node migration/bench/p515-sweep.mjs --mode count --samples 10 --warmup 2 --out $OUT/after/crossings.json > $OUT/after/crossings.log 2>&1
log "count after end exit $?"
log "done"
