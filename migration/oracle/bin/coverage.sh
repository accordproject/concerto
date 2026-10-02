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
# over a scratch copy of packages/concerto-core whose src/ AND test/ are
# replaced with `git archive v5.0.0 -- packages/concerto-core/{src,test}`:
# the v5.0.0 suite over the v5.0.0 source (README.md "Coverage"). The
# workspace test/ is no longer the v5.0.0 suite: R1's approved test changes
# (P5-24, P5-33, P5-49, P5-50, P5-52, P5-63 and the P5-09 allow-list) assert
# R1 behaviour and fail on v5.0.0 src by design (task P5-86,
# accordproject/concerto-rust#432). Then writes
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
# ts-node. The suite leg's test/decoratormanager.js additionally requires
# @accordproject/concerto-vocabulary through node_modules (it is not a
# concerto-core package.json dependency, only a workspace sibling resolved
# via the root node_modules symlink), and mocha loads test files with plain
# `require`, not ts-node, so an unbuilt dist/ there is a hard
# MODULE_NOT_FOUND at load time, before any test runs -- not a coverage gap.
# Building here, once, up front covers all three legs.
#
# -w is given the package NAME (not the "packages/<dir>" path) because npm
# resolves a path given to -w relative to the process's cwd, not to
# --prefix: once the script below `cd`s into packages/concerto-core (for
# leg 2 and the suite leg), a `-w packages/concerto-core` there fails with
# "No workspaces found" even though --prefix "$REPO_DIR" is correct. The
# package name matches regardless of cwd.
# Order matters: concerto-vocabulary's src imports @accordproject/concerto-core
# (vocabulary.ts, vocabularymanager.ts) even though it is not a package.json
# dependency (only a workspace sibling resolved via the root node_modules
# symlink, same as the suite leg's decoratormanager.js in reverse), so it
# must build AFTER concerto-core, not before -- matching the root's own
# canonical build:ordered (level0 util, level1 cto+core, level2 incl.
# vocabulary). Building vocabulary first fails with TS2307 "Cannot find
# module '@accordproject/concerto-core'" on any worktree where concerto-core
# has not already been built by something else first.
npm run build -w @accordproject/concerto-util --prefix "$REPO_DIR" >/dev/null
npm run build -w @accordproject/concerto-cto --prefix "$REPO_DIR" >/dev/null
npm run build -w @accordproject/concerto-core --prefix "$REPO_DIR" >/dev/null
npm run build -w @accordproject/concerto-vocabulary --prefix "$REPO_DIR" >/dev/null

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
  # Point the suite leg at the v5.0.0 reference, as leg 1 (corpus -> frozen
  # reference) already does: swap packages/concerto-core/src AND test/ for the
  # frozen tag's own src/ and test/, run the v5.0.0 suite, then restore the
  # workspace src/ and test/ exactly as they were, whatever they held.
  # test/ is swapped too because the workspace test/ carries R1's approved
  # test changes (P5-86, accordproject/concerto-rust#432): they assert R1
  # behaviour, so running them against v5.0.0 src fails by design and says
  # nothing about the reference's coverage. The swap is transient: the
  # workspace test/ is moved aside and moved back unchanged (never edited).
  rm -rf "$WORK/suite-nyc-tmp" "$WORK/suite-nyc-report" "$WORK/suite-src-backup" "$WORK/suite-test-backup"
  mv "$CORE_DIR/src" "$WORK/suite-src-backup"
  restore_workspace_src() {
    rm -rf "$CORE_DIR/src"
    mv "$WORK/suite-src-backup" "$CORE_DIR/src"
    if [[ -d "$WORK/suite-test-backup" ]]; then
      rm -rf "$CORE_DIR/test"
      mv "$WORK/suite-test-backup" "$CORE_DIR/test"
    fi
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
  mv "$CORE_DIR/test" "$WORK/suite-test-backup"
  mkdir -p "$CORE_DIR/test"
  git -C "$REPO_DIR" archive v5.0.0 -- packages/concerto-core/test \
    | tar -x -C "$CORE_DIR/test" --strip-components=3
  # The unit tests load the package through its package.json "main"
  # (dist/index.js), not via ts-node, so dist/ must be rebuilt from the
  # swapped-in v5.0.0 src before running them - otherwise mocha runs against
  # whatever dist/ happened to be built from before this leg (the workspace's
  # diverged src/), defeating the whole point of the swap.
  npm run build -w @accordproject/concerto-core --prefix "$REPO_DIR" >/dev/null
  set +e
  npx nyc --temp-dir "$WORK/suite-nyc-tmp" --report-dir "$WORK/suite-nyc-report" \
    --reporter json --reporter json-summary --reporter text-summary --check-coverage=false \
    mocha -r ts-node/register --recursive -t 10000 --reporter dot test/ > "$WORK/suite-coverage.log" 2>&1
  suite_status=$?
  set -e
  grep -E 'passing|failing|Statements|Branches|Functions|Lines' "$WORK/suite-coverage.log" || true

  # A crashed or empty suite (e.g. a MODULE_NOT_FOUND at load time, before
  # mocha reports anything) must fail the script loudly instead of quietly
  # producing near-zero coverage that coverage-gaps.js then reads as a
  # "clean" suite leg with no unexplained branches. Check the exit status,
  # that at least one test passed, that none failed, and that the reported
  # coverage is non-trivial -- any one of these being off means the suite
  # didn't actually run the v5.0.0 suite over the swapped-in v5.0.0 src.
  passing_count="$(grep -oE '[0-9]+ passing' "$WORK/suite-coverage.log" | grep -oE '^[0-9]+' | tail -1 || true)"
  failing_count="$(grep -oE '[0-9]+ failing' "$WORK/suite-coverage.log" | grep -oE '^[0-9]+' | tail -1 || true)"
  statements_pct="$(grep -m1 'Statements' "$WORK/suite-coverage.log" | grep -oE '[0-9]+(\.[0-9]+)?' | head -1 || true)"
  suite_ok=1
  if [[ "$suite_status" -ne 0 ]]; then suite_ok=0; fi
  if [[ -z "${passing_count:-}" || "${passing_count:-0}" -eq 0 ]]; then suite_ok=0; fi
  if [[ -n "${failing_count:-}" && "${failing_count:-0}" -ne 0 ]]; then suite_ok=0; fi
  if [[ -z "${statements_pct:-}" ]] || ! awk -v p="${statements_pct:-0}" 'BEGIN{exit !(p>50)}'; then suite_ok=0; fi
  if [[ "$suite_ok" -ne 1 ]]; then
    echo "coverage.sh: unit suite leg failed to produce a real run" \
      "(exit=$suite_status passing=${passing_count:-0} failing=${failing_count:-0} statements=${statements_pct:-0}%)," \
      "see $WORK/suite-coverage.log" >&2
    exit 1
  fi
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
