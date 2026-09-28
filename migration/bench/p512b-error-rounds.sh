#!/bin/sh
# P5-12b SPIKE (DO NOT MERGE; accordproject/concerto-rust#292): three
# interleaved rounds of p512b-error-profile.mjs for the TS reference 5.0.0,
# P5-12 variant B, the recommended transport (binary) and the cheap-error
# variant (binary-code).
#
#   sh migration/bench/p512b-error-rounds.sh
#
# Writes results/P5-12b-error-<variant>-<round>.json.
set -eu
cd "$(dirname "$0")/../.."
REF="$PWD/migration/oracle/reference/node_modules/@accordproject/concerto-core/dist"
OUT=migration/bench/results
for round in 1 2 3; do
  echo "round $round, load $(uptime | sed 's/.*averages*: //')"
  BENCH_CORE_DIST="$REF" \
    node migration/bench/p512b-error-profile.mjs --out "$OUT/P5-12b-error-ts-reference-5.0.0-$round.json" | grep total
  CONCERTO_P512_VARIANT=B \
    node migration/bench/p512b-error-profile.mjs --out "$OUT/P5-12b-error-p512-B-$round.json" | grep total
  for t in binary binary-code; do
    CONCERTO_P512_VARIANT=B CONCERTO_P512B_TRANSPORT=$t \
      node migration/bench/p512b-error-profile.mjs --out "$OUT/P5-12b-error-$t-$round.json" | grep total
  done
done
