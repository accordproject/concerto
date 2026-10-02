#!/bin/sh
# Rebuild the migration progress log into $LOG_OUT (default migration/log/out).
#
#   sh migration/log/run.sh            fetch from GitHub, then build everything
#   LOG_SKIP_FETCH=1 sh ...            rebuild from the raw/ already in $LOG_OUT
#   LOG_PAGE=1 sh ...                  also render the HTML page (not committed; publishing is a coordinator step)
#
# Needs python3 (stdlib only), git, and gh authenticated for the fetch step. See README.md
# for LOG_UNTIL, CONCERTO_RUST_REPO and the optional transcript inputs.
set -eu
here=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
if [ -z "${LOG_SKIP_FETCH:-}" ]; then
  python3 "$here/fetch.py"
fi
python3 "$here/jobs.py"
python3 "$here/perf.py"
python3 "$here/events.py"
python3 "$here/sessions.py"
python3 "$here/timeline.py"
if [ -n "${LOG_PAGE:-}" ]; then
  python3 "$here/page/tsbugs.py"
  python3 "$here/page/gen_page.py"
fi
