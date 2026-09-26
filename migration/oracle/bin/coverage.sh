#!/usr/bin/env bash
# Corpus-only coverage of the reference (task P0-05, plan §2.4).
#
# Usage: migration/oracle/bin/coverage.sh <work dir> [--with-suite]
#
# Replays the whole corpus under nyc, with the corpus as the only driver:
#
# 1. against the frozen reference (reference/node_modules/@accordproject/
#    concerto-core, bin/replay.js --engine reference): nyc instruments its
#    CommonJS dist/*.js and remaps the counts through the package's own source
#    maps to src/*.ts, so the result has the same files and the same branch
#    map as the workspace src/ (the gap list is taken from this run);
# 2. against packages/concerto-core/src through ts-node (--engine src), the
#    same code as the reference, as a cross-check: coverage-gaps.js reports
#    every branch on which the two runs disagree.
#
# With --with-suite it also runs the unit suite under nyc (same command as
# migration/baseline.json) to learn which branches the suite covers -- over
# the frozen v5.0.0 reference source, exactly as leg 1 above does, and NOT
# over the workspace src/ (which has diverged since v5.0.0: engine views in
# modelutil.ts, numbervalidator.ts and scalardeclaration.ts) and NOT over
# leg 2's cross-check src/. Comparing a workspace-src suite run branch-by-id
# against the reference's branch map reports spurious "unexplained" branches
# for every layout mismatch between the two, so the suite leg instead runs
# over a scratch copy of packages/concerto-core whose src/ is replaced with
# `git archive v5.0.0 -- packages/concerto-core/src` (test/ is unchanged
# since v5.0.0, so the same tests run; README.md "Coverage"). Then writes
# migration/oracle/coverage-gaps.json and migration/oracle/results/coverage.json.
set -euo pipefail
WORK="${1:?usage: coverage.sh <work dir> [--with-suite]}"
ORACLE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_DIR="$(cd "$ORACLE_DIR/../.." && pwd)"
CORE_DIR="$REPO_DIR/packages/concerto-core"
REF_PKG="$ORACLE_DIR/reference/node_modules/@accordproject/concerto-core"
NYC="$REPO_DIR/node_modules/.bin/nyc"
mkdir -p "$WORK"
WORK="$(cd "$WORK" && pwd)"
export TZ=UTC

# 0. Build the workspace's own compiled output. Leg 2 (corpus -> workspace
# src/, via ts-node) requires concerto-core's *dependencies* -
# @accordproject/concerto-util and @accordproject/concerto-cto - through
# node_modules, so ts-node's type checker needs their dist/*.d.ts already
# built (a fresh checkout/worktree has none: `npm ci` alone does not build
# workspace packages), or it fails with TS2307 "Cannot find module" and the
# whole leg silently reports 0% coverage. The suite leg (below) also
# requires concerto-core's own dist/index.js (its package.json "main"),
# since the unit tests load the package through its entry point, not via
# ts-node. Building here, once, up front covers both.
#
# -w is given the package NAME (not the "packages/<dir>" path) because npm
# resolves a path given to -w relative to the process's cwd, not to
# --prefix: once the script below `cd`s into packages/concerto-core (for
# leg 2 and the suite leg), a `-w packages/concerto-core` there fails with
# "No workspaces found" even though --prefix "$REPO_DIR" is correct. The
# package name matches regardless of cwd.
npm run build -w @accordproject/concerto-util --prefix "$REPO_DIR" >/dev/null
npm run build -w @accordproject/concerto-cto --prefix "$REPO_DIR" >/dev/null
npm run build -w @accordproject/concerto-core --prefix "$REPO_DIR" >/dev/null

# 1. corpus -> frozen reference. --cwd is the reference package so that its
# dist/ is instrumented even though it lives under node_modules; src/**/*.ts
# must also be included because nyc filters the report after the source-map
# remap. esm/ and esm-browser/ are bundles the CommonJS entry never loads.
rm -rf "$WORK/corpus-ref-nyc-tmp" "$WORK/corpus-ref-nyc-report"
(cd "$REF_PKG" && "$NYC" --cwd "$REF_PKG" --no-exclude-node-modules \
  --include 'dist/**/*.js' --include 'src/**/*.ts' --exclude 'dist/esm/**' --exclude 'dist/esm-browser/**' \
  --all --temp-dir "$WORK/corpus-ref-nyc-tmp" --report-dir "$WORK/corpus-ref-nyc-report" \
  --reporter json --reporter json-summary --reporter text-summary --check-coverage=false \
  node "$ORACLE_DIR/bin/replay.js" --engine reference > "$WORK/corpus-ref-coverage.log" 2>&1) || true
grep -E 'engine=|Statements|Branches|Functions|Lines' "$WORK/corpus-ref-coverage.log"

# 2. corpus -> workspace src/ (cross-check).
cd "$CORE_DIR"
export TS_NODE_PROJECT=tsconfig.build.json
rm -rf "$WORK/corpus-nyc-tmp" "$WORK/corpus-nyc-report"
npx nyc --temp-dir "$WORK/corpus-nyc-tmp" --report-dir "$WORK/corpus-nyc-report" \
  --reporter json --reporter json-summary --reporter text-summary --check-coverage=false \
  node -r ts-node/register "$ORACLE_DIR/bin/replay.js" --engine src > "$WORK/corpus-coverage.log" 2>&1 || true
grep -E 'engine=|Statements|Branches|Functions|Lines' "$WORK/corpus-coverage.log"

SUITE_ARGS=()
if [[ "${2:-}" == "--with-suite" ]]; then
  # Point the suite leg at the v5.0.0 reference src, as leg 1 (corpus ->
  # frozen reference) already does: swap packages/concerto-core/src for the
  # frozen tag's own src/ (test/ is unchanged since v5.0.0), run the suite,
  # then restore the workspace src/ exactly as it was, whatever it held.
  rm -rf "$WORK/suite-nyc-tmp" "$WORK/suite-nyc-report" "$WORK/suite-src-backup"
  mv "$CORE_DIR/src" "$WORK/suite-src-backup"
  restore_workspace_src() {
    rm -rf "$CORE_DIR/src"
    mv "$WORK/suite-src-backup" "$CORE_DIR/src"
    # dist/ was just rebuilt from the swapped-in v5.0.0 src below; rebuild it
    # again from the restored workspace src so the worktree isn't left with a
    # dist/ that silently disagrees with its own src/ once this script exits.
    npm run build -w @accordproject/concerto-core --prefix "$REPO_DIR" >/dev/null
  }
  trap restore_workspace_src EXIT
  mkdir -p "$CORE_DIR/src"
  git -C "$REPO_DIR" archive v5.0.0 -- packages/concerto-core/src \
    | tar -x -C "$CORE_DIR/src" --strip-components=3
  # src/engine/** (the migration's engine views, P4-11) postdates v5.0.0, so
  # it isn't in the archive above; tsconfig.build.internal.json unconditionally
  # includes "src/engine/**/*", and tsc fails the whole build with TS18003 "No
  # inputs were found" if that directory is missing. Carry the workspace's
  # current engine/ over into the swapped-in tree so the build has something to
  # compile there; it isn't exercised by the v5.0.0 test/ suite either way.
  cp -R "$WORK/suite-src-backup/engine" "$CORE_DIR/src/engine"
  # The unit tests load the package through its package.json "main"
  # (dist/index.js), not via ts-node, so dist/ must be rebuilt from the
  # swapped-in v5.0.0 src before running them - otherwise mocha runs against
  # whatever dist/ happened to be built from before this leg (the workspace's
  # diverged src/), defeating the whole point of the swap.
  npm run build -w @accordproject/concerto-core --prefix "$REPO_DIR" >/dev/null
  npx nyc --temp-dir "$WORK/suite-nyc-tmp" --report-dir "$WORK/suite-nyc-report" \
    --reporter json --reporter json-summary --reporter text-summary --check-coverage=false \
    mocha -r ts-node/register --recursive -t 10000 --reporter dot test/ > "$WORK/suite-coverage.log" 2>&1 || true
  grep -E 'passing|failing|Statements|Branches|Functions|Lines' "$WORK/suite-coverage.log"
  restore_workspace_src
  trap - EXIT
  SUITE_ARGS=(--suite "$WORK/suite-nyc-report/coverage-final.json" --suite-summary "$WORK/suite-nyc-report/coverage-summary.json")
fi

node "$ORACLE_DIR/bin/coverage-gaps.js" \
  --corpus "$WORK/corpus-ref-nyc-report/coverage-final.json" \
  --corpus-summary "$WORK/corpus-ref-nyc-report/coverage-summary.json" \
  --corpus-src "$WORK/corpus-nyc-report/coverage-final.json" \
  --corpus-src-summary "$WORK/corpus-nyc-report/coverage-summary.json" \
  "${SUITE_ARGS[@]}"
