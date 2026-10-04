#!/bin/sh
# P5-22 (accordproject/concerto-rust#326): the P5-15 sweep (#309) repeated
# after F1-F4, with the pre-F1 integration head timed in the same run so
# the before/now comparison is like-for-like on one machine. Measure only.
#
#   sh migration/bench/p522-run.sh <phase> <out dir> <now bench bin> <before bench bin>
#
# Environment:
#   NOW_TARGET, BEFORE_TARGET  the CARGO_TARGET_DIRs the two crate bench
#                              binaries were built into (criterion writes
#                              its estimates there).
#   BEFORE_CORE_DIST           the pre-F1 concerto checkout's
#                              packages/concerto-core/dist.
#   BEFORE_ENGINE              the pre-F1 concerto-wasm pkg/concerto-engine.cjs.
#   P515_SELF                  a pattern naming this run's own processes,
#                              which the quiet gate ignores.
#   P522_OPS                   optional (P5-27): a comma-separated subset of
#                              the sweep's ops, for both phases (default:
#                              every op).
#   P522_CRATE                 optional (P5-27): 0 skips the crate-direct
#                              criterion rounds (for a change outside the
#                              crates, where both sides run the same crate
#                              code); NOW_BIN and BEFORE_BIN are then unused.
#
# Writes <out dir>/now/ and <out dir>/before/ in the layout p515-report.mjs
# reads; both get the same TS 5.0.0 reference rounds, since TS 5.0.0 is the
# same code on either side.
#
# phase:
#   profiles  V8 CPU profiles (stage split) and crossing counts of the TS-API
#             path, for each side. No native profiles: `sample` is macOS
#             only. No gate.
#   timed     three interleaved rounds of TS 5.0.0, Rust engine through the
#             TS API (now, before) and crate-direct criterion (now,
#             before), each part behind the P5-15 quiet gate (1-min load < 2,
#             5-min load < 3, no other bench, cargo or mocha process).
#
# Run from the concerto checkout root.
set -u
PHASE=$1
OUT=$2
NOW_BIN=$3
BEFORE_BIN=$4
REF=migration/oracle/reference/node_modules/@accordproject/concerto-core/dist
SETS="concerto-core-test-data conformance synthetic-large"
ALL_OPS="mm_new modelfile_new add_model_file add_cto_model from_json to_json new_resource validate set_property_value add_array_value dcs_decorate dcs_validate extract_decorators extract_vocabularies get_type resolve_type get_decorators get_namespaces derives_from is_assignable_to"
if [ -n "${P522_OPS:-}" ]; then
  OPS=$(echo "$P522_OPS" | tr ',' ' ')
  OPS_ARG="--ops $P522_OPS"
else
  OPS=$ALL_OPS
  OPS_ARG=""
fi
mkdir -p "$OUT/now" "$OUT/before"
# Absolute, because crate() copies the criterion estimates from inside the
# target dir (a relative OUT there loses every crate round).
OUT=$(CDPATH= cd -- "$OUT" && pwd)

loads() {
  if [ -r /proc/loadavg ]; then awk '{print $1" "$2" "$3}' /proc/loadavg
  else sysctl -n vm.loadavg | tr -d '{}' | awk '{print $1" "$2" "$3}'; fi
}

# side -> extra args / env for p515-sweep.mjs
sweep() {
  side=$1; shift
  if [ "$side" = before ]; then
    CONCERTO_ENGINE_MODULE="$BEFORE_ENGINE" node migration/bench/p515-sweep.mjs --core-dist "$BEFORE_CORE_DIST" "$@"
  else
    node migration/bench/p515-sweep.mjs "$@"
  fi
}

if [ "$PHASE" = profiles ]; then
  for side in now before; do
    O="$OUT/$side"
    mkdir -p "$O/cpuprof" "$O/summary"
    for op in $OPS; do
      for s in $SETS; do
        [ "$op" = mm_new ] && [ "$s" != conformance ] && continue
        d="$O/cpuprof/$op-$s"
        rm -rf "$d"; mkdir -p "$d"
        if [ "$side" = before ]; then
          CONCERTO_ENGINE_MODULE="$BEFORE_ENGINE" node --cpu-prof --cpu-prof-dir="$d" --cpu-prof-interval 250 migration/bench/p515-sweep.mjs --core-dist "$BEFORE_CORE_DIST" --mode loop --ops "$op" --sets "$s" --seconds 6 2> "$d/loop.log"
        else
          node --cpu-prof --cpu-prof-dir="$d" --cpu-prof-interval 250 migration/bench/p515-sweep.mjs --mode loop --ops "$op" --sets "$s" --seconds 6 2> "$d/loop.log"
        fi
        node migration/bench/p515-cpuprof.mjs "$d"/*.cpuprofile --json > "$O/summary/cpuprof-$op-$s.json"
        rm -f "$d"/*.cpuprofile
        echo "$side cpuprof $op/$s done ($(loads))"
      done
    done
    if [ "$side" = before ]; then
      CONCERTO_ENGINE_MODULE="$BEFORE_ENGINE" node migration/bench/p515-sweep.mjs --core-dist "$BEFORE_CORE_DIST" --mode count $OPS_ARG --samples 10 --warmup 2 --out "$O/summary/crossings.json" > "$O/crossings.log" 2>&1
    else
      node migration/bench/p515-sweep.mjs --mode count $OPS_ARG --samples 10 --warmup 2 --out "$O/summary/crossings.json" > "$O/crossings.log" 2>&1
    fi
    echo "$side crossings done ($(loads))"
  done
  echo "profiles done"
  exit 0
fi

if [ "$PHASE" = timed ]; then
  MAX=${P515_GATE_MAX:-14400}
  waited=0
  gate() {
    while :; do
      set -- $(loads)
      busy=$(pgrep -fl 'run-ts\.mjs|p5[0-9a-z]*-(sweep|rounds|profile)|--bench|criterion|wasm-instance|(^|/)cargo( |$)|mocha' | grep -v "${P515_SELF:-P5-22}" | grep -v pgrep | wc -l | tr -d ' ')
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
  crate() {
    side=$1; bin=$2; tgt=$3; r=$4
    gate; echo "round $r crate-$side start load $(loads)"
    rm -rf "$tgt/criterion/p515"
    CARGO_TARGET_DIR="$tgt" "$bin" --bench --warm-up-time 1 --measurement-time 3 'p515/' > "$OUT/$side/crate-$r.log" 2>&1
    rm -rf "$OUT/$side/crate-$r"; mkdir -p "$OUT/$side/crate-$r"
    (cd "$tgt/criterion/p515" && find . -path '*/new/estimates.json' | while read -r e; do
       id=$(dirname "$(dirname "$e")" | sed 's|^\./||'); mkdir -p "$OUT/$side/crate-$r/$id"; cp "$e" "$OUT/$side/crate-$r/$id/estimates.json"; done)
    cp "$tgt/criterion/p515-n.json" "$OUT/$side/crate-$r/n.json"
    echo "round $r crate-$side end load $(loads)"
  }
  for r in 1 2 3; do
    gate; echo "round $r ts-ref start load $(loads)"
    node migration/bench/p515-sweep.mjs --core-dist "$REF" $OPS_ARG --samples 30 --warmup 5 --out "$OUT/now/ts-reference-5.0.0-$r.json" > "$OUT/now/ts-reference-5.0.0-$r.log" 2>&1
    cp "$OUT/now/ts-reference-5.0.0-$r.json" "$OUT/before/ts-reference-5.0.0-$r.json"
    echo "round $r ts-ref end load $(loads)"
    # Alternate which side goes first, so drift within a round does not
    # favour one side.
    if [ $((r % 2)) = 1 ]; then ORDER="now before"; else ORDER="before now"; fi
    for side in $ORDER; do
      gate; echo "round $r rust-engine-$side start load $(loads)"
      sweep "$side" $OPS_ARG --samples 30 --warmup 5 --out "$OUT/$side/rust-engine-$r.json" > "$OUT/$side/rust-engine-$r.log" 2>&1
      echo "round $r rust-engine-$side end load $(loads)"
    done
    [ "${P522_CRATE:-1}" = 0 ] && continue
    for side in $ORDER; do
      if [ "$side" = now ]; then crate now "$NOW_BIN" "$NOW_TARGET" "$r"; else crate before "$BEFORE_BIN" "$BEFORE_TARGET" "$r"; fi
    done
  done
  echo "timed done"
  exit 0
fi
echo "unknown phase $PHASE"; exit 2
