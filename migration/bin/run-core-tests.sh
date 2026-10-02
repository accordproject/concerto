#!/usr/bin/env bash
# Runs the concerto-core mocha/nyc suite with caller-supplied, isolated
# nyc temp/report directories, so parallel agents never collide on
# nyc's default .nyc_output / coverage dirs.
#
# Usage:
#   run-core-tests.sh --nyc-temp-dir <dir> --report-dir <dir> \
#       [--json-out <path>] [--] [test-file-or-glob ...]
#
# Env var equivalents (used if the matching flag is not given):
#   NYC_TEMP_DIR   -> --nyc-temp-dir
#   NYC_REPORT_DIR -> --report-dir
#   MOCHA_JSON_OUT -> --json-out
#
# With no test files/globs given, the full `test/` tree is run
# (--recursive), after packages/concerto-core/test-lifted/fallbacks.spec.js. Pass one or more files for a fast, per-file run while
# iterating; do a full-suite run only when you need the whole picture.
#
# Exit code is mocha/nyc's exit code (non-zero on test failure or on a
# coverage-threshold miss).

set -euo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORE_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd)/packages/concerto-core"

NYC_TEMP_DIR="${NYC_TEMP_DIR:-}"
NYC_REPORT_DIR="${NYC_REPORT_DIR:-}"
MOCHA_JSON_OUT="${MOCHA_JSON_OUT:-}"
FILES=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --nyc-temp-dir)
      NYC_TEMP_DIR="$2"; shift 2 ;;
    --report-dir)
      NYC_REPORT_DIR="$2"; shift 2 ;;
    --json-out)
      MOCHA_JSON_OUT="$2"; shift 2 ;;
    --)
      shift
      FILES+=("$@")
      break ;;
    *)
      FILES+=("$1"); shift ;;
  esac
done

if [[ -z "$NYC_TEMP_DIR" || -z "$NYC_REPORT_DIR" ]]; then
  echo "ERROR: --nyc-temp-dir and --report-dir (or NYC_TEMP_DIR / NYC_REPORT_DIR) are required" >&2
  exit 2
fi

mkdir -p "$NYC_TEMP_DIR" "$NYC_REPORT_DIR"

if [[ ${#FILES[@]} -eq 0 ]]; then
  # The full gate run: the P5-02b lifted fallback checks count towards nyc,
  # as in concerto-core's own `test` script. They run first, because
  # test/serializer/jsongenerator.js leaves a sinon stub on ModelUtil.isEnum
  # for the rest of the process.
  FILES=("test-lifted/fallbacks.spec.js" "test/")

  # The lifted checks also run each case against the published reference
  # (migration/oracle/reference, concerto-core@5.0.0). Without its
  # dependencies those halves are skipped (one pending test and a warning
  # give the reason), so a gate run installs them first. Set CONCERTO_SKIP_REFERENCE_INSTALL=1 to
  # opt out (the run then says so).
  REF_DIR="$(CDPATH= cd -- "$SCRIPT_DIR/../oracle/reference" && pwd)"
  if [[ ! -d "$REF_DIR/node_modules" ]]; then
    if [[ "${CONCERTO_SKIP_REFERENCE_INSTALL:-}" == "1" ]]; then
      echo "WARNING: $REF_DIR has no node_modules; the reference@5.0.0 lifted checks will be skipped" >&2
    else
      echo "run-core-tests: installing reference dependencies in $REF_DIR" >&2
      (cd "$REF_DIR" && npm ci --no-audit --no-fund --silent) || {
        echo "ERROR: npm ci failed in $REF_DIR; the reference@5.0.0 lifted checks cannot run" >&2
        exit 2
      }
    fi
  fi
fi

MOCHA_ARGS=(-r ts-node/register --recursive -t 10000)
if [[ -n "$MOCHA_JSON_OUT" ]]; then
  mkdir -p "$(dirname "$MOCHA_JSON_OUT")"
  MOCHA_ARGS+=(--reporter json --reporter-options "output=$MOCHA_JSON_OUT")
fi

cd "$CORE_DIR"

exec env TS_NODE_PROJECT=tsconfig.build.json TZ=UTC \
  npx nyc --temp-dir "$NYC_TEMP_DIR" --report-dir "$NYC_REPORT_DIR" \
  mocha "${MOCHA_ARGS[@]}" "${FILES[@]}"
