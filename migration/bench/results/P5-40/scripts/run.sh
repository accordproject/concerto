#!/bin/sh
# P5-40 (F-B) timed run: three interleaved rounds behind the P5-15/P5-22/P5-30
# quiet gate (1-min load < 2, 5-min load < 3, no other bench/cargo/mocha),
# as P5-41's results/P5-41/scripts/run.sh.
set -u
W=/home/user/wt/P5-40
OUT=$W/p540/out; mkdir -p $OUT
CONCERTO=$W/concerto
REF=$CONCERTO/migration/oracle/reference/node_modules/@accordproject/concerto-core/dist
BASE=$W/base-rust/concerto-wasm/pkg/concerto-engine.cjs
NEW=$W/concerto-rust/concerto-wasm/pkg/concerto-engine.cjs
PERCALL=$W/p540/shims/percall.cjs
RW=$W/concerto-rust/spikes/p530-wasm-profile/scripts/run-wasm.mjs
N=$W/p540/native
D=$W/p540/data
SETS="synthetic-large conformance concerto-core-test-data"
loads() { awk '{print $1" "$2" "$3}' /proc/loadavg; }
MAX=${P540_GATE_MAX:-21600}; waited=0
gate() {
  while :; do
    set -- $(loads)
    busy=$(pgrep -af 'run-ts\.mjs|p5[0-9a-z]*-(sweep|rounds|profile)|--bench|criterion|wasm-instance|(^|/)cargo( |$)|rustc|mocha|valgrind' \
      | grep -v "P5-40" | grep -v pgrep | wc -l | tr -d ' ')
    if awk -v a="$1" -v b="$2" 'BEGIN{exit !(a<2 && b<3)}' && [ "$busy" = 0 ]; then
      echo "gate ok after ${waited}s: load $1 $2 $3" >> $OUT/loads.txt; return 0
    fi
    if [ $waited -ge "$MAX" ]; then echo "gate: gave up after ${waited}s (load $1 $2 $3, busy $busy)" | tee -a $OUT/loads.txt; exit 20; fi
    sleep 30; waited=$((waited+30))
  done
}
part() { name=$1; shift; gate; echo "$name start $(loads)" >> $OUT/loads.txt; "$@"; echo "$name end $(loads)" >> $OUT/loads.txt; }
sweep() { # round, label, env...
  r=$1; label=$2; shift 2
  (cd $CONCERTO && env "$@" node migration/bench/p515-sweep.mjs --ops extract_decorators --samples 30 --warmup 5 \
    --out $OUT/r$r/sweep-$label.json > $OUT/r$r/sweep-$label.log 2>&1)
}
ts_api() {
  r=$1
  (cd $CONCERTO && node migration/bench/p515-sweep.mjs --core-dist $REF --ops extract_decorators --samples 30 --warmup 5 \
    --out $OUT/r$r/sweep-ts.json > $OUT/r$r/sweep-ts.log 2>&1)
  if [ $((r % 2)) = 1 ]; then o="base new"; else o="new base"; fi
  for e in $o; do
    eng=$BASE; [ $e = new ] && eng=$NEW
    sweep $r engine-$e CONCERTO_ENGINE_MODULE=$eng
    sweep $r percall-$e CONCERTO_ENGINE_MODULE=$PERCALL P541_REAL_ENGINE=$eng
  done
}
bindings() {
  r=$1
  if [ $((r % 2)) = 1 ]; then o="base new"; else o="new base"; fi
  for e in $o; do
    eng=$BASE; [ $e = new ] && eng=$NEW
    for s in $SETS; do node $RW --engine $eng --input $D/$s.json --iters 30 --warmup 5 > $OUT/r$r/binding-$e-$s.json; done
  done
}
# Native spike (P5-30 stages, P5-41 direct encode on both sides): base is the
# integration head's concerto-core with the old binding's rebuild
# (P540_REBUILD=binding-old), new is P5-40's with the owned rebuild.
natives() {
  r=$1
  for n in glibc dlmalloc; do for s in $SETS; do
    P530_ENCODE=direct P540_REBUILD=binding-old $N/$n-base $D/$s.json --iters 30 --warmup 5 > $OUT/r$r/native-$n-base-$s.json
    P530_ENCODE=direct P540_REBUILD=owned $N/$n-new $D/$s.json --iters 30 --warmup 5 > $OUT/r$r/native-$n-new-$s.json
  done; done
  if [ $r = 1 ]; then for s in $SETS; do
    P530_ENCODE=direct P540_REBUILD=binding-old $N/count-alloc-base $D/$s.json --iters 3 --warmup 1 > $OUT/r$r/count-alloc-base-$s.json
    P530_ENCODE=direct P540_REBUILD=owned $N/count-alloc-new $D/$s.json --iters 3 --warmup 1 > $OUT/r$r/count-alloc-new-$s.json
  done; fi
}
{ uname -m; nproc; grep -m1 'model name' /proc/cpuinfo; node --version; rustc --version;
  echo "concerto $(git -C $CONCERTO rev-parse --short HEAD)"; echo "concerto-rust base $(git -C $W/base-rust rev-parse --short HEAD), new $(git -C $W/concerto-rust rev-parse --short HEAD) + worktree";
  echo "engine bytes base $(wc -c < $BASE) new $(wc -c < $NEW)"; } > $OUT/env.txt
for r in 1 2 3; do
  mkdir -p $OUT/r$r
  part "round $r ts-api" ts_api $r
  if [ $((r % 2)) = 1 ]; then part "round $r bindings" bindings $r; part "round $r native" natives $r
  else part "round $r native" natives $r; part "round $r bindings" bindings $r; fi
done
echo "timed done" >> $OUT/loads.txt
