#!/usr/bin/env node
// migration/telemetry/stuck.mjs
//
// Evaluates the nine stuck rules from plan §5.1 over events.jsonl +
// metrics.jsonl + runs/, printing each finding and appending a 'stuck'
// event (with a `cause`) to events.jsonl for every one it finds.
//
// Usage:
//   node stuck.mjs [--events PATH] [--metrics PATH] [--runs-dir PATH]
//        [--thresholds PATH] [--now ISO] [--dry-run] [--quiet]
//
// --now fixes the evaluation clock (defaults to real "now"); pass it for
// reproducible replay over a fixed synthetic log. --dry-run prints the
// stuck events it would append without writing them (also without
// mutating events.jsonl), which is how the synthetic replay test uses it
// twice (once to check what *would* fire, once for real, so the second
// run's fresh 'stuck' events don't get counted as duplicates).
//
// Idempotence: the dispatcher is expected to run this every cycle, so
// every rule below computes a `dedupKey` alongside its finding -- a
// canonical fingerprint of the evidence, not of the moment it was
// evaluated (e.g. the stale activity's own timestamp for 'silent', not how
// long ago that now is). Before appending, main() drops any finding whose
// (cause, task, dedupKey) already has a matching 'stuck' event on record,
// so re-running against an unchanged log adds nothing, and a task that
// reaches a terminal state is naturally "retired" too: its evidence stops
// changing, so its dedupKey stops changing, so nothing new is ever
// recorded for it again (burning additionally hard-skips terminal tasks;
// see checkBurning).
//
// Task/attempt status model (derived purely from events.jsonl, since
// this script does not read migration/queue.yaml -- that belongs to the
// dispatcher, and this owned path only sees the append-only logs):
//   - a task's *state* is decided by the most recent non-stuck,
//     non-escalated event recorded for it:
//       'queued' | 'retried'                              -> queued
//       'started' | 'heartbeat' | 'test_run' | 'commit'    -> running
//       'merged' | 'failed' | 'blocked'                    -> terminal
//   - a task currently 'running' whose most recent activity is older
//     than the silent threshold is treated as *not* running for the
//     purposes of the deadlock rule (see below): it isn't quietly
//     making progress, so it shouldn't count as "something is running".

import fs from 'node:fs';
import path from 'node:path';
import { readJsonl, appendJsonl, parseArgs, EVENTS_FILE, METRICS_FILE, RUNS_DIR, THRESHOLDS_FILE } from './lib.mjs';
import { parseYamlLite } from './yaml-lite.mjs';

const TERMINAL = new Set(['merged', 'failed', 'blocked']);
const QUEUED = new Set(['queued', 'retried']);
const RUNNING = new Set(['started', 'heartbeat', 'test_run', 'commit']);

// global_stall.metric_paths: the real leaf field names status.mjs actually
// writes into metrics.jsonl's `metrics` object (verified against
// migration/telemetry/metrics.jsonl rows on 2026-09-24), not guessed names.
// Covers plan §0's test pass counts, nyc, rust coverage per repo and the
// ledger weight; oracle/mutants/conformance pct fields are included ahead
// of the tasks that populate them (P0-05/P0-07/P5-06) -- until then they
// are simply absent from a row and flattenNumeric() ignores absent keys,
// so listing them early is harmless.
const DEFAULT_GLOBAL_STALL_METRIC_PATHS = [
  'concerto_core_tests.overall.passing',
  'concerto_core_tests.overall.tests',
  'concerto_core_tests.overall.failing',
  'nyc_coverage.statements_pct',
  'nyc_coverage.branches_pct',
  'nyc_coverage.functions_pct',
  'nyc_coverage.lines_pct',
  'rust.concerto-rust.llvm_cov.workspace_lines_pct',
  'rust.concerto-validate-rs.llvm_cov.workspace_lines_pct',
  'ledger.weighted_pct_rust_plus_hybrid',
  'oracle.native.pass_pct',
  'oracle.wasm.pass_pct',
  'oracle.corpus_coverage_of_reference.pct',
  'mutants.catch_rate_pct',
  'conformance.pass_pct',
];

const DEFAULT_THRESHOLDS = {
  silent: { no_activity_minutes: 20 },
  looping: { consecutive_attempts: 3 },
  plateau: { attempts_without_improvement: 3 },
  burning: { tokens_without_commit: 1000000 },
  global_stall: {
    window_hours: 2,
    metric_paths: DEFAULT_GLOBAL_STALL_METRIC_PATHS,
  },
  review_churn: { rejections: 2 },
  external: {
    reason_keywords: [
      'network', 'timeout', 'dns', 'econnrefused', 'permission denied',
      'eacces', '403', '407', 'rate limit', 'proxy',
    ],
  },
};

function loadThresholds(thresholdsPath) {
  let parsed = {};
  try {
    parsed = parseYamlLite(fs.readFileSync(thresholdsPath, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  // Shallow-merge each rule's block over the defaults so a thresholds.yaml
  // that's missing a rule, or missing one field of a rule, still works.
  const merged = {};
  for (const key of new Set([...Object.keys(DEFAULT_THRESHOLDS), ...Object.keys(parsed)])) {
    merged[key] = { ...(DEFAULT_THRESHOLDS[key] || {}), ...(parsed[key] || {}) };
  }
  return merged;
}

function byTaskAttempt(events) {
  const tasks = new Map(); // task -> array of events (in file order = chronological)
  for (const e of events) {
    if (!e.task) continue;
    if (!tasks.has(e.task)) tasks.set(e.task, []);
    tasks.get(e.task).push(e);
  }
  return tasks;
}

function latestNonMeta(taskEvents) {
  for (let i = taskEvents.length - 1; i >= 0; i--) {
    const ev = taskEvents[i].event;
    if (ev !== 'stuck' && ev !== 'escalated') return taskEvents[i];
  }
  return null;
}

function minutesBetween(aIso, bIso) {
  return Math.abs(Date.parse(bIso) - Date.parse(aIso)) / 60000;
}

// ---- rule: silent -----------------------------------------------------
function checkSilent(tasks, nowIso, thresholds) {
  const findings = [];
  for (const [task, evs] of tasks) {
    const last = latestNonMeta(evs);
    if (!last || !RUNNING.has(last.event)) continue;
    const gapMin = minutesBetween(last.timestamp, nowIso);
    if (gapMin >= thresholds.silent.no_activity_minutes) {
      findings.push({
        task,
        cause: 'silent',
        reason: `no activity since ${last.event}@${last.timestamp} (${gapMin.toFixed(1)} min ago, threshold ${thresholds.silent.no_activity_minutes})`,
        // Keyed on the stale activity's own timestamp, not on the ever-growing
        // gap: re-evaluating the same silence a minute later must not count
        // as a new finding. A new key (so a new finding) only appears once
        // some activity happens and then the task goes silent again.
        dedupKey: last.timestamp,
      });
    }
  }
  return findings;
}

// ---- rule: looping ------------------------------------------------------
function checkLooping(tasks, thresholds) {
  const findings = [];
  const n = thresholds.looping.consecutive_attempts;
  for (const [task, evs] of tasks) {
    // Last test_run signature seen per attempt, in attempt order.
    const byAttempt = new Map();
    for (const e of evs) {
      if (e.event === 'test_run' && e.signature && typeof e.attempt === 'number') {
        byAttempt.set(e.attempt, e.signature);
      }
    }
    const attempts = [...byAttempt.keys()].sort((a, b) => a - b);
    if (attempts.length < n) continue;
    const lastN = attempts.slice(-n).map((a) => byAttempt.get(a));
    if (lastN.every((sig) => sig === lastN[0])) {
      findings.push({
        task,
        cause: 'looping',
        reason: `same failure signature (${lastN[0]}) on the last ${n} attempts (${attempts.slice(-n).join(', ')})`,
        // Keyed on the signature alone: once this exact signature has been
        // flagged as looping for this task, further attempts that keep
        // failing the same way (or a task that has since gone terminal,
        // where the last-N window never changes) must not re-fire on every
        // evaluation cycle. A genuinely new signature is a new finding.
        dedupKey: lastN[0],
      });
    }
  }
  return findings;
}

// ---- rule: plateau --------------------------------------------------------
// Convention: a test_run (or heartbeat) event's `reason` may carry
// "metric=<number>" -- the task's own progress metric for that attempt
// (e.g. oracle fixtures recorded, or tests passing). Plateau fires when
// the last N attempts all report the same value.
function extractMetric(reason) {
  if (!reason) return null;
  const m = /metric[=:]\s*(-?\d+(?:\.\d+)?)/.exec(reason);
  return m ? Number.parseFloat(m[1]) : null;
}

function checkPlateau(tasks, thresholds) {
  const findings = [];
  const n = thresholds.plateau.attempts_without_improvement;
  for (const [task, evs] of tasks) {
    const byAttempt = new Map();
    for (const e of evs) {
      const metric = extractMetric(e.reason);
      if (metric !== null && typeof e.attempt === 'number') {
        byAttempt.set(e.attempt, metric); // last one wins per attempt
      }
    }
    const attempts = [...byAttempt.keys()].sort((a, b) => a - b);
    if (attempts.length < n) continue;
    const lastN = attempts.slice(-n).map((a) => byAttempt.get(a));
    if (lastN.every((v) => v === lastN[0])) {
      findings.push({
        task,
        cause: 'plateau',
        reason: `metric stuck at ${lastN[0]} for the last ${n} attempts (${attempts.slice(-n).join(', ')})`,
        // Keyed on the stuck value: re-evaluating an unchanged plateau (or
        // one on a task that has since gone terminal) must not re-fire.
        dedupKey: String(lastN[0]),
      });
    }
  }
  return findings;
}

// ---- rule: burning --------------------------------------------------------
// Burning is about an *active* task racking up spend with nothing to show
// for it. A task that has already reached a terminal state (merged,
// failed or blocked) is not "burning" any more, whatever its lifetime
// token total looks like: merged means it finished successfully (a large
// total across its whole history is just cost, not a runaway signal, and
// it has no later commit to reset the counter); failed/blocked means the
// task is already stopped and, in the failed/blocked case, may well have
// been stopped *by* an earlier stuck rule -- re-flagging it as burning
// forever after achieves nothing and pollutes the log.
function checkBurning(tasks, thresholds) {
  const findings = [];
  for (const [task, evs] of tasks) {
    const last = latestNonMeta(evs);
    if (last && TERMINAL.has(last.event)) continue;

    // Tokens accumulated since the most recent 'commit' (or since the
    // start of this task's history if it has never committed).
    let sinceCommit = 0;
    let lastCommitIdx = -1;
    for (let i = 0; i < evs.length; i++) {
      if (evs[i].event === 'commit') lastCommitIdx = i;
    }
    for (let i = lastCommitIdx + 1; i < evs.length; i++) {
      if (typeof evs[i].tokens === 'number') sinceCommit += evs[i].tokens;
    }
    if (sinceCommit > thresholds.burning.tokens_without_commit) {
      findings.push({
        task,
        cause: 'burning',
        reason: `${sinceCommit} tokens used since ${lastCommitIdx === -1 ? 'task start' : 'last commit'} (threshold ${thresholds.burning.tokens_without_commit})`,
        // Keyed on the anchor commit (or "no-commit" if there has never
        // been one): as long as no new commit lands, the burn is the same
        // ongoing episode and must fire only once, even though the token
        // sum itself keeps climbing every cycle as more heartbeats arrive.
        dedupKey: lastCommitIdx === -1 ? 'no-commit' : `since:${evs[lastCommitIdx].timestamp}`,
      });
    }
  }
  return findings;
}

// ---- rule: regression -----------------------------------------------------
function loadRunResult(runsDir, task, attempt) {
  const p = path.join(runsDir, String(task), String(attempt), 'result.json');
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

// The plan's rule is "a test that passed at the previous merge *into the
// integration branch* (any task's merge) and fails now" -- the integration
// branch has one linear history of merges across every task, not one per
// task. Comparing a task only against its own earlier merges (as an
// earlier version of this rule did) means it almost never fires in
// practice, since a real task normally merges exactly once: the check
// must walk ALL 'merged' events across every task, in chronological order,
// and compare each merge's test run against the one immediately before it
// on the integration branch, whichever task that was.
function checkRegression(tasks, runsDir) {
  const allMerges = [];
  for (const [task, evs] of tasks) {
    for (const e of evs) {
      if (e.event === 'merged' && typeof e.attempt === 'number') {
        allMerges.push({ task, attempt: e.attempt, timestamp: e.timestamp, sha: e.sha || null });
      }
    }
  }
  allMerges.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));

  const findings = [];
  for (let i = 1; i < allMerges.length; i++) {
    const prevMerge = allMerges[i - 1];
    const currMerge = allMerges[i];
    const prev = loadRunResult(runsDir, prevMerge.task, prevMerge.attempt);
    const curr = loadRunResult(runsDir, currMerge.task, currMerge.attempt);
    if (!prev || !curr) continue;
    const prevPass = new Set(
      (prev.tests || []).filter((t) => t.status === 'pass').map((t) => t.fullTitle)
    );
    const nowFailing = (curr.tests || []).filter(
      (t) => t.status === 'fail' && prevPass.has(t.fullTitle)
    );
    for (const t of nowFailing) {
      findings.push({
        task: currMerge.task,
        cause: 'regression',
        reason: `"${t.fullTitle}" passed at the previous integration-branch merge (${prevMerge.task} attempt ${prevMerge.attempt}, ${prevMerge.sha || 'no sha'}) but fails at this merge (${currMerge.task} attempt ${currMerge.attempt}, ${currMerge.sha || 'no sha'})`,
        // Keyed on the specific pair of merges and the specific test: each
        // merge in the integration branch's history happens once, so this
        // is naturally stable across re-evaluations without extra state.
        dedupKey: `${prevMerge.task}@${prevMerge.attempt}->${currMerge.task}@${currMerge.attempt}:${t.fullTitle}`,
      });
    }
  }
  return findings;
}

// ---- rule: deadlock (global) -----------------------------------------------
// A task counted as 'silent'-stuck (running but with no recent activity)
// does not count as "something running" here: it isn't making progress,
// so it can't be the reason the queue isn't deadlocked.
function checkDeadlockWithSilent(tasks, silentTaskNames) {
  let running = 0;
  const queuedTasks = [];
  let anyOpen = false;
  for (const [task, evs] of tasks) {
    const last = latestNonMeta(evs);
    if (!last) continue;
    if (TERMINAL.has(last.event)) continue;
    anyOpen = true;
    if (QUEUED.has(last.event)) {
      queuedTasks.push(task);
    } else if (RUNNING.has(last.event)) {
      if (!silentTaskNames.has(task)) running++;
    }
  }
  if (anyOpen && running === 0 && queuedTasks.length > 0) {
    queuedTasks.sort();
    return [
      {
        task: null,
        cause: 'deadlock',
        reason: `${queuedTasks.length} task(s) queued, 0 actively running, queue not finished`,
        // Keyed on the exact set of still-queued tasks: as long as the
        // same tasks are stuck queued with nothing running, this is the
        // same ongoing deadlock, not a new one each cycle. It fires again
        // once the queued set actually changes.
        dedupKey: queuedTasks.join(','),
      },
    ];
  }
  return [];
}

// ---- rule: global_stall (across metrics.jsonl) -----------------------------
function flattenNumeric(obj, prefix, paths, out) {
  if (obj === null || typeof obj !== 'object') return;
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (paths.length === 0 || paths.includes(key)) {
      if (typeof v === 'number') out[key] = v;
    }
    if (v && typeof v === 'object') flattenNumeric(v, key, paths, out);
  }
}

function checkGlobalStall(metricsRows, thresholds) {
  if (metricsRows.length < 2) return [];
  const paths = thresholds.global_stall.metric_paths || [];
  const sorted = [...metricsRows].sort(
    (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)
  );
  const windowMs = thresholds.global_stall.window_hours * 3600 * 1000;
  const last = sorted[sorted.length - 1];
  const windowStart = Date.parse(last.timestamp) - windowMs;
  const windowRows = sorted.filter((r) => Date.parse(r.timestamp) >= windowStart);
  if (windowRows.length < 2) return [];
  const spanMs = Date.parse(windowRows[windowRows.length - 1].timestamp) - Date.parse(windowRows[0].timestamp);
  if (spanMs < windowMs) return []; // not enough history yet to judge a full window

  const snapshots = windowRows.map((r) => {
    const flat = {};
    flattenNumeric(r.metrics || {}, '', paths, flat);
    return flat;
  });
  const keys = new Set();
  for (const s of snapshots) for (const k of Object.keys(s)) keys.add(k);
  if (keys.size === 0) return [];

  let anyMoved = false;
  for (const k of keys) {
    const values = snapshots.map((s) => s[k]).filter((v) => v !== undefined);
    if (values.length < 2) continue;
    if (new Set(values).size > 1) {
      anyMoved = true;
      break;
    }
  }
  if (anyMoved) return [];
  return [
    {
      task: null,
      cause: 'global_stall',
      reason: `no tracked §0 metric moved across ${(spanMs / 3600000).toFixed(1)}h of merges (${windowRows.length} rows checked)`,
      // Keyed on the window's last row: metrics.jsonl only grows on merges
      // or once an hour, so re-evaluating between new rows must not
      // re-fire; a genuinely new row (whether it breaks the stall or
      // extends it) produces a new key, matching the plan's "flag it in
      // the hourly report" cadence.
      dedupKey: `${last.timestamp}:${windowRows.length}`,
    },
  ];
}

// ---- rule: review_churn -----------------------------------------------------
// A task whose latest state is terminal (merged/failed/blocked) is done
// churning: however many rejections it went through on the way, a later
// 'merged' (or 'failed'/'blocked') event means the churn was resolved (or
// the task stopped for another reason already captured by another rule),
// so it must not be reported as an ongoing review_churn condition. Same
// convention as checkBurning above.
function checkReviewChurn(tasks, thresholds) {
  const findings = [];
  const n = thresholds.review_churn.rejections;
  for (const [task, evs] of tasks) {
    const last = latestNonMeta(evs);
    if (last && TERMINAL.has(last.event)) continue;
    const rejections = evs.filter(
      (e) => e.event === 'review_verdict' && /reject/i.test(e.reason || '')
    );
    if (rejections.length >= n) {
      findings.push({
        task,
        cause: 'review_churn',
        reason: `rejected ${rejections.length} time(s) in review (threshold ${n})`,
        // Keyed on the count reached: stable across re-evaluations until a
        // further rejection pushes the count up, which is worth a new
        // finding.
        dedupKey: String(rejections.length),
      });
    }
  }
  return findings;
}

// ---- rule: external -----------------------------------------------------
function checkExternal(tasks, thresholds) {
  const findings = [];
  const keywords = (thresholds.external.reason_keywords || []).map((k) => String(k).toLowerCase());
  for (const [task, evs] of tasks) {
    for (const e of evs) {
      if (e.event !== 'blocked') continue;
      const reason = (e.reason || '').toLowerCase();
      const hit = keywords.find((k) => reason.includes(k));
      if (hit) {
        findings.push({
          task,
          cause: 'external',
          reason: `blocked event matched external-failure keyword "${hit}": ${e.reason}`,
          // Keyed on the specific blocked event's own timestamp: the same
          // blocked event must not re-fire on every cycle; a later, new
          // 'blocked' event is a new external failure worth its own finding.
          dedupKey: e.timestamp,
        });
        break; // one finding per task is enough
      }
    }
  }
  return findings;
}

function main() {
  const args = parseArgs(process.argv.slice(2), {
    flags: ['events', 'metrics', 'runs-dir', 'thresholds', 'now'],
    booleans: ['dry-run', 'quiet'],
  });

  const eventsFile = args.events ? path.resolve(args.events) : EVENTS_FILE;
  const metricsFile = args.metrics ? path.resolve(args.metrics) : METRICS_FILE;
  const runsDir = args['runs-dir'] ? path.resolve(args['runs-dir']) : RUNS_DIR;
  const thresholdsFile = args.thresholds ? path.resolve(args.thresholds) : THRESHOLDS_FILE;
  const nowIso = args.now || new Date().toISOString();

  const thresholds = loadThresholds(thresholdsFile);
  const events = readJsonl(eventsFile);
  const metricsRows = readJsonl(metricsFile);
  const tasks = byTaskAttempt(events);

  const silent = checkSilent(tasks, nowIso, thresholds);
  const looping = checkLooping(tasks, thresholds);
  const plateau = checkPlateau(tasks, thresholds);
  const burning = checkBurning(tasks, thresholds);
  const regression = checkRegression(tasks, runsDir);
  const deadlock = checkDeadlockWithSilent(tasks, new Set(silent.map((f) => f.task)));
  const globalStall = checkGlobalStall(metricsRows, thresholds);
  const reviewChurn = checkReviewChurn(tasks, thresholds);
  const external = checkExternal(tasks, thresholds);

  const allFindings = [
    ...silent, ...looping, ...plateau, ...burning, ...regression,
    ...deadlock, ...globalStall, ...reviewChurn, ...external,
  ];

  // Dedup: a 'stuck' event already recorded for this (task, cause) with the
  // same evidence (dedupKey) is the same ongoing condition, not a new one --
  // the dispatcher runs this every cycle, so without this every rule that
  // still matches would re-append forever. A prior 'stuck' event that
  // predates this field (no dedup_key at all) is treated as an unconditional
  // match too, so upgrading an existing events.jsonl doesn't itself cause a
  // burst of "new" duplicates for conditions already on record.
  const seenKeys = new Set();
  for (const e of events) {
    if (e.event !== 'stuck') continue;
    const taskKey = e.task ?? '';
    if (Object.prototype.hasOwnProperty.call(e, 'dedup_key')) {
      seenKeys.add(`${e.cause}::${taskKey}::${e.dedup_key ?? ''}`);
    } else {
      seenKeys.add(`${e.cause}::${taskKey}::*`);
    }
  }

  const findings = allFindings.filter((f) => {
    const taskKey = f.task ?? '';
    const key = `${f.cause}::${taskKey}::${f.dedupKey ?? ''}`;
    const legacyKey = `${f.cause}::${taskKey}::*`;
    return !seenKeys.has(key) && !seenKeys.has(legacyKey);
  });

  const stuckEvents = findings.map((f) => ({
    timestamp: nowIso,
    event: 'stuck',
    task: f.task,
    cause: f.cause,
    reason: f.reason,
    dedup_key: f.dedupKey ?? null,
    source: 'stuck.mjs',
  }));

  if (!args.quiet) {
    if (stuckEvents.length === 0) {
      process.stderr.write('stuck: no stuck conditions detected\n');
    } else {
      for (const e of stuckEvents) {
        process.stderr.write(`stuck: [${e.cause}] ${e.task || '(global)'}: ${e.reason}\n`);
      }
    }
  }
  for (const e of stuckEvents) {
    process.stdout.write(JSON.stringify(e) + '\n');
  }

  if (!args['dry-run']) {
    appendJsonl(eventsFile, stuckEvents);
  }
}

main();
