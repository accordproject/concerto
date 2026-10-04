#!/bin/sh
# P5-97 (accordproject/concerto-rust#448): server-reuse benchmarks, the GC
# share of P5-96's two heaviest-GC rows before and after, and the soak gate.
# Measure only. Run from the concerto checkout root:
#
#   BEFORE_CORE_DIST=<head-before concerto-core dist> \
#   BEFORE_ENGINE=<head-before concerto-engine.cjs> \
#   OUT=migration/bench/results/P5-97 sh migration/bench/p597-run.sh [phase...]
#
# Phases (default: all, in this order):
#   gc      V8 CPU profiles of `p515-sweep.mjs --mode loop` (6 s, 250 us
#           interval) for extract_cold and add_model_file on every P5-72 set,
#           before and after; the stage split (p515-cpuprof.mjs) gives the
#           GC share.
#   time    p597-server.mjs --mode time, three rounds: TS 5.0.0 (a), then
#           before (a), before (b), after (a), after (b), after (c) (the five
#           engine sides in reverse order every other round), for every set
#           and N in 1, 16, 64.
#   memory  p597-server.mjs --mode memory (100 held managers) per side.
#   soak    p597-server.mjs --mode soak, after (c) at N=64: conformance for
#           SOAK_SECONDS (default 1200), then synthetic-large for half that.
#
# "after" is this checkout's dist with its sibling concerto-rust engine.
set -u
OUT=${OUT:-migration/bench/results/P5-97}
REF=migration/oracle/reference/node_modules/@accordproject/concerto-core/dist
SETS="concerto-core-test-data conformance synthetic-large"
SOAK_SECONDS=${SOAK_SECONDS:-1200}
PHASES=${*:-gc time memory soak}
mkdir -p "$OUT"
loads() { cut -d' ' -f1,2 /proc/loadavg; }
log() { echo "$(date -u +%H:%M:%S) $* (load $(loads))" | tee -a "$OUT/run-log.txt"; }

requests_for() {
    case "$1" in
        synthetic-large) echo 150 ;;
        *) echo 400 ;;
    esac
}

server() {
    # server <side> <approach> <set> <args...>
    side=$1; approach=$2; set=$3; shift 3
    case "$side" in
        ts5) CONCERTO_ENGINE_MODULE= node --expose-gc migration/bench/p597-server.mjs --core-dist "$REF" --approach "$approach" --set "$set" "$@" ;;
        before) CONCERTO_ENGINE_MODULE="$BEFORE_ENGINE" node --expose-gc migration/bench/p597-server.mjs --core-dist "$BEFORE_CORE_DIST" --approach "$approach" --set "$set" "$@" ;;
        after) node --expose-gc migration/bench/p597-server.mjs --approach "$approach" --set "$set" "$@" ;;
    esac
}

for phase in $PHASES; do
    case "$phase" in
    gc)
        log "gc phase"
        mkdir -p "$OUT/gc"
        for side in before after; do
            for op in extract_cold add_model_file; do
                for s in $SETS; do
                    d="$OUT/gc/cpuprof-$side-$op-$s"
                    mkdir -p "$d"
                    if [ "$side" = before ]; then
                        CONCERTO_ENGINE_MODULE="$BEFORE_ENGINE" node --cpu-prof --cpu-prof-dir="$d" --cpu-prof-interval 250 migration/bench/p515-sweep.mjs --core-dist "$BEFORE_CORE_DIST" --mode loop --ops "$op" --sets "$s" --seconds 6 2> "$d/loop.log"
                    else
                        node --cpu-prof --cpu-prof-dir="$d" --cpu-prof-interval 250 migration/bench/p515-sweep.mjs --mode loop --ops "$op" --sets "$s" --seconds 6 2> "$d/loop.log"
                    fi
                    node migration/bench/p515-cpuprof.mjs "$d"/*.cpuprofile --json > "$OUT/gc/$side-$op-$s.json"
                    rm -f "$d"/*.cpuprofile
                done
            done
            log "gc $side done"
        done
        ;;
    time)
        log "time phase"
        for r in 1 2 3; do
            if [ $((r % 2)) -eq 1 ]; then
                sides="before:a before:b after:a after:b after:c"
            else
                sides="after:c after:b after:a before:b before:a"
            fi
            for s in $SETS; do
                req=$(requests_for "$s")
                for n in 1 16 64; do
                    server ts5 a "$s" --concurrency $n --requests "$req" --warmup 20 --out "$OUT/time/ts5-a-$s-n$n-r$r.json"
                    for sa in $sides; do
                        side=${sa%%:*}; ap=${sa##*:}
                        server "$side" "$ap" "$s" --concurrency $n --requests "$req" --warmup 20 --out "$OUT/time/$side-$ap-$s-n$n-r$r.json"
                    done
                done
            done
            log "time round $r done"
        done
        ;;
    memory)
        log "memory phase"
        for s in $SETS; do
            server ts5 a "$s" --mode memory --held 100 --warmup 20 --out "$OUT/memory/ts5-a-$s.json"
            for sa in before:a before:b after:a after:b after:c; do
                side=${sa%%:*}; ap=${sa##*:}
                server "$side" "$ap" "$s" --mode memory --held 100 --warmup 20 --out "$OUT/memory/$side-$ap-$s.json"
            done
        done
        log "memory done"
        ;;
    soak)
        log "soak phase"
        server after c conformance --mode soak --concurrency 64 --seconds "$SOAK_SECONDS" --out "$OUT/soak/after-c-conformance-n64.json"
        log "soak conformance done"
        server after c synthetic-large --mode soak --concurrency 64 --seconds $((SOAK_SECONDS / 2)) --out "$OUT/soak/after-c-synthetic-large-n64.json"
        log "soak synthetic-large done"
        ;;
    esac
done
log "p597-run done"
