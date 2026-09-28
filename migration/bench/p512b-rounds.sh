#!/bin/sh
# P5-12b SPIKE (DO NOT MERGE; accordproject/concerto-rust#292): three
# interleaved rounds of run-ts.mjs workload 3 (synthetic, 500) for the TS
# reference 5.0.0, P5-12 variant B, and each P5-12b transport.
#
#   [BENCH_ARGS="--samples 150 --warmup 20"] sh migration/bench/p512b-rounds.sh
#
# Writes results/P5-12b-<variant>-<round>.json.
set -eu
cd "$(dirname "$0")/../.."
REF="$PWD/migration/oracle/reference/node_modules/@accordproject/concerto-core/dist"
OUT=migration/bench/results
for round in 1 2 3; do
  echo "round $round, load $(uptime | sed 's/.*averages*: //')"
  BENCH_WORKLOADS=instance BENCH_CORE_DIST="$REF" \
    node migration/bench/run-ts.mjs ${BENCH_ARGS:-} --out "$OUT/P5-12b-ts-reference-5.0.0-$round.json" 2>/dev/null | grep 'validate()'
  BENCH_WORKLOADS=instance CONCERTO_P512_VARIANT=B \
    node migration/bench/run-ts.mjs ${BENCH_ARGS:-} --out "$OUT/P5-12b-p512-B-$round.json" 2>/dev/null | grep 'validate()'
  for t in json json-scratch object binary binary-scratch; do
    BENCH_WORKLOADS=instance CONCERTO_P512_VARIANT=B CONCERTO_P512B_TRANSPORT=$t \
      node migration/bench/run-ts.mjs ${BENCH_ARGS:-} --out "$OUT/P5-12b-$t-$round.json" 2>/dev/null | sed "s/^/$t /" | grep 'validate()'
  done
done
