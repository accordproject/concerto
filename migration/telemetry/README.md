# migration/telemetry

Instrumentation for the Rust migration run (plan §5.1): two append-only
logs, plus per-run test records, that stuck detection, the dashboard and
the final report are all queries over.

## Files

| Path | Written by | Purpose |
|---|---|---|
| `events.jsonl` | `migration/bin/emit`, `stuck.mjs`, `import-workflow-journal.mjs`, the dispatcher | One line per task lifecycle event (see `events.schema.json`). |
| `metrics.jsonl` | `migration/bin/status.mjs` (owned by another task) | One row per merge/hour with every plan §0 number. **Not owned by this task; never edit its rows.** |
| `events.schema.json` | this task | JSON Schema for one `events.jsonl` line. |
| `thresholds.yaml` | this task | Starting thresholds for the nine stuck rules. Tune here, not in code. |
| `runs/<task>/<attempt>/result.json` (+ raw `mocha.json`/`junit.xml`) | `record-run.mjs` | Normalised test results for one attempt, with failure signatures. |
| `lib.mjs`, `yaml-lite.mjs` | this task | Shared helpers (JSONL I/O, failure signatures, a tiny YAML reader) used by the scripts below. |

## Scripts

- **`migration/bin/emit <event> --task ID --attempt N [...]`**
  Appends one line to `events.jsonl`. This is what agents call at
  checkpoints (`heartbeat`, `test_run`, ...); the dispatcher writes the
  lifecycle events (`queued`, `started`, `merged`, ...) around every
  agent call. See `emit --help`-style usage in the script's header
  comment, and `events.schema.json` for field meanings. Nothing here
  should ever carry a model name or identifier as a human-readable
  string in a *file this task writes* -- `--model` just carries through
  whatever opaque token the dispatcher already has.

- **`import-workflow-journal.mjs --dir <journal-dir>`**
  Converts a Claude Code workflow's `journal.jsonl` (+ its
  `agent-*.jsonl` transcripts) into events per dispatched agent, with
  timestamps, token totals and duration folded in. The header comment
  documents the exact journal/transcript shape this was written against
  and every fallback it takes when a transcript is missing, so re-read
  that comment before assuming a format change broke it silently -- it
  is built to degrade, not crash. A few label/role details matter
  downstream and are worth restating here:
  - a label's task/role order can go either way (`"P0-02:review"` but
    also `"commit:P0-01"`); the task side is identified by matching
    queue.yaml's `<LETTERS><digits>-<digits>` shape, not by position;
  - only an attempt-type role (no role, or `implement`/`fix`/`retry`/
    `reimplement`) advances that task's attempt counter -- a review,
    re-review or commit call reuses the attempt already in progress,
    so one implementation plus one review plus one fix plus one
    re-review is attempt 2, not attempt 4;
  - a `commit`-role call becomes a single `commit` event (no `sha`,
    since the journal doesn't carry one) instead of a started/finished
    pair, which is what lets `stuck.mjs`'s `burning` rule reset;
  - a review/re-review call's result is additionally turned into a
    `review_verdict` event (`reason`: `approve`/`reject`), inferred
    heuristically from whatever boolean/verdict/status field the result
    payload has, since the plan doesn't fix a review-result schema;
  - token totals sum `input + output + cache_creation` tokens per
    transcript line and deliberately exclude `cache_read` tokens, which
    is the same earlier conversation re-read on every turn -- including
    it would multiply the same context by the turn count and inflate
    totals by orders of magnitude on a long-running agent.

- **`record-run.mjs --task ID --attempt N --mocha-json PATH|--junit-xml PATH`**
  Ingests a mocha JSON-reporter file and/or a cargo-nextest JUnit XML
  file into `runs/<task>/<attempt>/result.json`, computing a failure
  signature (`sha1(full title + "\n" + first error line)`) for every
  failing test.

- **`stuck.mjs [--now ISO] [--dry-run]`**
  Evaluates the nine stuck rules (table below) over `events.jsonl` +
  `metrics.jsonl` + `runs/`, prints each finding, and appends a `stuck`
  event (with `cause`) to `events.jsonl` for each one -- unless
  `--dry-run`, which only prints. Reads `thresholds.yaml` for its
  numbers. Run this on a schedule (the dispatcher's cycle, or the hourly
  report) against the real logs; `test/run-stuck-replay.sh` runs it
  against the synthetic fixtures instead, for a repeatable check that
  the nine rules still work.

- **`final-report.mjs [--out PATH]`**
  Generates the end-of-migration markdown report (critical path,
  time lost to stuck periods, stuck-rule/escalation performance,
  coverage curves, rework, cost, and data-derived candidate lessons)
  from the same three inputs, plus a read-only glance at
  `migration/queue.yaml` for the planned dependency order. It never
  writes to `queue.yaml`.

- **`../dashboard/build.mjs [--out PATH]`**
  Builds `migration/dashboard/out/index.html`: a single self-contained
  static page (inline SVG, no external scripts, light/dark via
  `prefers-color-scheme`) with metric curves + merge markers, a task
  timeline with stuck periods shaded by cause, a burn-up chart, cost by
  model/phase, and the top 10 failure signatures. Lives in
  `migration/dashboard/` (a sibling owned path) since it is a build
  script for that directory's output, but it reads these same logs.

## The nine stuck rules

Detected by `stuck.mjs` purely from `events.jsonl` (+ `metrics.jsonl` for
`global_stall`, + `runs/` for `regression`) -- it does not read
`migration/queue.yaml`, so `deadlock` is inferred from `queued` events
rather than live queue state:

| Cause | Signal | Starting threshold |
|---|---|---|
| `silent` | No activity (heartbeat or otherwise) on a running task | 20 minutes |
| `looping` | Same failure signature on N consecutive attempts | 3 attempts |
| `plateau` | A `metric=<n>` value in `test_run`/`heartbeat` reasons hasn't moved | 3 attempts |
| `burning` | Tokens used since the last `commit` (or task start), on a task that hasn't reached merged/failed/blocked | 1,000,000 |
| `regression` | A test passing at the previous merge *into the integration branch* (any task's merge, not just this task's own) fails at the next one | -- |
| `deadlock` | A task is `queued` and nothing is actively `running` | -- |
| `global_stall` | No tracked plan §0 metric moved across a window of `metrics.jsonl` rows | 2 hours |
| `review_churn` | `review_verdict` events matching "reject" for the same task | 2 rejections |
| `external` | A `blocked` event whose reason matches a network/permission/tool keyword | see `thresholds.yaml` |

A task counted as `silent`-stuck does **not** count as "actively running"
for the `deadlock` check: it isn't making progress, so it can't be the
reason the queue looks unstuck.

`burning` explicitly ignores a task that has already reached `merged`,
`failed` or `blocked`: a merged task's lifetime token total is just cost,
not a runaway signal, and it has no later commit to reset the counter; a
failed/blocked task is already stopped (possibly *by* an earlier stuck
finding) and re-flagging it forever after would be noise, not signal.

`regression` walks **every** `merged` event across **every** task in
chronological order and compares each merge's recorded test run against
the one immediately before it on that timeline, whichever task that was
-- matching the plan's "previous merge into the integration branch", not
"this task's own previous merge". A real task normally merges exactly
once, so comparing only within one task's own history almost never fires
in production; comparing across the whole merge timeline does.

`global_stall`'s tracked metric leaves (`thresholds.yaml`'s
`global_stall.metric_paths`) are the real field names
`migration/bin/status.mjs` writes into `metrics.jsonl` (test pass/fail
counts, the four nyc `*_pct` fields, each Rust repo's
`llvm_cov.workspace_lines_pct`, and the ledger's weighted percentage),
not placeholder names -- a wrong or missing name here means the rule
silently watches nothing (or one slow-moving number) instead of covering
plan §0 as intended. Names status.mjs hasn't started writing yet (oracle
pass %, mutants catch rate, conformance pass %) are listed ahead of time;
until those tasks land they're simply absent from a row, which
`stuck.mjs` treats as "not tracked yet", not "hasn't moved".

### Idempotence

The dispatcher is expected to call `stuck.mjs` every cycle, so every rule
computes a `dedup_key` alongside its finding -- a fingerprint of the
*evidence* (e.g. the stale event's own timestamp for `silent`, the anchor
commit for `burning`), not of the moment it was evaluated. Before
appending, `stuck.mjs` drops any finding whose `(cause, task, dedup_key)`
already has a matching `stuck` event on record, so re-running against an
unchanged log adds nothing. This also "retires" a finished task without
any special-casing: once a task stops changing, its evidence (and so its
dedup key) stops changing too, so nothing new is ever logged for it again.
`test/run-stuck-replay.sh`'s third replay proves this directly by running
three non-dry-run cycles over the same fixture and checking the total
count, not just a single `--dry-run` pass.

## Testing

`test/run-stuck-replay.sh` runs three replays through `stuck.mjs`:

1. `test/synthetic-events.jsonl` + `test/synthetic-metrics.jsonl` +
   `test/synthetic-runs/` (`--dry-run`) -- one scenario per rule, each of
   the nine causes should fire **exactly once**. `BURN-1` deliberately
   does double duty as the `silent` *and* `burning` scenario (a task that
   stopped heartbeating after already burning through its token budget),
   since a genuinely active, still-progressing task would itself
   contradict `deadlock`'s "nothing is running" premise. The regression
   scenario is two *different* tasks (`REG-BASE` merges cleanly, then
   `REGRESSION-1` merges with a test that had passed at `REG-BASE`'s
   merge) rather than one task merged twice artificially, so the test
   actually exercises the cross-task comparison described above.
2. `test/synthetic-events-clean.jsonl` + `test/synthetic-metrics-clean.jsonl`
   + `test/synthetic-runs-clean/` (`--dry-run`) -- a normal-looking run
   where **none** of the nine rules should fire, including two tasks
   (`CLEAN-BURN-MERGED`, `CLEAN-BURN-FAILED`) that burn well over the
   token threshold with no commit but end merged/failed -- proving
   `burning` really does skip terminal tasks rather than just happening
   not to fire in the "fires" fixture.
3. Three **non-dry-run** cycles over a scratch copy of the "fires" fixture
   -- proves dedup: each cause must still be recorded **exactly once** in
   `events.jsonl` after all three cycles (not 9 x 3 = 27), and cycles 2
   and 3 must add zero new lines, reproducing (and guarding against) the
   dispatcher-runs-every-cycle duplication bug directly instead of only
   ever calling `stuck.mjs` once.

Run it with:

```sh
bash migration/telemetry/test/run-stuck-replay.sh
```

It exits non-zero (and says which rule/replay) if any expectation breaks.

## Durability

Telemetry is meant to live on a separate `migration-telemetry` branch of
the `concerto` repo (plan §5.1), so it stays out of the PRs and survives
even if a container is thrown away mid-run. `push-telemetry.sh` copies
this directory into a worktree of that branch and commits+pushes it; see
that script's header for exactly what it does and does not do (it is
never run automatically by anything in this task).

## Design notes / assumptions

- Every script here reads its inputs tolerantly: a missing file reads as
  empty, an unparseable JSONL line is skipped with a stderr warning
  rather than aborting the whole run, and a metrics.jsonl row shaped
  differently than expected just contributes fewer numeric series to the
  dashboard/report rather than crashing them. This matters because
  `metrics.jsonl` is owned by another task and its exact shape may still
  move.
- `thresholds.yaml` is read with a minimal purpose-built parser
  (`yaml-lite.mjs`), not a general YAML library, to keep these scripts
  dependency-free (Node stdlib only). If thresholds.yaml ever needs real
  YAML features, replace `yaml-lite.mjs`'s use with an actual parser
  rather than extending it further.
- No script in this directory ever writes a human-readable model name or
  identifier into a file. `--model` on `emit`, and the `model` field
  wherever it's read back, only ever carries through whatever opaque
  token the caller already had.
