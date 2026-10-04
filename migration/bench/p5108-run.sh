#!/bin/sh
# P5-108 (accordproject/concerto-rust#466): P5-97's server bench, approach
# (b) with the plain `filter(() => true)` predicate (`--approach b-all`),
# which BC-53 makes work, next to (b) with P5-97's workaround predicate
# (`keepUserModels`), (c) fork and TS 5.0.0's (a), all on this checkout's
# build. Measure only. Run from the concerto checkout root:
#
#   OUT=migration/bench/results/P5-108 sh migration/bench/p5108-run.sh [phase...]
#
# Phases (default: time memory), as in p597-run.sh:
#   time    p597-server.mjs --mode time, three rounds: TS 5.0.0 (a), then
#           after (b), after (b-all), after (c) (reversed every other round),
#           for every set and N in 1, 16, 64.
#   memory  p597-server.mjs --mode memory (100 held managers) per side.
set -u
OUT=${OUT:-migration/bench/results/P5-108}
REF=migration/oracle/reference/node_modules/@accordproject/concerto-core/dist
SETS="concerto-core-test-data conformance synthetic-large"
PHASES=${*:-time memory}
mkdir -p "$OUT/time" "$OUT/memory"
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
        after) node --expose-gc migration/bench/p597-server.mjs --approach "$approach" --set "$set" "$@" ;;
    esac
}

for phase in $PHASES; do
    case "$phase" in
    time)
        log "time phase"
        for r in 1 2 3; do
            if [ $((r % 2)) -eq 1 ]; then
                sides="after:b after:b-all after:c"
            else
                sides="after:c after:b-all after:b"
            fi
            for s in $SETS; do
                req=$(requests_for "$s")
                for n in 1 16 64; do
                    server ts5 a "$s" --concurrency $n --requests "$req" --warmup 20 --out "$OUT/time/ts5-a-$s-n$n-r$r.json" > /dev/null
                    for sa in $sides; do
                        side=${sa%%:*}; ap=${sa##*:}
                        server "$side" "$ap" "$s" --concurrency $n --requests "$req" --warmup 20 --out "$OUT/time/$side-$ap-$s-n$n-r$r.json" > /dev/null
                    done
                done
            done
            log "time round $r done"
        done
        ;;
    memory)
        log "memory phase"
        for s in $SETS; do
            server ts5 a "$s" --mode memory --held 100 --warmup 20 --out "$OUT/memory/ts5-a-$s.json" > /dev/null
            for sa in after:b after:b-all after:c; do
                side=${sa%%:*}; ap=${sa##*:}
                server "$side" "$ap" "$s" --mode memory --held 100 --warmup 20 --out "$OUT/memory/$side-$ap-$s.json" > /dev/null
            done
        done
        log "memory done"
        ;;
    esac
done
log "p5108-run done"
