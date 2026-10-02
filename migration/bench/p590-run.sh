#!/bin/sh
# P5-90 (accordproject/concerto-rust#436), Phase 0, measure only: the
# model-loading and extract_cold profile. Run from the concerto checkout
# root, with the engine this checkout links (concerto-wasm build.sh) as the
# shipped (dlmalloc) engine.
#
#   sh migration/bench/p590-run.sh profiles <out dir>
#   sh migration/bench/p590-run.sh timed    <out dir>
#   sh migration/bench/p590-run.sh weak     <out dir>
#
# Environment:
#   NAMED_ENGINE      concerto-engine.cjs of a named build of the same tree
#                     (p590-engine-build.sh ... named), for the profiles
#   TALC_ENGINE       concerto-engine.cjs of the throwaway talc build
#                     (shipped optimisation), for the typed-read timing
#   TALC_NAMED_ENGINE the same, named, for its profile
#   SHIPPED_ENGINE    the shipped engine's concerto-engine.cjs (default: the
#                     sibling concerto-rust checkout's concerto-wasm/pkg)
#   TYPED_READ_BIN    concerto-rust benches' p590_typed_read example (native)
#   P515_SELF         the gate's self-tag (default P5-90)
#   P515_GATE_MAX     seconds the gate waits at most (default 14400)
#
# profiles: per op and set, 15 s of V8 CPU profile on the named engine
#   (p590-profile.mjs; split with p590-split.mjs), the modelfile_new
#   profiles again on the named talc engine, and one --mode count run per
#   engine (crossings, in-engine time by binding).
# timed: three rounds, the order reversed every other round, each part
#   behind the quiet gate (1-minute load < 2, 5-minute < 3, no other bench,
#   cargo or mocha process): TS 5.0.0 and the Rust engine through the TS
#   API, one op per process (300 samples, 30 warm-up; extract_cold 30 and
#   5); the WASM typed read alone on the dlmalloc and talc engines
#   (p590-typedread.mjs); the native typed read (p590_typed_read time).
# weak: the P5-73 WeakMap stall, re-measured: mm_new, modelfile_new and
#   add_model_file in one process (600 samples, as P5-73's discarded run)
#   against one process per op, twice each without the probe, and once
#   each with p590-weak-probe.cjs.
set -u
MODE=$1
mkdir -p "$2"
OUT=$(CDPATH= cd -- "$2" && pwd)
REF=migration/oracle/reference/node_modules/@accordproject/concerto-core/dist
OPS="modelfile_new add_model_file add_cto_model extract_cold"
SETS="concerto-core-test-data conformance synthetic-large"

loads() { awk '{print $1" "$2" "$3}' /proc/loadavg; }
log() { echo "$*"; echo "$(date -u +%H:%M:%S) $*" >> "$OUT/timed-loads.txt"; }

MAX=${P515_GATE_MAX:-14400}
waited=0
gate() {
  while :; do
    set -- $(loads)
    busy=$(pgrep -fl 'run-ts\.mjs|p5[0-9a-z]*-(sweep|rounds|profile|typedread)|--bench|criterion|wasm-instance|(^|/)cargo( |$)|mocha' | grep -v "${P515_SELF:-P5-90}" | grep -v pgrep | wc -l | tr -d ' ')
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

samples() { if [ "$1" = extract_cold ]; then echo "--samples 30 --warmup 5"; else echo "--samples 300 --warmup 30"; fi; }

case "$MODE" in
profiles)
  mkdir -p "$OUT/cpuprof" "$OUT/count"
  for op in $OPS; do
    for set in $SETS; do
      gate
      CONCERTO_ENGINE_MODULE="$NAMED_ENGINE" node --expose-gc migration/bench/p590-profile.mjs --op "$op" --set "$set" --seconds 15 \
        --out "$OUT/cpuprof/dlmalloc/$op-$set" > "$OUT/cpuprof/dlmalloc-$op-$set.log" 2>&1
      node migration/bench/p590-split.mjs "$OUT/cpuprof/dlmalloc/$op-$set"/*.cpuprofile --json > "$OUT/cpuprof/dlmalloc-$op-$set.split.json"
    done
  done
  for set in $SETS; do
    gate
    CONCERTO_ENGINE_MODULE="$TALC_NAMED_ENGINE" node --expose-gc migration/bench/p590-profile.mjs --op modelfile_new --set "$set" --seconds 15 \
      --out "$OUT/cpuprof/talc/modelfile_new-$set" > "$OUT/cpuprof/talc-modelfile_new-$set.log" 2>&1
    node migration/bench/p590-split.mjs "$OUT/cpuprof/talc/modelfile_new-$set"/*.cpuprofile --json > "$OUT/cpuprof/talc-modelfile_new-$set.split.json"
  done
  # Only the summaries are kept: the raw profiles are large.
  rm -rf "$OUT/cpuprof/dlmalloc" "$OUT/cpuprof/talc"
  for side in dlmalloc talc; do
    if [ $side = talc ]; then E="$TALC_ENGINE"; else E=""; fi
    gate
    CONCERTO_ENGINE_MODULE="$E" node migration/bench/p515-sweep.mjs --mode count --ops "$(echo $OPS | tr ' ' ',')" --samples 10 --warmup 2 \
      --out "$OUT/count/$side.json" > "$OUT/count/$side.log" 2>&1
  done
  ;;
timed)
  mkdir -p "$OUT/timed"
  for r in 1 2 3; do
    for op in $OPS; do
      if [ $((r % 2)) = 1 ]; then ORDER="ts rust"; else ORDER="rust ts"; fi
      for side in $ORDER; do
        gate; log "round $r $side $op start load $(loads)"
        if [ $side = ts ]; then D="--core-dist $REF"; else D=""; fi
        node migration/bench/p515-sweep.mjs $D --ops "$op" $(samples "$op") --out "$OUT/timed/$side-$r-$op.json" > "$OUT/timed/$side-$r-$op.log" 2>&1
        log "round $r $side $op end load $(loads)"
      done
    done
    if [ $((r % 2)) = 1 ]; then ORDER="dlmalloc talc"; else ORDER="talc dlmalloc"; fi
    for side in $ORDER; do
      if [ $side = talc ]; then E="$TALC_ENGINE"; else E=${SHIPPED_ENGINE:-../concerto-rust/concerto-wasm/pkg/concerto-engine.cjs}; fi
      gate; log "round $r typedread-$side start load $(loads)"
      node migration/bench/p590-typedread.mjs --engine "$E" --out "$OUT/timed/typedread-$side-$r.json" > "$OUT/timed/typedread-$side-$r.log" 2>&1
      log "round $r typedread-$side end load $(loads)"
    done
    gate; log "round $r native start load $(loads)"
    "$TYPED_READ_BIN" time migration/bench/fixtures/p515 > "$OUT/timed/native-$r.tsv" 2>&1
    log "round $r native end load $(loads)"
  done
  "$TYPED_READ_BIN" alloc migration/bench/fixtures/p515 > "$OUT/timed/native-alloc.tsv" 2>&1
  log "timed done"
  ;;
weak)
  mkdir -p "$OUT/weak"
  W="--samples 600 --warmup 30"
  for r in 1 2; do
    gate; log "weak round $r one-process start load $(loads)"
    node migration/bench/p515-sweep.mjs --ops mm_new,modelfile_new,add_model_file $W --out "$OUT/weak/one-process-$r.json" > "$OUT/weak/one-process-$r.log" 2>&1
    for op in mm_new modelfile_new add_model_file; do
      gate; log "weak round $r $op alone start load $(loads)"
      node migration/bench/p515-sweep.mjs --ops "$op" $W --out "$OUT/weak/alone-$r-$op.json" > "$OUT/weak/alone-$r-$op.log" 2>&1
    done
  done
  gate; log "weak probe one-process start load $(loads)"
  P590_WEAK_OUT="$OUT/weak/probe-one-process.json" node --require ./migration/bench/lib/p590-weak-probe.cjs migration/bench/p515-sweep.mjs \
    --ops mm_new,modelfile_new,add_model_file $W --out "$OUT/weak/probe-one-process-sweep.json" > "$OUT/weak/probe-one-process.log" 2>&1
  for op in mm_new modelfile_new add_model_file; do
    gate; log "weak probe $op alone start load $(loads)"
    P590_WEAK_OUT="$OUT/weak/probe-alone-$op.json" node --require ./migration/bench/lib/p590-weak-probe.cjs migration/bench/p515-sweep.mjs \
      --ops "$op" $W --out "$OUT/weak/probe-alone-$op-sweep.json" > "$OUT/weak/probe-alone-$op.log" 2>&1
  done
  log "weak done"
  ;;
*)
  echo "usage: p590-run.sh profiles|timed|weak <out dir>" >&2; exit 2 ;;
esac
