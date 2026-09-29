#!/bin/sh
# P5-48 (accordproject/concerto-rust#369): model loading before and after
# the P5-48 engine changes, measured the P5-28 way (p528-run.sh): the TS
# 5.0.0 reference, the integration head before P5-48 and P5-48 itself,
# timed through the TS API in the same run, in three interleaved rounds,
# each part behind the P5-15 quiet gate (1-min load < 2, 5-min load < 3, no
# other bench, cargo, mocha or oracle replay process). Also the crate
# directly (concerto-core's `load_profile` example, `time` mode, built from
# each side), and TS->WASM crossings per item. Only the load ops. Measure
# only.
#
#   sh migration/bench/p548-run.sh <out dir>
#
# Environment:
#   BEFORE_ENGINE   the pre-P5-48 concerto-wasm pkg/concerto-engine.cjs.
#   NOW_ENGINE      the P5-48 concerto-wasm pkg/concerto-engine.cjs.
#   BEFORE_PROFILE  the pre-P5-48 `load_profile` binary.
#   NOW_PROFILE     the P5-48 `load_profile` binary.
#   P515_SELF       a pattern naming this run's own processes, which the
#                   quiet gate ignores (default P5-48).
#
# Both sides run this checkout's concerto-core dist: P5-48 changes the
# engine only. Writes <out dir>/{ts-reference-5.0.0,now,before}-<round>.json
# (p515-sweep.mjs --mode time), <out dir>/{now,before}-crossings.json
# (--mode count), <out dir>/crate-{now,before}-<round>.tsv and
# <out dir>/timed-loads.txt; p548-table.mjs turns them into the table.
#
# Run from the concerto checkout root.
set -u
OUT=$1
REF=migration/oracle/reference/node_modules/@accordproject/concerto-core/dist
FIX=migration/bench/fixtures/p515
OPS=mm_new,modelfile_new,add_model_file,add_cto_model
mkdir -p "$OUT"

loads() {
  if [ -r /proc/loadavg ]; then awk '{print $1" "$2" "$3}' /proc/loadavg
  else sysctl -n vm.loadavg | tr -d '{}' | awk '{print $1" "$2" "$3}'; fi
}

MAX=${P515_GATE_MAX:-14400}
waited=0
gate() {
  while :; do
    set -- $(loads)
    busy=$(pgrep -fl 'run-ts\.mjs|p5[0-9a-z]*-(sweep|rounds|profile)|--bench|criterion|wasm-instance|(^|/)cargo( |$)|mocha|replay\.js|load_profile' | grep -v "${P515_SELF:-P5-48}" | grep -v pgrep | wc -l | tr -d ' ')
    if awk -v a="$1" -v b="$2" 'BEGIN{exit !(a<2 && b<3)}' && [ "$busy" = 0 ]; then
      return 0
    fi
    if [ $waited -ge "$MAX" ]; then
      echo "gate: gave up after ${waited}s (load $1 $2 $3, other benches $busy)"
      exit 20
    fi
    sleep 30; waited=$((waited+30))
  done
}

sweep() {
  side=$1; shift
  if [ "$side" = before ]; then
    CONCERTO_ENGINE_MODULE="$BEFORE_ENGINE" node migration/bench/p515-sweep.mjs "$@"
  else
    CONCERTO_ENGINE_MODULE="$NOW_ENGINE" node migration/bench/p515-sweep.mjs "$@"
  fi
}

crate() {
  side=$1; shift
  if [ "$side" = before ]; then "$BEFORE_PROFILE" time "$FIX"; else "$NOW_PROFILE" time "$FIX"; fi
}

for side in now before; do
  gate; echo "$side crossings start load $(loads)"
  sweep "$side" --mode count --ops "$OPS" --samples 10 --warmup 2 --out "$OUT/$side-crossings.json" > "$OUT/$side-crossings.log" 2>&1
  echo "$side crossings done ($(loads))"
done

for r in 1 2 3; do
  gate; echo "round $r ts-ref start load $(loads)"
  node migration/bench/p515-sweep.mjs --core-dist "$REF" --ops "$OPS" --samples 30 --warmup 5 --out "$OUT/ts-reference-5.0.0-$r.json" > "$OUT/ts-reference-5.0.0-$r.log" 2>&1
  echo "round $r ts-ref end load $(loads)"
  # Alternate which side goes first, so drift within a round does not
  # favour one side.
  if [ $((r % 2)) = 1 ]; then ORDER="now before"; else ORDER="before now"; fi
  for side in $ORDER; do
    gate; echo "round $r $side start load $(loads)"
    sweep "$side" --ops "$OPS" --samples 30 --warmup 5 --out "$OUT/$side-$r.json" > "$OUT/$side-$r.log" 2>&1
    echo "round $r $side end load $(loads)"
    gate; echo "round $r crate-$side start load $(loads)"
    crate "$side" > "$OUT/crate-$side-$r.tsv" 2>&1
    echo "round $r crate-$side end load $(loads)"
  done
done
echo "timed done"
