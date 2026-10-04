#!/bin/sh
# P5-56 (T2, F-A2) timed run: three interleaved rounds behind the P5-15/
# P5-22/P5-30/P5-40/P5-57 quiet gate (1-min load < 2, 5-min load < 3, no
# other bench/cargo/rustc/mocha process), as results/P5-57/scripts/run.sh.
# Each round runs p515-sweep.mjs --ops extract_keep,extract_decorators
# through the TS API on TS 5.0.0, and on one P5-56 engine build twice:
# "before", with the memo off (before.cjs: every extract drops the handle's
# memo first, so each call runs in full, the integration head's path), and
# "new". extract_keep is the repeated DecoratorManager.extractDecorators with
# removeDecoratorsFromModel: false on the same manager (the memo's case; the
# warm-up fills it); extract_decorators (removeDecoratorsFromModel: true) is
# the control, which never reads the memo. The engine order is alternated
# per round.
set -u
W=${P556_W:-/home/user/wt/P5-56-T2}
CONCERTO=$W/concerto
OUT=${P556_OUT:-$CONCERTO/migration/bench/results/P5-56}
REF=$CONCERTO/migration/oracle/reference/node_modules/@accordproject/concerto-core/dist
ENGINE=$W/concerto-rust/concerto-wasm/pkg/concerto-engine.cjs
BEFORE=$CONCERTO/migration/bench/results/P5-56/scripts/before.cjs
OPS=extract_keep,extract_decorators
loads() { awk '{print $1" "$2" "$3}' /proc/loadavg; }
MAX=${P556_GATE_MAX:-21600}; waited=0
gate() {
  while :; do
    set -- $(loads)
    busy=$(pgrep -af 'run-ts\.mjs|replay\.js|p5[0-9a-z]*-(sweep|rounds|profile)|--bench|criterion|wasm-instance|(^|/)cargo( |$)|rustc|mocha|valgrind' \
      | grep -v pgrep | wc -l | tr -d ' ')
    if awk -v a="$1" -v b="$2" 'BEGIN{exit !(a<2 && b<3)}' && [ "$busy" = 0 ]; then
      echo "gate ok after ${waited}s: load $1 $2 $3" >> $OUT/loads.txt; return 0
    fi
    if [ $waited -ge "$MAX" ]; then echo "gate: gave up after ${waited}s (load $1 $2 $3, busy $busy)" | tee -a $OUT/loads.txt; exit 20; fi
    sleep 30; waited=$((waited+30))
  done
}
part() { name=$1; shift; gate; echo "$name start $(loads)" >> $OUT/loads.txt; "$@"; echo "$name end $(loads)" >> $OUT/loads.txt; }
sweep() { # round, label, sweep args / env...
  r=$1; label=$2; shift 2
  (cd $CONCERTO && env "$@" node migration/bench/p515-sweep.mjs --ops $OPS --samples 30 --warmup 5 \
    --out $OUT/r$r/sweep-$label.json > $OUT/r$r/sweep-$label.log 2>&1)
}
round() {
  r=$1
  (cd $CONCERTO && node migration/bench/p515-sweep.mjs --core-dist $REF --ops $OPS --samples 30 --warmup 5 \
    --out $OUT/r$r/sweep-ts.json > $OUT/r$r/sweep-ts.log 2>&1)
  if [ $((r % 2)) = 1 ]; then o="before new"; else o="new before"; fi
  for e in $o; do
    if [ $e = new ]; then sweep $r new CONCERTO_ENGINE_MODULE=$ENGINE
    else sweep $r before CONCERTO_ENGINE_MODULE=$BEFORE P556_REAL_ENGINE=$ENGINE; fi
  done
  # The split of the repeated call (split.cjs): engine call, P5-49 shape
  # check and the rest, with finalizers running between calls.
  for set in synthetic-large conformance concerto-core-test-data; do
    for e in $o; do
      if [ $e = new ]; then nm=0; else nm=1; fi
      CONCERTO_ENGINE_MODULE=$ENGINE P556_NOMEMO=$nm node --expose-gc $CONCERTO/migration/bench/results/P5-56/scripts/split.cjs \
        $set 30 5 >> $OUT/r$r/split-$e.jsonl 2>> $OUT/r$r/split.log
    done
  done
}
mkdir -p $OUT
{ uname -m; nproc; grep -m1 'model name' /proc/cpuinfo; node --version; rustc --version;
  echo "concerto $(git -C $CONCERTO rev-parse --short HEAD) (+ working tree)"; echo "concerto-rust $(git -C $W/concerto-rust rev-parse --short HEAD)";
  echo "engine bytes $(wc -c < $ENGINE)"; } > $OUT/env.txt
for r in 1 2 3; do
  mkdir -p $OUT/r$r
  part "round $r" round $r
done
echo "timed done" >> $OUT/loads.txt
