#!/usr/bin/env bash
# migration/telemetry/test/run-stuck-replay.sh
#
# Proves stuck.mjs's nine rules each fire exactly once on the synthetic
# "fires" replay, and that none of them fire on the synthetic "clean" run.
# Uses --dry-run throughout so it never mutates any events.jsonl.
#
# Usage: bash migration/telemetry/test/run-stuck-replay.sh
# Exit code 0 = pass, non-zero = fail (see stderr for which rule).

set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TELEMETRY_DIR="$(dirname "$HERE")"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

EXPECTED_CAUSES=(silent looping plateau burning regression deadlock global_stall review_churn external)

echo "== replay 1: synthetic-events.jsonl (every rule should fire exactly once) =="
node "$TELEMETRY_DIR/stuck.mjs" \
  --events "$HERE/synthetic-events.jsonl" \
  --metrics "$HERE/synthetic-metrics.jsonl" \
  --runs-dir "$HERE/synthetic-runs" \
  --thresholds "$TELEMETRY_DIR/thresholds.yaml" \
  --now 2026-01-01T06:00:00.000Z \
  --dry-run --quiet > "$TMP/fires.jsonl"

fail=0

for cause in "${EXPECTED_CAUSES[@]}"; do
  count=$(node -e "
    const fs = require('fs');
    const lines = fs.readFileSync(process.argv[1], 'utf8').split('\n').filter(Boolean);
    const n = lines.filter(l => JSON.parse(l).cause === process.argv[2]).length;
    console.log(n);
  " "$TMP/fires.jsonl" "$cause")
  if [ "$count" -eq 1 ]; then
    echo "  ok: $cause fired exactly once"
  else
    echo "  FAIL: $cause fired $count time(s), expected exactly 1" >&2
    fail=1
  fi
done

total=$(wc -l < "$TMP/fires.jsonl" | tr -d ' ')
if [ "$total" -ne "${#EXPECTED_CAUSES[@]}" ]; then
  echo "  FAIL: expected exactly ${#EXPECTED_CAUSES[@]} stuck events total, got $total" >&2
  fail=1
fi

echo "== replay 2: synthetic-events-clean.jsonl (nothing should fire) =="
node "$TELEMETRY_DIR/stuck.mjs" \
  --events "$HERE/synthetic-events-clean.jsonl" \
  --metrics "$HERE/synthetic-metrics-clean.jsonl" \
  --runs-dir "$HERE/synthetic-runs-clean" \
  --thresholds "$TELEMETRY_DIR/thresholds.yaml" \
  --now 2026-01-01T02:40:00.000Z \
  --dry-run --quiet > "$TMP/clean.jsonl"

clean_total=$(wc -l < "$TMP/clean.jsonl" | tr -d ' ')
if [ "$clean_total" -eq 0 ]; then
  echo "  ok: no stuck events on the clean run"
else
  echo "  FAIL: expected 0 stuck events on the clean run, got $clean_total" >&2
  cat "$TMP/clean.jsonl" >&2
  fail=1
fi

echo "== replay 3: three non-dry-run dispatcher cycles over the same fixture (dedup) =="
# Reproduces the dispatcher running stuck.mjs every cycle against a log that
# hasn't changed between cycles. Without dedup this used to add a fresh
# 'stuck' event per cause per cycle (9 causes x 3 cycles = 27); with it,
# each cause must still fire exactly once in total across all three cycles,
# and a task that has since gone terminal (LOOP-1/PLATEAU-1/REVIEW_CHURN-1/
# EXTERNAL-1 all end failed/blocked) must not keep re-appearing either.
CYCLE_DIR="$TMP/cycle"
mkdir -p "$CYCLE_DIR/runs"
cp "$HERE/synthetic-events.jsonl" "$CYCLE_DIR/events.jsonl"
cp "$HERE/synthetic-metrics.jsonl" "$CYCLE_DIR/metrics.jsonl"
cp -r "$HERE/synthetic-runs/." "$CYCLE_DIR/runs/"

for cycle in 1 2 3; do
  node "$TELEMETRY_DIR/stuck.mjs" \
    --events "$CYCLE_DIR/events.jsonl" \
    --metrics "$CYCLE_DIR/metrics.jsonl" \
    --runs-dir "$CYCLE_DIR/runs" \
    --thresholds "$TELEMETRY_DIR/thresholds.yaml" \
    --now 2026-01-01T06:00:00.000Z \
    --quiet > "$TMP/cycle-$cycle.jsonl"
done

for cause in "${EXPECTED_CAUSES[@]}"; do
  count=$(node -e "
    const fs = require('fs');
    const lines = fs.readFileSync(process.argv[1], 'utf8').split('\n').filter(Boolean);
    const n = lines.filter(l => JSON.parse(l).event === 'stuck' && JSON.parse(l).cause === process.argv[2]).length;
    console.log(n);
  " "$CYCLE_DIR/events.jsonl" "$cause")
  if [ "$count" -eq 1 ]; then
    echo "  ok: $cause recorded exactly once across 3 cycles"
  else
    echo "  FAIL: $cause recorded $count time(s) across 3 cycles, expected exactly 1" >&2
    fail=1
  fi
done

cycle2_new=$(wc -l < "$TMP/cycle-2.jsonl" | tr -d ' ')
cycle3_new=$(wc -l < "$TMP/cycle-3.jsonl" | tr -d ' ')
if [ "$cycle2_new" -eq 0 ] && [ "$cycle3_new" -eq 0 ]; then
  echo "  ok: cycles 2 and 3 added no new stuck events"
else
  echo "  FAIL: cycle 2 added $cycle2_new, cycle 3 added $cycle3_new new stuck event(s), expected 0" >&2
  fail=1
fi

if [ "$fail" -eq 0 ]; then
  echo "PASS: all nine stuck rules fire exactly once on the synthetic replay, none fire on the clean run, and repeated cycles do not duplicate findings"
  exit 0
else
  echo "FAIL: see above" >&2
  exit 1
fi
