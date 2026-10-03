#!/bin/sh
# P5-80 (accordproject/concerto-rust#424), analysis only: the validation
# plan's before/after. P5-77's cut-down harness (p577-run.sh) over the six
# instance ops, with mm_new, modelfile_new and dcs_decorate as controls:
# TS 5.0.0, the prototype engine with the plan off and with it on (the same
# build, switched by lib/p580-plan-switch.cjs), three rounds, at crate and
# TS-API level, behind the quiet gate. Each op runs in its own process.
#
#   sh migration/bench/p580-run.sh timed <out dir> <crate bench bin>
#
# Environment: NOW_TARGET (the CARGO_TARGET_DIR the crate bench binary was
# built with, where criterion writes), CONCERTO_REPO (the crate bench's
# fixtures), P515_SELF (the gate's self-tag, default P5-80), P515_GATE_MAX,
# P580_SAMPLES and P580_WARMUP (30 and 5, as in P5-72); for a dry run only,
# P580_OPS and P580_CRATE_FILTER narrow it.
#
# The crate side runs criterion's p515 sweep twice per round, with
# CONCERTO_VALIDATION_PLAN=0 and =1 (the bench binary reads it through
# benches/benches/p515_sweep.rs's P5-80 hook). Writes, per side (plan-off,
# plan-on), ts-reference-5.0.0-<r>.json, rust-engine-<r>.json and
# crate-<r>/, which p515-report.mjs reads.
#
# Run from the concerto checkout root.
set -u
PHASE=$1
OUT=$2
REF=migration/oracle/reference/node_modules/@accordproject/concerto-core/dist
OPS=${P580_OPS:-from_json to_json new_resource validate set_property_value add_array_value mm_new modelfile_new dcs_decorate}
SAMPLES=${P580_SAMPLES:-30}
WARMUP=${P580_WARMUP:-5}
SIDES="plan-off plan-on"
for side in $SIDES; do mkdir -p "$OUT/$side/parts"; done
OUT=$(cd "$OUT" && pwd)

loads() { awk '{print $1" "$2" "$3}' /proc/loadavg; }
log() { echo "$*"; echo "$(date -u +%H:%M:%S) $*" >> "$OUT/timed-loads.txt"; }
flag() { case "$1" in plan-off) echo 0 ;; *) echo 1 ;; esac; }

if [ "$PHASE" != timed ]; then echo "unknown phase $PHASE"; exit 2; fi
BIN=$3
MAX=${P515_GATE_MAX:-14400}
waited=0
gate() {
  while :; do
    set -- $(loads)
    # -fa, not -fl: with -fl the self-filter never matches (#424 rules).
    busy=$(pgrep -fa 'run-ts\.mjs|p5[0-9a-z]*-(sweep|rounds|profile)|--bench|criterion|wasm-instance|(^|/)cargo( |$)|mocha' | grep -v "${P515_SELF:-P5-80}" | grep -v pgrep | wc -l | tr -d ' ')
    if awk -v a="$1" -v b="$2" 'BEGIN{exit !(a<2 && b<3)}' && [ "$busy" = 0 ]; then
      return 0
    fi
    if [ $waited -ge "$MAX" ]; then
      log "gate: gave up after ${waited}s (load $1 $2 $3, other benches $busy)"
      exit 20
    fi
    sleep 30; waited=$((waited+30))
  done
}
fold() {
  node -e '
    const fs = require("fs");
    const [out, ...parts] = process.argv.slice(1);
    const runs = parts.map((f) => JSON.parse(fs.readFileSync(f, "utf8")));
    fs.writeFileSync(out, JSON.stringify({ ...runs[0], results: runs.flatMap((r) => r.results), parts }, null, 2));
  ' "$@"
}
crate() {
  side=$1; r=$2
  gate; log "round $r crate-$side start load $(loads)"
  rm -rf "$NOW_TARGET/criterion/p515"
  CONCERTO_VALIDATION_PLAN=$(flag "$side") CARGO_TARGET_DIR="$NOW_TARGET" "$BIN" --bench --warm-up-time 1 --measurement-time 3 "${P580_CRATE_FILTER:-^p515/((from_json|to_json|validate|set_property_value|add_array_value|mm_new|modelfile_new|dcs_decorate)/|new_resource/(conformance|synthetic-large))}" > "$OUT/$side/crate-$r.log" 2>&1
  rm -rf "$OUT/$side/crate-$r"; mkdir -p "$OUT/$side/crate-$r"
  (cd "$NOW_TARGET/criterion/p515" && find . -path '*/new/estimates.json' | while read -r e; do
     id=$(dirname "$(dirname "$e")" | sed 's|^\./||'); mkdir -p "$OUT/$side/crate-$r/$id"; cp "$e" "$OUT/$side/crate-$r/$id/estimates.json"; done)
  cp "$NOW_TARGET/criterion/p515-n.json" "$OUT/$side/crate-$r/n.json"
  log "round $r crate-$side end load $(loads)"
}
for r in 1 2 3; do
  if [ $((r % 2)) = 1 ]; then ORDER="plan-off plan-on"; else ORDER="plan-on plan-off"; fi
  for op in $OPS; do
    gate; log "round $r ts-ref $op start load $(loads)"
    node migration/bench/p515-sweep.mjs --core-dist "$REF" --ops "$op" --samples "$SAMPLES" --warmup "$WARMUP" --out "$OUT/plan-off/parts/ts-reference-5.0.0-$r-$op.json" > "$OUT/plan-off/ts-reference-5.0.0-$r-$op.log" 2>&1
    log "round $r ts-ref $op end load $(loads)"
    for side in $ORDER; do
      gate; log "round $r rust-engine-$side $op start load $(loads)"
      CONCERTO_VALIDATION_PLAN=$(flag "$side") node -r ./migration/bench/lib/p580-plan-switch.cjs migration/bench/p515-sweep.mjs --ops "$op" --samples "$SAMPLES" --warmup "$WARMUP" --out "$OUT/$side/parts/rust-engine-$r-$op.json" > "$OUT/$side/rust-engine-$r-$op.log" 2>&1
      log "round $r rust-engine-$side $op end load $(loads)"
    done
  done
  fold "$OUT/plan-off/ts-reference-5.0.0-$r.json" $(for op in $OPS; do echo "$OUT/plan-off/parts/ts-reference-5.0.0-$r-$op.json"; done)
  cp "$OUT/plan-off/ts-reference-5.0.0-$r.json" "$OUT/plan-on/ts-reference-5.0.0-$r.json"
  for side in $SIDES; do
    fold "$OUT/$side/rust-engine-$r.json" $(for op in $OPS; do echo "$OUT/$side/parts/rust-engine-$r-$op.json"; done)
  done
  if [ $((r % 2)) = 1 ]; then crate plan-off "$r"; crate plan-on "$r"; else crate plan-on "$r"; crate plan-off "$r"; fi
done
log "timed done"
exit 0
