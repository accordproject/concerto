#!/bin/sh
# P5-131 (accordproject/concerto-rust#508): the rows the sweep does not
# cover. Measure only. Run from the concerto checkout root:
#
#   BEFORE_CORE_DIST=<before concerto-core dist> BEFORE_ENGINE_PKG=<before concerto-wasm/pkg> \
#   CHROMIUM=<a Chromium binary for Playwright> WORK=<a scratch dir outside the checkout> \
#   OUT=migration/bench/results/P5-131 sh migration/bench/p5131-extras-run.sh
#
#   1. Concertino speed (P5-127..P5-130, P5-133): p5131-concertino.mjs, the
#      documents from `toConcertino()` (prep), then three rounds of the
#      three sides (concertino, now, ts5), their order rotated per round;
#   2. P5-44: the engine's load time in Node (p5131-load.mjs --mode node,
#      20 fresh processes per case) and the shipped engine files (--mode
#      sizes), now (raw .wasm) against before (base64);
#   3. P5-45: the browser cost, headless (p5131-browser.mjs, 10 reps);
#   4. the web bundles: p5131-bundle.mjs (E1-E3, outside the checkout, as
#      P5-96 found it must be, and without CONCERTO_ENGINE_MODULE) and
#      Concertino's own per-subpath bundle sizes
#      (packages/concertino/scripts/bundleSizes.js --json);
#   5. the files one `filter(() => true)` shares per set, on both heads
#      (p5131-filter-shared.cjs), for P5-123's call-out.
# The quiet gate of p5131-server-run.sh runs before each timed step.
set -u
OUT=${OUT:-migration/bench/results/P5-131}
WORK=${WORK:?WORK must be a scratch directory outside the checkout}
mkdir -p "$OUT/concertino" "$OUT/load" "$OUT/browser" "$OUT/bundle" "$OUT/server" "$WORK"
loads() { cut -d' ' -f1,2,3 /proc/loadavg; }
log() { echo "$(date -u +%H:%M:%S) $* (load $(loads))" | tee -a "$OUT/extras-run-log.txt"; }

MAX=${P515_GATE_MAX:-14400}
waited=0
gate() {
    while :; do
        set -- $(loads)
        busy=$(pgrep -fa 'run-ts\.mjs|p5[0-9a-z]*-(sweep|rounds|profile|server)|--bench|criterion|wasm-instance|(^|/)cargo( |$)|mocha' | grep -v 'p5131-extras-run' | grep -v pgrep | wc -l | tr -d ' ')
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

# 1. Concertino.
DOCS="$WORK/concertino-docs"
node migration/bench/p5131-concertino.mjs --mode prep --docs "$DOCS" > "$OUT/concertino/prep.txt" 2>&1
log "concertino prep (exit $?)"
cp "$DOCS"/*.instances.json "$OUT/concertino/" 2>/dev/null
for r in 1 2 3; do
    gate
    case $r in
        1) sides="concertino now ts5" ;;
        2) sides="now ts5 concertino" ;;
        *) sides="ts5 concertino now" ;;
    esac
    for side in $sides; do
        node migration/bench/p5131-concertino.mjs --side "$side" --docs "$DOCS" --samples 30 --warmup 5 --out "$OUT/concertino/$side-$r.json" > "$OUT/concertino/$side-$r.log" 2>&1
        log "concertino round $r $side (exit $?)"
    done
done

# 2. Node load time and sizes.
gate
BEFORE_CORE_DIST="$BEFORE_CORE_DIST" BEFORE_ENGINE_PKG="$BEFORE_ENGINE_PKG" node migration/bench/p5131-load.mjs --mode node --reps 20 --out "$OUT/load/node.json" > "$OUT/load/node.txt" 2>&1
log "load node (exit $?)"
BEFORE_ENGINE_PKG="$BEFORE_ENGINE_PKG" node migration/bench/p5131-load.mjs --mode sizes --out "$OUT/load/sizes.json" > "$OUT/load/sizes.txt" 2>&1
log "load sizes (exit $?)"

# 3. Browser.
gate
BEFORE_ENGINE_PKG="$BEFORE_ENGINE_PKG" node migration/bench/p5131-browser.mjs --reps 10 ${CHROMIUM:+--executable "$CHROMIUM"} --out "$OUT/browser/browser.json" > "$OUT/browser/browser.txt" 2>&1
log "browser (exit $?)"

# 4. Bundles.
rm -rf "$WORK/bundle-out"
env -u CONCERTO_ENGINE_MODULE node migration/bench/p5131-bundle.mjs "$WORK/bundle-out" > "$OUT/bundle/bundle-run.txt" 2>&1
log "bundle (exit $?)"
cp "$WORK/bundle-out/bundle-sizes.json" "$OUT/bundle/" 2>/dev/null
(cd packages/concertino && node scripts/bundleSizes.js --json) > "$OUT/concertino/bundle-sizes.json" 2> "$OUT/concertino/bundle-sizes.err"
log "concertino bundle sizes (exit $?)"

# 5. Filter sharing.
node migration/bench/p5131-filter-shared.cjs packages/concerto-core/dist --json > "$OUT/server/filter-shared-now.json" 2>&1
log "filter shared now (exit $?)"
CONCERTO_ENGINE_MODULE="$BEFORE_ENGINE_PKG/concerto-engine.cjs" node migration/bench/p5131-filter-shared.cjs "$BEFORE_CORE_DIST" --json > "$OUT/server/filter-shared-before.json" 2>&1
log "filter shared before (exit $?)"
log "p5131-extras-run done"
