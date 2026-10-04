#!/bin/sh
# P5-96 (accordproject/concerto-rust#446): the consolidated re-measure after
# P5-88..P5-95. P5-72's driver (p572-run.sh) with the P5-72 head as the second
# before-side (in place of the P5-60 head), so pre-F1, the P5-72 head and the
# current head are timed in the same run on one machine, and with the P5-89
# rows (validate_instance, validate_instance_or_throw) in the op list.
# Measure only.
#
#   sh migration/bench/p596-run.sh <phase> <out dir> <now bench bin> <before bench bin> <p572 bench bin>
#
# Environment: as p572-run.sh (NOW_TARGET, BEFORE_TARGET, BEFORE_CORE_DIST,
# BEFORE_ENGINE, CONCERTO_ENGINE_MODULE, P515_SELF, P515_GATE_MAX,
# P560_CRATE_FILTER, P560_LOAD_OPS), with the second before-side `p572` (the
# P5-72 head) taking P572_TARGET, P572_CORE_DIST and P572_ENGINE.
#
# Sides: `before` (pre-F1), `p572` (the P5-72 head), `now`, `now-mmvoff` (the
# now head with metamodelValidation:false over the load ops). The profiles
# phase profiles now, p572 and before and counts crossings on all four. In
# the timed phase each round times TS 5.0.0, then the four TS-API sides
# (order reversed every other round, now-mmvoff next to now) and the three
# crate sides (order reversed every other round). The heads without P5-89's
# API have no validate_instance* rows (the sweep reports an error for them).
#
# Run from the concerto checkout root.
set -u
PHASE=$1
OUT=$2
NOW_BIN=$3
BEFORE_BIN=$4
P572_BIN=$5
REF=migration/oracle/reference/node_modules/@accordproject/concerto-core/dist
SETS="concerto-core-test-data conformance synthetic-large"
ALL_OPS="mm_new modelfile_new add_model_file add_cto_model from_json to_json new_resource validate set_property_value add_array_value validate_instance validate_instance_or_throw dcs_decorate dcs_validate extract_decorators extract_vocabularies extract_cold extract_keep get_type resolve_type get_decorators get_namespaces get_type_first resolve_type_first get_namespaces_first derives_from is_assignable_to"
LOAD_OPS=${P560_LOAD_OPS:-mm_new,modelfile_new,add_model_file,add_cto_model}
MMVOFF='{"metamodelValidation":false}'
mkdir -p "$OUT/now" "$OUT/before" "$OUT/p572" "$OUT/now-mmvoff"
# Absolute, because crate() copies the criterion estimates from inside the
# target dir (a relative OUT there loses every crate round).
OUT=$(CDPATH= cd -- "$OUT" && pwd)

loads() { awk '{print $1" "$2" "$3}' /proc/loadavg; }
log() { echo "$*"; echo "$(date -u +%H:%M:%S) $*" >> "$OUT/timed-loads.txt"; }

sweep() {
  side=$1; shift
  case "$side" in
    before) CONCERTO_ENGINE_MODULE="$BEFORE_ENGINE" node migration/bench/p515-sweep.mjs --core-dist "$BEFORE_CORE_DIST" "$@" ;;
    p572) CONCERTO_ENGINE_MODULE="$P572_ENGINE" node migration/bench/p515-sweep.mjs --core-dist "$P572_CORE_DIST" "$@" ;;
    now-mmvoff) node migration/bench/p515-sweep.mjs --mm-options "$MMVOFF" --ops "$LOAD_OPS" "$@" ;;
    *) node migration/bench/p515-sweep.mjs "$@" ;;
  esac
}

if [ "$PHASE" = profiles ]; then
  for side in now p572 before; do
    O="$OUT/$side"
    mkdir -p "$O/cpuprof" "$O/summary"
    for op in $ALL_OPS; do
      for s in $SETS; do
        [ "$op" = mm_new ] && [ "$s" != conformance ] && continue
        # The heads before P5-89 have no validateInstance.
        case "$side:$op" in now:*) ;; *:validate_instance*) continue ;; esac
        d="$O/cpuprof/$op-$s"
        rm -rf "$d"; mkdir -p "$d"
        if [ "$side" = before ]; then
          CONCERTO_ENGINE_MODULE="$BEFORE_ENGINE" node --cpu-prof --cpu-prof-dir="$d" --cpu-prof-interval 250 migration/bench/p515-sweep.mjs --core-dist "$BEFORE_CORE_DIST" --mode loop --ops "$op" --sets "$s" --seconds 6 2> "$d/loop.log"
        elif [ "$side" = p572 ]; then
          CONCERTO_ENGINE_MODULE="$P572_ENGINE" node --cpu-prof --cpu-prof-dir="$d" --cpu-prof-interval 250 migration/bench/p515-sweep.mjs --core-dist "$P572_CORE_DIST" --mode loop --ops "$op" --sets "$s" --seconds 6 2> "$d/loop.log"
        else
          node --cpu-prof --cpu-prof-dir="$d" --cpu-prof-interval 250 migration/bench/p515-sweep.mjs --mode loop --ops "$op" --sets "$s" --seconds 6 2> "$d/loop.log"
        fi
        node migration/bench/p515-cpuprof.mjs "$d"/*.cpuprofile --json > "$O/summary/cpuprof-$op-$s.json"
        rm -f "$d"/*.cpuprofile
        echo "$side cpuprof $op/$s done ($(loads))"
      done
    done
    sweep "$side" --mode count --samples 10 --warmup 2 --out "$O/summary/crossings.json" > "$O/crossings.log" 2>&1
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
      busy=$(pgrep -fl 'run-ts\.mjs|p5[0-9a-z]*-(sweep|rounds|profile)|--bench|criterion|wasm-instance|(^|/)cargo( |$)|mocha' | grep -v "${P515_SELF:-P5-96}" | grep -v pgrep | wc -l | tr -d ' ')
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
    node migration/bench/p515-sweep.mjs --core-dist "$REF" --samples 30 --warmup 5 --out "$OUT/now/ts-reference-5.0.0-$r.json" > "$OUT/now/ts-reference-5.0.0-$r.log" 2>&1
    cp "$OUT/now/ts-reference-5.0.0-$r.json" "$OUT/before/ts-reference-5.0.0-$r.json"
    cp "$OUT/now/ts-reference-5.0.0-$r.json" "$OUT/now-mmvoff/ts-reference-5.0.0-$r.json"
    cp "$OUT/now/ts-reference-5.0.0-$r.json" "$OUT/p572/ts-reference-5.0.0-$r.json"
    log "round $r ts-ref end load $(loads)"
    # Alternate the order per round, so drift within a round does not
    # favour one side; now-mmvoff sits next to now.
    if [ $((r % 2)) = 1 ]; then ORDER="now now-mmvoff p572 before"; else ORDER="before p572 now-mmvoff now"; fi
    for side in $ORDER; do
      gate; log "round $r rust-engine-$side start load $(loads)"
      sweep "$side" --samples 30 --warmup 5 --out "$OUT/$side/rust-engine-$r.json" > "$OUT/$side/rust-engine-$r.log" 2>&1
      log "round $r rust-engine-$side end load $(loads)"
    done
    if [ $((r % 2)) = 1 ]; then
      crate now "$NOW_BIN" "$NOW_TARGET" "$r"; crate p572 "$P572_BIN" "$P572_TARGET" "$r"; crate before "$BEFORE_BIN" "$BEFORE_TARGET" "$r"
    else
      crate before "$BEFORE_BIN" "$BEFORE_TARGET" "$r"; crate p572 "$P572_BIN" "$P572_TARGET" "$r"; crate now "$NOW_BIN" "$NOW_TARGET" "$r"
    fi
  done
  log "timed done"
  exit 0
fi
echo "unknown phase $PHASE"; exit 2
