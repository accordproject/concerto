#!/bin/sh
# P5-57: TS-API extract results on the base engine vs the P5-57 engine, the
# resident and the per-call paths: 3 inputs x 3 ops x 3 option sets x 2 calls.
set -eu
W=/home/user/wt/P5-57; P=$W/p557; D=/home/user/wt/P5-30/data
DIST=$W/concerto/packages/concerto-core
BASE=$W/base-rust/concerto-wasm/pkg/concerto-engine.cjs
NEW=$W/concerto-rust/concerto-wasm/pkg/concerto-engine.cjs
for e in base new; do
  eng=$BASE; [ $e = new ] && eng=$NEW
  CONCERTO_ENGINE_MODULE=$eng node $P/scripts/dump.cjs $DIST $D > $P/out/eq-resident-$e.jsonl
  CONCERTO_ENGINE_MODULE=$P/scripts/percall.cjs P541_REAL_ENGINE=$eng node $P/scripts/dump.cjs $DIST $D > $P/out/eq-percall-$e.jsonl
done
for p in resident percall; do
  n=$(wc -l < $P/out/eq-$p-new.jsonl)
  if cmp -s $P/out/eq-$p-base.jsonl $P/out/eq-$p-new.jsonl; then echo "$p: $n cases, identical"; else echo "$p: DIFFER"; exit 1; fi
done
cmp -s $P/out/eq-resident-new.jsonl $P/out/eq-percall-new.jsonl && echo "resident = percall (new)" || echo "resident != percall (new)"
