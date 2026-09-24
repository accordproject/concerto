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

const DEFAULT_THRESHOLDS = {
  silent: { no_activity_minutes: 20 },
  looping: { consecutive_attempts: 3 },
  plateau: { attempts_without_improvement: 3 },
  burning: { tokens_without_commit: 1000000 },
  global_stall: {
    window_hours: 2,
    metric_paths: [
      'ledger.weighted_pct_rust_plus_hybrid',
      'oracle.corpus_coverage_of_reference.pct',
      'concerto_core_tests.overall.pass_pct',
      'rust.concerto-rust.llvm_cov.lines_pct',
    ],
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
      });
    }
  }
  return findings;
}

// ---- rule: burning --------------------------------------------------------
function checkBurning(tasks, thresholds) {
  const findings = [];
  for (const [task, evs] of tasks) {
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

function checkRegression(tasks, runsDir) {
  const findings = [];
  for (const [task, evs] of tasks) {
    const merges = evs
      .filter((e) => e.event === 'merged' && typeof e.attempt === 'number')
      .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    for (let i = 1; i < merges.length; i++) {
      const prev = loadRunResult(runsDir, task, merges[i - 1].attempt);
      const curr = loadRunResult(runsDir, task, merges[i].attempt);
      if (!prev || !curr) continue;
      const prevPass = new Set(
        (prev.tests || []).filter((t) => t.status === 'pass').map((t) => t.fullTitle)
      );
      const nowFailing = (curr.tests || []).filter(
        (t) => t.status === 'fail' && prevPass.has(t.fullTitle)
      );
      for (const t of nowFailing) {
        findings.push({
          task,
          cause: 'regression',
          reason: `"${t.fullTitle}" passed at merge attempt ${merges[i - 1].attempt} (${merges[i - 1].sha || 'no sha'}) but fails at attempt ${merges[i].attempt} (${merges[i].sha || 'no sha'})`,
        });
      }
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
  let queued = 0;
  let anyOpen = false;
  for (const [task, evs] of tasks) {
    const last = latestNonMeta(evs);
    if (!last) continue;
    if (TERMINAL.has(last.event)) continue;
    anyOpen = true;
    if (QUEUED.has(last.event)) {
      queued++;
    } else if (RUNNING.has(last.event)) {
      if (!silentTaskNames.has(task)) running++;
    }
  }
  if (anyOpen && running === 0 && queued > 0) {
    return [
      {
        task: null,
        cause: 'deadlock',
        reason: `${queued} task(s) queued, 0 actively running, queue not finished`,
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
    },
  ];
}

// ---- rule: review_churn -----------------------------------------------------
function checkReviewChurn(tasks, thresholds) {
  const findings = [];
  const n = thresholds.review_churn.rejections;
  for (const [task, evs] of tasks) {
    const rejections = evs.filter(
      (e) => e.event === 'review_verdict' && /reject/i.test(e.reason || '')
    );
    if (rejections.length >= n) {
      findings.push({
        task,
        cause: 'review_churn',
        reason: `rejected ${rejections.length} time(s) in review (threshold ${n})`,
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

  const findings = [
    ...silent, ...looping, ...plateau, ...burning, ...regression,
    ...deadlock, ...globalStall, ...reviewChurn, ...external,
  ];

  const stuckEvents = findings.map((f) => ({
    timestamp: nowIso,
    event: 'stuck',
    task: f.task,
    cause: f.cause,
    reason: f.reason,
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
