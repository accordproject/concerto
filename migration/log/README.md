# migration/log/

The builder for the migration progress log: the event stream, the hourly burndown, the
performance table and the session and timeline markdown behind the coordinator's migration
page. Task **P5-83** (accordproject/concerto-rust#427) moved it here from one coordinator
session's scratchpad, under the migration plan accordproject/concerto-rust#29, so the data
can be rebuilt from a clean clone.

The scripts only read: GitHub through `gh api`, and git history through `git log` and
`git show`. They write only to the output directory.

## Running it

```sh
# from a concerto checkout; concerto-rust is expected next to it (../concerto-rust)
git -C ../concerto-rust fetch origin claude/tender-pascal-ocwf9q
git fetch origin claude/tender-pascal-ocwf9q
sh migration/log/run.sh                 # fetch + build into migration/log/out/
LOG_PAGE=1 sh migration/log/run.sh      # ... and render the HTML page as well
LOG_SKIP_FETCH=1 sh migration/log/run.sh  # rebuild from the raw/ already fetched
```

Requirements: python3 (standard library only), git, and `gh` signed in for the fetch step.

| Variable | Default | Meaning |
|---|---|---|
| `LOG_OUT` | `migration/log/out` (git-ignored) | output directory |
| `LOG_UNTIL` | now (at fetch time; later steps reuse the value recorded in `raw/fetch_meta.json`) | cutoff: nothing after it is counted |
| `CONCERTO_REPO` | this checkout | concerto clone used for git history |
| `CONCERTO_RUST_REPO` | `../concerto-rust` next to `CONCERTO_REPO` | concerto-rust clone used for git history |
| `LOG_BRANCH` | `origin/claude/tender-pascal-ocwf9q` | integration ref in both clones |
| `LOG_TRANSCRIPT_EVENTS` | `<out>/raw/transcript_events.json` if present | optional curated transcript events |
| `LOG_TRANSCRIPT_SESSIONS` | unset | optional directory of curated coordinator/local-matt session logs to copy in |
| `LOG_TRANSCRIPT_TIMELINE` | unset | optional JSON list of curated transcript-derived page timeline rows (same shape as `timeline_extra` in `page/page_text.json`) |
| `LOG_GH_WORKERS` | `cloud-main,cloud-2,cloud-3` | workers whose session logs are rebuilt from GitHub |

## Steps and outputs

| Step | Reads | Writes |
|---|---|---|
| `fetch.py` | GitHub: every concerto-rust issue with its timeline (#29 onward), issue/PR comments in concerto-rust and concerto, PRs in concerto, concerto-rust and concerto-conformance | `raw/issues_all.json`, `raw/tl/<n>.json`, `raw/comments_all_<repo>.json`, `raw/c_all.json`, `raw/prs_<repo>.json`, `raw/fetch_meta.json` |
| `jobs.py` | `raw/` | `raw/jobs.json`: one record per tracker issue with its label history |
| `perf.py` | concerto `migration/bench/RESULTS.md` and `results/P5-*/` at the commits that published them, plus the GitHub comments of comment-only results | `perf.json` (ratios by operation, with categories), `raw/perf_events.json` |
| `events.py` | `raw/`, `observations.py`, `decisions_curated.py`, concerto `migration/ledger/SUMMARY.md` and `migration/BREAKING-CHANGES-PLAN.md`, concerto-rust `concerto-core/tests/oracle/baseline.tsv` and `DIVERGENCES.md` (first-parent history of the integration branch), perf and transcript events | `events.json`, `burndown.json` (hourly), `raw/job_summaries.json` |
| `sessions.py` | `events.json`, `raw/` | `sessions/<day>-<worker>.md` for the cloud workers |
| `timeline.py` | `events.json` | `timeline.md` |
| `page/tsbugs.py`, `page/gen_page.py` (with `LOG_PAGE=1`) | the outputs above, `page/template.html`, `page/page_text.json` | `tsbugs.json`, `concerto-rust-migration.html` |
| `transcripts.py` (optional, by hand) | local Claude Code transcripts (`.jsonl`) | a TSV of text turns merged by timestamp, for curation |
| `check.py REF` | this build and a reference build | reproduction report |

`events.json` types: `job_start`, `job_end`, `decision`, `plan_change`, `coverage`, `bug`,
`perf`. Each event has `ts`, `task` (`{id, issue}`), `worker`, `summary` and `source` (a
GitHub URL, `repo@sha:path`, or `transcript:<session>:<line>`), and some have `metrics`.
`origin` marks events merged from perf (`perf`) or transcript (`transcript`) inputs.

## Rules

- **Only mttrbrts content counts as a decision.** `events.py` keeps comments by the
  maintainer account and drops the rest; curated decision rows (`decisions_curated.py`)
  each point at an mttrbrts comment. Other authors, bots included, are never a source of
  decisions.
- **Gaps stay gaps.** Values are as published, with their source. Nothing is
  interpolated: burndown coverage values carry forward from the last sourced observation
  with `observed: false`, and are null before the first. When an input is missing (for
  example no transcript events), that part of the log is left empty and the build says so.
- **No unit-test (nyc) coverage series is rendered.** nyc values stay in `events.json` and
  `burndown.json` for the record, but `page/gen_page.py` does not chart them, and the
  template has no nyc series.
- **Cutoff.** Everything after `LOG_UNTIL` is ignored: issue labels and state are replayed
  from timelines to their value at the cutoff, and git history is read only up to it. A
  rebuild with the same cutoff reproduces the same data.
- **Curated values.** `observations.py`, `decisions_curated.py`, the inline plan events in
  `events.py` and the transcribed rows in `perf.py` were read by hand from their sources.
  Add new rows with their source; never edit a value without one.

## Transcripts (optional)

Transcripts are local to the machine that ran a session, so they are not an input of a
clean rebuild. Without them, the transcript-dependent part (the curated
`origin: "transcript"` events, the coordinator and local-matt session logs, and the
page timeline rows sourced from those logs) is absent.
To include it:

1. Extract the text turns: `python3 migration/log/transcripts.py
   coordinator=<coordinator .jsonl or dir> local-matt=<worker .jsonl or dir> --out turns.tsv`.
   Files are streamed line by line and merged by timestamp; line numbers are the
   `transcript:<session>:<line>` references.
2. Curate events from the turns into a JSON list (same shape as `events.json` entries,
   `source: "transcript:<session>:<line>"`; decisions only from the maintainer's own words),
   and curated per-day session logs as `<day>-<session>.md`.
3. Curate any page timeline rows sourced from the session logs into a JSON list (same shape
   as `timeline_extra` in `page/page_text.json`).
4. Build with `LOG_TRANSCRIPT_EVENTS=<events file>`,
   `LOG_TRANSCRIPT_SESSIONS=<session dir>` and, for the page,
   `LOG_TRANSCRIPT_TIMELINE=<timeline rows file>`.

Never commit transcripts or files derived from them here.

## The page

`page/template.html` is a template only: `gen_page.py` injects the built data at
`/*__DATA__*/null`. The rendered page is not committed; publishing it to the Artifact is a
coordinator step. `page/page_text.json` holds the page prose (lede, tiles, notes), which the
coordinator updates with each publish. Its `timeline_extra` rows cite only GitHub or git
sources; rows sourced from transcripts or session logs go in `LOG_TRANSCRIPT_TIMELINE`.

## Checking a rebuild

```sh
LOG_UNTIL=<reference cutoff> sh migration/log/run.sh
python3 migration/log/check.py <reference dir>
```

`check.py` compares perf.json in full, events.json counts by type outside the
transcript-dependent part (and in full when transcript events are supplied), and the
burndown. The reference build of 1 October 2026 (cutoff `2026-10-01T16:47:00Z`, 2,006
events, 773 perf entries) is reproduced exactly from a clean clone: 1,655 events without
transcripts, plus the 351 transcript events when they are supplied.
