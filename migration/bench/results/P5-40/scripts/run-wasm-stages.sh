#!/bin/sh
# P5-40: the P5-30 spike's stages inside WASM (shipped build settings, -O3
# wasm-opt), base vs new concerto-core, 3 interleaved rounds behind the same
# quiet gate as run.sh. In WASM the spike's rebuild stage is P5-30's original
# (by reference, no array clone) on both sides, so extract and drop carry the
# difference.
set -u
W=/home/user/wt/P5-40; OUT=$W/p540/out; D=$W/p540/data
RW=$W/concerto-rust/spikes/p530-wasm-profile/scripts/run-wasm.mjs
SETS="synthetic-large conformance concerto-core-test-data"
loads() { awk '{print $1" "$2" "$3}' /proc/loadavg; }
waited=0
gate() {
  while :; do
    set -- $(loads)
    busy=$(pgrep -af 'run-ts\.mjs|replay\.js|p5[0-9a-z]*-(sweep|rounds|profile)|--bench|criterion|wasm-instance|(^|/)cargo( |$)|rustc|mocha|valgrind' | grep -v "P5-40" | grep -v pgrep | wc -l | tr -d ' ')
    if awk -v a="$1" -v b="$2" 'BEGIN{exit !(a<2 && b<3)}' && [ "$busy" = 0 ]; then echo "gate ok after ${waited}s: load $1 $2 $3" >> $OUT/loads-wasm-stages.txt; return 0; fi
    [ $waited -ge 21600 ] && { echo "gate: gave up" >> $OUT/loads-wasm-stages.txt; exit 20; }
    sleep 30; waited=$((waited+30))
  done
}
for r in 1 2 3; do
  gate; echo "round $r start $(loads)" >> $OUT/loads-wasm-stages.txt
  if [ $((r % 2)) = 1 ]; then o="base new"; else o="new base"; fi
  for e in $o; do for s in $SETS; do
    node $RW --pkg $W/p540/wasm/$e --input $D/$s.json --iters 30 --warmup 5 > $OUT/r$r/wasm-stages-$e-$s.json
  done; done
  echo "round $r end $(loads)" >> $OUT/loads-wasm-stages.txt
done
