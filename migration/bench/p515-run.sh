#!/bin/sh
# P5-15 (accordproject/concerto-rust#309): the whole measurement sweep.
# Measure only. Repeated by P5-22 (accordproject/concerto-rust#326), which
# adds the instance-validation ops (validate, set_property_value,
# add_array_value) and widens the quiet gate to cargo and mocha processes.
#
#   sh migration/bench/p515-run.sh <phase> <out dir> <crate bench binary>
#
# phase:
#   profiles  native `sample` profiles of the crate path, V8 CPU profiles of
#             the TS-API path (stage split), crossing counts. No gate.
#   timed     three interleaved rounds of TS 5.0.0 / Rust engine through the
#             TS API / crate-direct criterion, each part behind the quiet
#             gate (1-min load < 2 and 5-min load < 3, no other bench,
#             cargo or mocha process running; P515_SELF names this run's
#             own processes to ignore). Gives up with exit 20 after P515_GATE_MAX seconds
#             (default 4 h) of waiting in total.
#
# Run from the concerto checkout root, with a concerto-rust checkout next to
# it and the crate bench already built (cargo bench --no-run).
set -u
PHASE=$1
OUT=$2
BIN=$3
REF=migration/oracle/reference/node_modules/@accordproject/concerto-core/dist
SETS="concerto-core-test-data conformance synthetic-large"
mkdir -p "$OUT"
# Absolute, because the crate round copies the criterion estimates from inside the
# target dir (a relative OUT there loses every crate round).
OUT=$(cd "$OUT" && pwd)

loads() { sysctl -n vm.loadavg | tr -d '{}' | awk '{print $1" "$2" "$3}'; }

if [ "$PHASE" = profiles ]; then
  mkdir -p "$OUT/native" "$OUT/cpuprof" "$OUT/summary"
  # Native profiles of the crate path.
  NATIVE="mm_new/conformance"
  for s in $SETS; do
    for op in modelfile_new add_model_file from_json to_json new_resource validate set_property_value add_array_value dcs_decorate dcs_validate extract_decorators; do
      NATIVE="$NATIVE $op/$s"
    done
  done
  NATIVE="$NATIVE dcs_decorate_rebuild/conformance extract_vocabularies/conformance get_type/conformance resolve_type/conformance derives_from/conformance derives_from/synthetic-large is_assignable_to/conformance get_namespaces/conformance get_decorators/conformance"
  for b in $NATIVE; do
    f=$(echo "$b" | tr '/' '_')
    "$BIN" --bench --profile-time 14 "p515/$b\$" > "$OUT/native/$f.log" 2>&1 &
    P=$!
    i=0
    while [ $i -lt 240 ] && ! grep -q Profiling "$OUT/native/$f.log"; do sleep 0.5; i=$((i+1)); done
    sample $P 10 1 -mayDie -file "$OUT/native/$f.sample.txt" > /dev/null 2>&1
    wait $P
    python3 migration/bench/p515-sample.py "$OUT/native/$f.sample.txt" --json > "$OUT/summary/native-$f.json"
    echo "native $b done ($(loads))"
  done
  # TS-API stage split (Rust engine).
  for op in mm_new modelfile_new add_model_file add_cto_model from_json to_json new_resource validate set_property_value add_array_value dcs_decorate dcs_validate extract_decorators extract_vocabularies get_type resolve_type get_decorators get_namespaces derives_from is_assignable_to; do
    for s in $SETS; do
      [ "$op" = mm_new ] && [ "$s" != conformance ] && continue
      d="$OUT/cpuprof/$op-$s"
      rm -rf "$d"; mkdir -p "$d"
      node --cpu-prof --cpu-prof-dir="$d" --cpu-prof-interval 250 migration/bench/p515-sweep.mjs --mode loop --ops "$op" --sets "$s" --seconds 8 2> "$d/loop.log"
      node migration/bench/p515-cpuprof.mjs "$d"/*.cpuprofile --json > "$OUT/summary/cpuprof-$op-$s.json"
      echo "cpuprof $op/$s done ($(loads))"
    done
  done
  # Crossing counts.
  node migration/bench/p515-sweep.mjs --mode count --samples 10 --warmup 2 --out "$OUT/summary/crossings.json" > "$OUT/crossings.log" 2>&1
  echo "profiles done ($(loads))"
  exit 0
fi

if [ "$PHASE" = timed ]; then
  MAX=${P515_GATE_MAX:-14400}
  waited=0
  gate() {
    while :; do
      set -- $(loads)
      busy=$(pgrep -fl 'run-ts\.mjs|p5[0-9a-z]*-(sweep|rounds|profile)|--bench|criterion|wasm-instance|(^|/)cargo( |$)|mocha' | grep -v "${P515_SELF:-P5-15}" | grep -v pgrep | wc -l | tr -d ' ')
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
  for r in 1 2 3; do
    gate; echo "round $r ts-ref start load $(loads)"
    node migration/bench/p515-sweep.mjs --core-dist "$REF" --samples 30 --warmup 5 --out "$OUT/ts-reference-5.0.0-$r.json" > "$OUT/ts-reference-5.0.0-$r.log" 2>&1
    echo "round $r ts-ref end load $(loads)"
    gate; echo "round $r rust-engine start load $(loads)"
    node migration/bench/p515-sweep.mjs --samples 30 --warmup 5 --out "$OUT/rust-engine-$r.json" > "$OUT/rust-engine-$r.log" 2>&1
    echo "round $r rust-engine end load $(loads)"
    gate; echo "round $r crate start load $(loads)"
    rm -rf "$CARGO_TARGET_DIR/criterion/p515"
    "$BIN" --bench --warm-up-time 1 --measurement-time 3 'p515/' > "$OUT/crate-$r.log" 2>&1
    rm -rf "$OUT/crate-$r"; mkdir -p "$OUT/crate-$r"
    (cd "$CARGO_TARGET_DIR/criterion/p515" && find . -path '*/new/estimates.json' | while read -r e; do
       id=$(dirname "$(dirname "$e")" | sed 's|^\./||'); mkdir -p "$OUT/crate-$r/$id"; cp "$e" "$OUT/crate-$r/$id/estimates.json"; done)
    cp "$CARGO_TARGET_DIR/criterion/p515-n.json" "$OUT/crate-$r/n.json"
    echo "round $r crate end load $(loads)"
  done
  echo "timed done"
  exit 0
fi
echo "unknown phase $PHASE"; exit 2
