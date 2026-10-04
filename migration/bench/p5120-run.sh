#!/bin/sh
# P5-120 (accordproject/concerto-rust#495): memory soak over time, three
# sides on the same server scenario as P5-97 (p597-server.mjs --mode soak):
#
#   ts5-a  published TS 5.0.0, a new ModelManager and a full reload per
#          request;
#   now-a  the integration head (this checkout's concerto-core dist with its
#          sibling concerto-rust engine), the same;
#   now-c  the integration head, base.fork() per request.
#
# N = 64 concurrent async requests, conformance and synthetic-large, the
# same per-request work as P5-97 (add a small user model, deserialize one
# user and one platform instance), SOAK_SECONDS (default 1200) per side and
# set, sampled every 5 s with the GC pauses observed. The six runs alternate
# set and rotate side order:
#
#   conformance ts5-a, synthetic-large now-c, conformance now-a,
#   synthetic-large now-a, conformance now-c, synthetic-large ts5-a
#
# A quiet gate (load and no other bench processes) runs before each one.
# Measure only. Run from the concerto checkout root:
#
#   OUT=migration/bench/results/P5-120 sh migration/bench/p5120-run.sh
set -u
OUT=${OUT:-migration/bench/results/P5-120}
REF=migration/oracle/reference/node_modules/@accordproject/concerto-core/dist
SOAK_SECONDS=${SOAK_SECONDS:-1200}
RUNS=${RUNS:-"conformance:ts5:a synthetic-large:now:c conformance:now:a synthetic-large:now:a conformance:now:c synthetic-large:ts5:a"}
mkdir -p "$OUT/soak"
loads() { cut -d' ' -f1,2,3 /proc/loadavg; }
log() { echo "$(date -u +%H:%M:%S) $* (load $(loads))" | tee -a "$OUT/run-log.txt"; }

server() {
    # server <side> <approach> <set> <args...>
    side=$1; approach=$2; set=$3; shift 3
    case "$side" in
        ts5) CONCERTO_ENGINE_MODULE= node --expose-gc migration/bench/p597-server.mjs --core-dist "$REF" --approach "$approach" --set "$set" "$@" ;;
        now) node --expose-gc migration/bench/p597-server.mjs --approach "$approach" --set "$set" "$@" ;;
    esac
}

MAX=${P515_GATE_MAX:-14400}
waited=0
gate() {
    while :; do
        set -- $(loads)
        busy=$(pgrep -fa 'run-ts\.mjs|p5[0-9a-z]*-(sweep|rounds|profile|server)|--bench|criterion|wasm-instance|(^|/)cargo( |$)|mocha' | grep -v 'p5120-run' | grep -v pgrep | wc -l | tr -d ' ')
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

log "soak phase: $SOAK_SECONDS s per run"
for run in $RUNS; do
    set_=${run%%:*}; rest=${run#*:}; side=${rest%%:*}; ap=${rest##*:}
    gate
    log "start $side-$ap $set_"
    server "$side" "$ap" "$set_" --mode soak --concurrency 64 --seconds "$SOAK_SECONDS" --sample-seconds 5 --out "$OUT/soak/$side-$ap-$set_-n64.json"
    log "done $side-$ap $set_ (exit $?)"
done
log "p5120-run done"
