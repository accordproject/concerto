#!/bin/sh
# P5-121 (accordproject/concerto-rust#497): P5-109's server bench
# (p597-server.mjs --mode time) re-run on the integration head, with P5-109's
# now heads as the before-side, approaches a/b/c at N = 1, 16 and 64. Both
# heads have fork() and BC-53, so both sides time (a), (b) as the plain
# `filter(() => true)` (`--approach b-all`) and (c) fork; the before/now
# pairs of (b) and (c) show P5-116's filter built from declaration ASTs.
# Measure only. Run from the concerto checkout root:
#
#   BEFORE_CORE_DIST=<before concerto-core dist> BEFORE_ENGINE=<before concerto-engine.cjs> \
#   OUT=migration/bench/results/P5-121/server sh migration/bench/p5121-server-run.sh
#
# Three rounds: TS 5.0.0 (a), then before (a), before (b-all), before (c),
# now (a), now (b-all), now (c), the six engine sides in reverse order every
# other round, for every set and N. The quiet gate of p5121-run.sh runs
# before each round.
set -u
OUT=${OUT:-migration/bench/results/P5-121/server}
REF=migration/oracle/reference/node_modules/@accordproject/concerto-core/dist
SETS="concerto-core-test-data conformance synthetic-large"
mkdir -p "$OUT/time"
loads() { cut -d' ' -f1,2,3 /proc/loadavg; }
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
        now) node --expose-gc migration/bench/p597-server.mjs --approach "$approach" --set "$set" "$@" ;;
    esac
}

MAX=${P515_GATE_MAX:-14400}
waited=0
gate() {
    while :; do
        set -- $(loads)
        # -a prints the full command line so this script, and the $(...)
        # subshell that shares it, can be left out: its own name matches
        # the p5*-server pattern, and with -l the gate never passed.
        busy=$(pgrep -fa 'run-ts\.mjs|p5[0-9a-z]*-(sweep|rounds|profile|server)|--bench|criterion|wasm-instance|(^|/)cargo( |$)|mocha' | grep -v 'p5121-server-run' | grep -v pgrep | wc -l | tr -d ' ')
        if awk -v a="$1" -v b="$2" 'BEGIN{exit !(a<2 && b<3)}' && [ "$busy" = 0 ]; then
            return 0
        fi
        if [ $waited -ge "$MAX" ]; then
            log "gate: gave up after ${waited}s (other benches $busy)"
            exit 20
        fi
        sleep 30; waited=$((waited+30))
    done
}

log "time phase"
for r in 1 2 3; do
    gate
    log "time round $r start"
    if [ $((r % 2)) -eq 1 ]; then
        sides="before:a before:b-all before:c now:a now:b-all now:c"
    else
        sides="now:c now:b-all now:a before:c before:b-all before:a"
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
log "p5121-server-run done"
