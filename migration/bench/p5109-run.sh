#!/bin/sh
# P5-109 (accordproject/concerto-rust#469): the consolidated re-measure after
# the review round (P5-97..P5-102). P5-96's driver (p596-run.sh) with P5-96's
# now heads as the one before-side, P5-106's two subclass-query ops in the op
# list, and P5-109's `p5109` pseudo-set (p515-sweep.mjs: fromJSON with a
# 1,000-entry map and a relationship map, validateInstance with collectAll
# on invalid documents, getType/resolveType after an updateModelFile of a
# supertype file, and a second manager's reads while another changes).
# Measure only.
#
#   sh migration/bench/p5109-run.sh <phase> <out dir> <now bench bin> <before bench bin>
#
# Environment: NOW_TARGET, BEFORE_TARGET (the bench binaries' target dirs),
# BEFORE_CORE_DIST, BEFORE_ENGINE, CONCERTO_ENGINE_MODULE (now's engine),
# P515_SELF, P515_GATE_MAX, P560_CRATE_FILTER, P560_LOAD_OPS, as p596-run.sh.
#
# Sides: `before` (P5-96's now heads), `now`, `now-mmvoff` (the now head with
# metamodelValidation:false over the load ops). The profiles phase profiles
# now (the only side whose profile the tables read) and counts crossings on
# all three sides. In the timed phase each round times TS 5.0.0, then the
# three TS-API sides (order reversed every other round, now-mmvoff next to
# now) and the two crate sides (order reversed every other round). The
# `p5109` ops have no crate rows.
#
# Run from the concerto checkout root.
set -u
PHASE=$1
OUT=$2
NOW_BIN=$3
BEFORE_BIN=$4
REF=migration/oracle/reference/node_modules/@accordproject/concerto-core/dist
SETS="concerto-core-test-data conformance synthetic-large"
SWEEP_SETS="concerto-core-test-data,conformance,synthetic-large,p5109"
ALL_OPS="mm_new modelfile_new add_model_file add_cto_model from_json to_json new_resource validate set_property_value add_array_value validate_instance validate_instance_or_throw dcs_decorate dcs_validate extract_decorators extract_vocabularies extract_cold extract_keep get_type resolve_type get_decorators get_namespaces get_type_first resolve_type_first get_namespaces_first derives_from is_assignable_to get_assignable_class_declarations get_direct_subclasses"
# The p5109 ops profiled (the ones with an untimed `pre` step are not: a
# loop profile would include it).
P5109_PROFILED="from_json_map from_json_relmap validate_instance_collect_all validate_instance_first_error get_type_p5109 resolve_type_p5109"
LOAD_OPS=${P560_LOAD_OPS:-mm_new,modelfile_new,add_model_file,add_cto_model}
MMVOFF='{"metamodelValidation":false}'
mkdir -p "$OUT/now" "$OUT/before" "$OUT/now-mmvoff"
# Absolute, because crate() copies the criterion estimates from inside the
# target dir (a relative OUT there loses every crate round).
OUT=$(CDPATH= cd -- "$OUT" && pwd)

loads() { awk '{print $1" "$2" "$3}' /proc/loadavg; }
log() { echo "$*"; echo "$(date -u +%H:%M:%S) $*" >> "$OUT/timed-loads.txt"; }

sweep() {
  side=$1; shift
  case "$side" in
    before) CONCERTO_ENGINE_MODULE="$BEFORE_ENGINE" node migration/bench/p515-sweep.mjs --core-dist "$BEFORE_CORE_DIST" --sets "$SWEEP_SETS" "$@" ;;
    now-mmvoff) node migration/bench/p515-sweep.mjs --mm-options "$MMVOFF" --ops "$LOAD_OPS" "$@" ;;
    *) node migration/bench/p515-sweep.mjs --sets "$SWEEP_SETS" "$@" ;;
  esac
}

if [ "$PHASE" = profiles ]; then
  O="$OUT/now"
  mkdir -p "$O/cpuprof" "$O/summary"
  profile() {
    op=$1; s=$2
    d="$O/cpuprof/$op-$s"
    rm -rf "$d"; mkdir -p "$d"
    node --cpu-prof --cpu-prof-dir="$d" --cpu-prof-interval 250 migration/bench/p515-sweep.mjs --mode loop --ops "$op" --sets "$s" --seconds 6 2> "$d/loop.log"
    node migration/bench/p515-cpuprof.mjs "$d"/*.cpuprofile --json > "$O/summary/cpuprof-$op-$s.json"
    rm -f "$d"/*.cpuprofile
    echo "now cpuprof $op/$s done ($(loads))"
  }
  for op in $ALL_OPS; do
    for s in $SETS; do
      [ "$op" = mm_new ] && [ "$s" != conformance ] && continue
      profile "$op" "$s"
    done
  done
  for op in $P5109_PROFILED; do profile "$op" p5109; done
  for side in now before; do
    mkdir -p "$OUT/$side/summary"
    sweep "$side" --mode count --samples 10 --warmup 2 --out "$OUT/$side/summary/crossings.json" > "$OUT/$side/crossings.log" 2>&1
    echo "$side crossings done ($(loads))"
  done
  mkdir -p "$OUT/now-mmvoff/summary"
  sweep now-mmvoff --mode count --samples 10 --warmup 2 --out "$OUT/now-mmvoff/summary/crossings.json" > "$OUT/now-mmvoff/crossings.log" 2>&1
  echo "now-mmvoff crossings done ($(loads))"
  echo "profiles done"
  exit 0
fi

if [ "$PHASE" = timed ]; then
  MAX=${P515_GATE_MAX:-14400}
  waited=0
  gate() {
    while :; do
      set -- $(loads)
      busy=$(pgrep -fl 'run-ts\.mjs|p5[0-9a-z]*-(sweep|rounds|profile|server)|--bench|criterion|wasm-instance|(^|/)cargo( |$)|mocha' | grep -v "${P515_SELF:-P5-109}" | grep -v pgrep | wc -l | tr -d ' ')
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
  crate() {
    side=$1; bin=$2; tgt=$3; r=$4
    gate; log "round $r crate-$side start load $(loads)"
    rm -rf "$tgt/criterion/p515"
    CARGO_TARGET_DIR="$tgt" "$bin" --bench --warm-up-time 1 --measurement-time 3 "${P560_CRATE_FILTER:-p515/}" > "$OUT/$side/crate-$r.log" 2>&1
    rm -rf "$OUT/$side/crate-$r"; mkdir -p "$OUT/$side/crate-$r"
    (cd "$tgt/criterion/p515" && find . -path '*/new/estimates.json' | while read -r e; do
       id=$(dirname "$(dirname "$e")" | sed 's|^\./||'); mkdir -p "$OUT/$side/crate-$r/$id"; cp "$e" "$OUT/$side/crate-$r/$id/estimates.json"; done)
    cp "$tgt/criterion/p515-n.json" "$OUT/$side/crate-$r/n.json"
    log "round $r crate-$side end load $(loads)"
  }
  for r in 1 2 3; do
    gate; log "round $r ts-ref start load $(loads)"
    node migration/bench/p515-sweep.mjs --core-dist "$REF" --sets "$SWEEP_SETS" --samples 30 --warmup 5 --out "$OUT/now/ts-reference-5.0.0-$r.json" > "$OUT/now/ts-reference-5.0.0-$r.log" 2>&1
    cp "$OUT/now/ts-reference-5.0.0-$r.json" "$OUT/before/ts-reference-5.0.0-$r.json"
    cp "$OUT/now/ts-reference-5.0.0-$r.json" "$OUT/now-mmvoff/ts-reference-5.0.0-$r.json"
    log "round $r ts-ref end load $(loads)"
    # Alternate the order per round, so drift within a round does not
    # favour one side; now-mmvoff sits next to now.
    if [ $((r % 2)) = 1 ]; then ORDER="now now-mmvoff before"; else ORDER="before now-mmvoff now"; fi
    for side in $ORDER; do
      gate; log "round $r rust-engine-$side start load $(loads)"
      sweep "$side" --samples 30 --warmup 5 --out "$OUT/$side/rust-engine-$r.json" > "$OUT/$side/rust-engine-$r.log" 2>&1
      log "round $r rust-engine-$side end load $(loads)"
    done
    if [ $((r % 2)) = 1 ]; then
      crate now "$NOW_BIN" "$NOW_TARGET" "$r"; crate before "$BEFORE_BIN" "$BEFORE_TARGET" "$r"
    else
      crate before "$BEFORE_BIN" "$BEFORE_TARGET" "$r"; crate now "$NOW_BIN" "$NOW_TARGET" "$r"
    fi
  done
  log "timed done"
  exit 0
fi
echo "unknown phase $PHASE"; exit 2
