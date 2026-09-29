#!/bin/sh
# P5-28 (N1, accordproject/concerto-rust#333): addModelFile before and
# after staging with the header in one engine call, measured the P5-22 way
# (p522-run.sh): the TS 5.0.0 reference, the integration head before P5-28
# and P5-28 itself, timed through the TS API in the same run, in three
# interleaved rounds, each part behind the P5-15 quiet gate (1-min load < 2,
# 5-min load < 3, no other bench, cargo or mocha process). Only the load
# ops, the ones the change reaches. Measure only.
#
#   sh migration/bench/p528-run.sh <out dir>
#
# Environment:
#   BEFORE_CORE_DIST  the pre-P5-28 packages/concerto-core/dist (its parent
#                     must hold concerto-core's package.json).
#   BEFORE_ENGINE     the pre-P5-28 concerto-wasm pkg/concerto-engine.cjs.
#   P515_SELF         a pattern naming this run's own processes, which the
#                     quiet gate ignores (default P5-28).
#
# Writes <out dir>/{ts-reference-5.0.0,now,before}-<round>.json (the
# p515-sweep.mjs --mode time output), <out dir>/{now,before}-crossings.json
# (--mode count) and <out dir>/timed-loads.txt; p528-table.mjs turns them
# into the table.
#
# Run from the concerto checkout root.
set -u
OUT=$1
REF=migration/oracle/reference/node_modules/@accordproject/concerto-core/dist
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
    busy=$(pgrep -fl 'run-ts\.mjs|p5[0-9a-z]*-(sweep|rounds|profile)|--bench|criterion|wasm-instance|(^|/)cargo( |$)|mocha' | grep -v "${P515_SELF:-P5-28}" | grep -v pgrep | wc -l | tr -d ' ')
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
    CONCERTO_ENGINE_MODULE="$BEFORE_ENGINE" node migration/bench/p515-sweep.mjs --core-dist "$BEFORE_CORE_DIST" "$@"
  else
    node migration/bench/p515-sweep.mjs "$@"
  fi
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
  done
done
echo "timed done"
