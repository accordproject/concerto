#!/bin/sh
# P5-131 (accordproject/concerto-rust#508): the targeted re-soak the
# maintainer approved on the issue, after the sweep, on the same machine and
# session: P5-120's soak (p5120-run.sh, p597-server.mjs --mode soak) on the
# integration head, with each run's own length:
#
#   now-a  the integration head, a new ModelManager and a full reload per
#          request (P5-120's now-a): 2,400 s per set, double P5-120's, so a
#          slow leak can be told apart from high-water steps;
#   ts5-a  published TS 5.0.0, the same, as the same-run baseline: 1,200 s;
#   now-c  the integration head, base.fork() per request, as a control:
#          1,200 s.
#
# N = 64, conformance and synthetic-large, P5-97's work per request, sampled
# every 5 s with the GC pauses observed. The runs alternate set and rotate
# side order as P5-120's did:
#
#   conformance ts5-a, synthetic-large now-c, conformance now-a,
#   synthetic-large now-a, conformance now-c, synthetic-large ts5-a
#
# A quiet gate (load and no other bench processes) runs before each one.
# Measure only. Run from the concerto checkout root:
#
#   OUT=migration/bench/results/P5-131/soak sh migration/bench/p5131-soak-run.sh
#
# RUNS overrides the list (set:side:approach:seconds ...).
set -u
OUT=${OUT:-migration/bench/results/P5-131/soak}
REF=migration/oracle/reference/node_modules/@accordproject/concerto-core/dist
RUNS=${RUNS:-"conformance:ts5:a:1200 synthetic-large:now:c:1200 conformance:now:a:2400 synthetic-large:now:a:2400 conformance:now:c:1200 synthetic-large:ts5:a:1200"}
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
        busy=$(pgrep -fa 'run-ts\.mjs|p5[0-9a-z]*-(sweep|rounds|profile|server)|--bench|criterion|wasm-instance|(^|/)cargo( |$)|mocha' | grep -v 'p5131-soak-run' | grep -v pgrep | wc -l | tr -d ' ')
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

log "soak phase: $RUNS"
for run in $RUNS; do
    set_=${run%%:*}; rest=${run#*:}; side=${rest%%:*}; rest=${rest#*:}; ap=${rest%%:*}; secs=${rest##*:}
    gate
    log "start $side-$ap $set_ ($secs s)"
    server "$side" "$ap" "$set_" --mode soak --concurrency 64 --seconds "$secs" --sample-seconds 5 --out "$OUT/soak/$side-$ap-$set_-n64.json"
    log "done $side-$ap $set_ (exit $?)"
done
log "p5131-soak-run done"
