#!/usr/bin/env node
// migration/telemetry/import-workflow-journal.mjs
//
// Converts a Claude Code workflow's journal/transcript directory into
// migration/telemetry/events.jsonl "started"/"finished" events, one pair
// per dispatched agent.
//
// ---------------------------------------------------------------------
// Format this was written against (observed on this session; see the
// task's pointer at
//   /tmp/claude-0/.../subagents/workflows/wf_<id>/journal.jsonl
// and its sibling agent transcripts at
//   /tmp/claude-0/.../subagents/agent-<agentId>.jsonl (+ .meta.json)):
//
//   journal.jsonl: one JSON object per line, no blank lines, no
//   timestamps of its own:
//     {"type":"launched"}
//     {"type":"started","key":"<dedupe key>","agentId":"<id>","label":"<task>:<role>","phase":"<Phase name>"}
//     {"type":"result","key":"<same key>","agentId":"<id>","result":{...StructuredOutput...}}
//   "started" and "result" share `key`; a task can appear more than once
//   (retries), each with its own key/agentId. A "started" with no later
//   "result" is a still-running (or lost) agent.
//
//   agent-<agentId>.jsonl: the full transcript for that agent, one JSON
//   object per line, each with a `timestamp` (ISO-8601) and, for
//   assistant turns, `message.usage` token counts. The first line's
//   timestamp is treated as the agent's start; the last line's as its
//   finish.
//
//   agent-<agentId>.meta.json: small sidecar with agentType/description;
//   used only as a fallback timestamp source (its mtime) when the
//   transcript itself is missing.
//
// ---------------------------------------------------------------------
// Tolerance / assumptions (documented per the task, since journal formats
// can and do change release to release):
//   - journal.jsonl lines are read one at a time; any line that isn't
//     valid JSON, or isn't one of {launched, started, result}, is
//     skipped (counted and reported, not fatal).
//   - `label` is usually "<task>:<role>" (split on the first ':'), e.g.
//     "P0-02:review". But not every label follows that order: a dispatcher
//     commit step was observed as "commit:P0-01" -- role first, task
//     second. Since a task ID always looks like queue.yaml's own
//     `<LETTERS><digits>-<digits>` shape (e.g. "P0-01") and a role never
//     does, parseLabel() checks which side of the ':' matches that shape
//     and takes THAT side as the task, whichever order it's in, instead of
//     assuming a fixed order. A label with no ':' becomes task=<label>,
//     role=null. A missing label becomes task=null, role=null and the
//     pair is still emitted (with a note) so nothing is silently dropped.
//   - `attempt` isn't in the journal, so it is inferred as "the nth time
//     this task has actually been re-attempted so far in this journal".
//     Only roles that represent a new attempt at the work itself (no role,
//     or one of ATTEMPT_ROLES: implement/fix/retry/reimplement) advance
//     the counter; review-type roles (review/re-review/rereview) and the
//     commit role are agent calls *about* the current attempt, not new
//     attempts, so they reuse whatever attempt number is already current
//     for that task (a review before any attempt was recorded is flagged
//     as an anomaly instead of guessing attempt=1). Getting this wrong
//     previously made every review count as its own attempt, so a task
//     with one implementation plus one fix and two reviews looked like it
//     had reached attempt 4. Pass --attempts-from-events to instead
//     continue numbering after whatever attempts already exist for that
//     task in an existing events.jsonl.
//   - A "commit" role does not get a started/finished agent pair at all
//     (it is the dispatcher's own commit-per-write step, not a task
//     attempt); it becomes a single 'commit' event on the task's current
//     attempt instead, which is what lets stuck.mjs's burning rule reset
//     on it. The journal does not carry the commit SHA, so `sha` is left
//     null and `reason` says to check git log.
//   - A "review"/"re-review" role's result is additionally turned into a
//     'review_verdict' event (reason "approve" or "reject"), so
//     stuck.mjs's review_churn rule can fire from imported data. The
//     verdict is inferred, in priority order, from the result payload's
//     `approved`/`pass`/`passed` boolean, a `verdict` string
//     (reject/fail/block vs. approve/pass/accept/lgtm), then
//     `exit_condition_met`, then `status` (blocked/failed/reject vs.
//     done/approved/pass) -- documented here as a best-effort heuristic
//     over an unspecified review-result shape, not a fixed schema.
//   - Token totals are the sum, over every transcript line with a
//     `message.usage`, of input_tokens + output_tokens +
//     cache_creation_input_tokens -- deliberately excluding
//     cache_read_input_tokens. Prompt caching means most of a long agent
//     conversation's history shows up as cache_read_input_tokens on every
//     single turn (the same earlier context, re-read again and again);
//     summing that across a transcript with many turns multiplies the same
//     context by the turn count and produces totals in the tens of
//     millions for an ordinary task. Excluding it gives a "new tokens this
//     task actually produced or wrote to cache" figure, which is what a
//     token-budget rule like stuck.mjs's burning is meant to track. This is
//     still a coarse figure, not a billing figure.
//   - No model identifier is ever read out of a transcript into an
//     output event: this script does not know and does not care which
//     model ran an agent, by design.
//   - If a transcript file is missing (rotated away, or the agent ran in
//     a different container), the agent's meta.json mtime is used as a
//     start-time fallback and the journal.jsonl file's own mtime as a
//     finish-time fallback, and the event's `reason` says so. If even
//     those are unavailable, both timestamps fall back to "now" at
//     import time and duration is omitted -- the event is still emitted
//     (never dropped), just flagged as low-confidence in `reason`.
//   - A "started" with no matching "result" yields a "started" event
//     only (no "finished"); it is reported as still-open in the summary.
//   - A "result" with no matching "started" (row 0 missing, or the
//     started line failed to parse) still yields a "finished" event,
//     with reason noting the missing start.
//
// Usage:
//   node import-workflow-journal.mjs --dir <journal-dir> [--events-file PATH]
//        [--workflow-run-id ID] [--dry-run] [--attempts-from-events]
//
// <journal-dir> is the directory containing journal.jsonl (e.g.
// .../subagents/workflows/wf_xxxx/). Agent transcripts are looked for as
// <journal-dir>/agent-<id>.jsonl first, then <journal-dir>/../agent-<id>.jsonl
// (matching the layout this was written against, where transcripts live
// one level up from the per-workflow journal directory).

import fs from 'node:fs';
import path from 'node:path';
import { readJsonl, appendJsonl, parseArgs, EVENTS_FILE } from './lib.mjs';

function findTranscript(journalDir, agentId) {
  const candidates = [
    path.join(journalDir, `agent-${agentId}.jsonl`),
    path.join(journalDir, '..', `agent-${agentId}.jsonl`),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function findMeta(journalDir, agentId) {
  const candidates = [
    path.join(journalDir, `agent-${agentId}.meta.json`),
    path.join(journalDir, '..', `agent-${agentId}.meta.json`),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function usageTotal(usage) {
  if (!usage || typeof usage !== 'object') return 0;
  const n = (v) => (typeof v === 'number' ? v : 0);
  // cache_read_input_tokens is deliberately excluded -- see the header
  // comment's "Token totals" note: it is the same earlier conversation
  // re-read on every turn, and summing it across a transcript inflates the
  // total by roughly the turn count.
  return n(usage.input_tokens) + n(usage.output_tokens) + n(usage.cache_creation_input_tokens);
}

/** Summarise a transcript file: {startTs, endTs, tokens, lines} or null if unreadable/empty. */
function summariseTranscript(transcriptPath) {
  let raw;
  try {
    raw = fs.readFileSync(transcriptPath, 'utf8');
  } catch {
    return null;
  }
  const lines = raw.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length === 0) return null;

  let startTs = null;
  let endTs = null;
  let tokens = 0;
  let parsedCount = 0;

  for (const line of lines) {
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    parsedCount++;
    if (obj.timestamp) {
      if (startTs === null || obj.timestamp < startTs) startTs = obj.timestamp;
      if (endTs === null || obj.timestamp > endTs) endTs = obj.timestamp;
    }
    const usage = obj.message && obj.message.usage;
    if (usage) tokens += usageTotal(usage);
  }

  if (parsedCount === 0) return null;
  return { startTs, endTs, tokens, lines: lines.length };
}

// A task ID always looks like queue.yaml's own shape: letters, digits,
// a dash, digits (e.g. "P0-01", "P12-3"). A role word never does.
const TASK_ID_RE = /^[A-Za-z]+\d*-\d+$/;

function parseLabel(label) {
  if (!label) return { task: null, role: null };
  const idx = label.indexOf(':');
  if (idx === -1) return { task: label, role: null };
  const a = label.slice(0, idx);
  const b = label.slice(idx + 1);
  const aIsTask = TASK_ID_RE.test(a);
  const bIsTask = TASK_ID_RE.test(b);
  if (bIsTask && !aIsTask) {
    // Observed order for some dispatcher steps, e.g. "commit:P0-01".
    return { task: b, role: a || null };
  }
  // Default/observed order for agent labels, e.g. "P0-02:review".
  return { task: a, role: b || null };
}

// Roles that represent a brand-new attempt at doing the work, as opposed
// to an agent call *about* an existing attempt (reviewing it, or
// committing its files).
const ATTEMPT_ROLES = new Set(['implement', 'fix', 'retry', 'reimplement']);
const REVIEW_ROLES = new Set(['review', 're-review', 'rereview']);
const COMMIT_ROLE = 'commit';

function isAttemptRole(role) {
  return role === null || role === undefined || ATTEMPT_ROLES.has(role.toLowerCase());
}

function normalizedRole(role) {
  return role ? role.toLowerCase() : role;
}

/** Best-effort verdict extraction from a review-role agent's result payload.
 *  Returns { ok: boolean, source: string } or null if no signal is found.
 *  The result schema for a review-type agent call isn't fixed by the plan,
 *  so this checks several plausible shapes in order of confidence -- see
 *  the header comment's "review_verdict" note. */
function extractReviewVerdict(result) {
  if (!result || typeof result !== 'object') return null;
  if (typeof result.approved === 'boolean') return { ok: result.approved, source: 'approved' };
  if (typeof result.pass === 'boolean') return { ok: result.pass, source: 'pass' };
  if (typeof result.passed === 'boolean') return { ok: result.passed, source: 'passed' };
  if (typeof result.verdict === 'string') {
    if (/reject|fail|block/i.test(result.verdict)) return { ok: false, source: 'verdict' };
    if (/approve|pass|accept|lgtm/i.test(result.verdict)) return { ok: true, source: 'verdict' };
  }
  if (typeof result.exit_condition_met === 'boolean') {
    return { ok: result.exit_condition_met, source: 'exit_condition_met' };
  }
  if (typeof result.status === 'string') {
    if (/blocked|failed|reject/i.test(result.status)) return { ok: false, source: 'status' };
    if (/^done$|approved|pass/i.test(result.status)) return { ok: true, source: 'status' };
  }
  return null;
}

function nowIso() {
  return new Date().toISOString();
}

function importJournal(journalDir, opts) {
  const journalPath = path.join(journalDir, 'journal.jsonl');
  const rawLines = fs.existsSync(journalPath)
    ? fs.readFileSync(journalPath, 'utf8').split('\n')
    : [];

  const started = new Map(); // key -> {agentId, label, phase, seq}
  const results = new Map(); // key -> result payload
  const order = []; // key in first-seen order
  let skipped = 0;
  let malformed = 0;

  for (const rawLine of rawLines) {
    const line = rawLine.trim();
    if (!line) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      malformed++;
      continue;
    }
    if (obj.type === 'launched') continue;
    if (obj.type === 'started') {
      started.set(obj.key, obj);
      order.push(obj.key);
    } else if (obj.type === 'result') {
      results.set(obj.key, obj);
      if (!started.has(obj.key)) order.push(obj.key);
    } else {
      skipped++;
    }
  }

  const attemptCounters = new Map(); // task -> count so far
  if (opts.attemptsFromEvents) {
    const existing = readJsonl(opts.eventsFile);
    for (const e of existing) {
      if (e.task && typeof e.attempt === 'number') {
        attemptCounters.set(e.task, Math.max(attemptCounters.get(e.task) || 0, e.attempt));
      }
    }
  }

  const emitted = [];
  let stillOpen = 0;
  let missingStart = 0;
  let noTranscript = 0;

  const seenKeys = new Set();
  for (const key of order) {
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const startedRec = started.get(key);
    const resultRec = results.get(key);
    const agentId = (startedRec && startedRec.agentId) || (resultRec && resultRec.agentId) || null;
    const label = startedRec && startedRec.label;
    const { task, role: rawRole } = parseLabel(label);
    const role = normalizedRole(rawRole);

    let attempt = null;
    let attemptAnomaly = null;
    if (task) {
      if (isAttemptRole(role)) {
        attemptCounters.set(task, (attemptCounters.get(task) || 0) + 1);
        attempt = attemptCounters.get(task);
      } else {
        // Review/commit-type roles are agent calls about the current
        // attempt, not a new one: reuse whatever attempt is already
        // current for this task instead of incrementing.
        attempt = attemptCounters.get(task) || null;
        if (attempt === null) {
          attemptAnomaly = `role "${rawRole}" seen before any attempt was recorded for ${task}`;
        }
      }
    }

    let startTs = null;
    let endTs = null;
    let tokens = null;
    let reasonBits = [];

    if (agentId) {
      const transcriptPath = findTranscript(journalDir, agentId);
      if (transcriptPath) {
        const summary = summariseTranscript(transcriptPath);
        if (summary) {
          startTs = summary.startTs;
          endTs = summary.endTs;
          tokens = summary.tokens;
        } else {
          noTranscript++;
          reasonBits.push('transcript file present but unparseable/empty');
        }
      } else {
        noTranscript++;
        const metaPath = findMeta(journalDir, agentId);
        if (metaPath) {
          try {
            startTs = fs.statSync(metaPath).mtime.toISOString();
          } catch {
            /* ignore */
          }
        }
        if (fs.existsSync(journalPath)) {
          try {
            endTs = fs.statSync(journalPath).mtime.toISOString();
          } catch {
            /* ignore */
          }
        }
        reasonBits.push('transcript unavailable; timestamps derived from file mtimes');
      }
    } else {
      reasonBits.push('no agentId on this journal entry');
    }

    if (!startTs) {
      startTs = nowIso();
      reasonBits.push('start time unknown; using import time as a placeholder');
    }
    if (!endTs) {
      endTs = startTs;
    }

    if (!startedRec) {
      missingStart++;
      reasonBits.push('no matching "started" journal line');
    }
    if (attemptAnomaly) reasonBits.push(attemptAnomaly);

    const workflowRunId = opts.workflowRunId || path.basename(journalDir);
    const transcriptPathForEvent = agentId ? (findTranscript(journalDir, agentId) || null) : null;

    if (role === COMMIT_ROLE) {
      // The dispatcher's own commit-per-write step, not a task attempt:
      // one 'commit' event on the task's current attempt, not a
      // started/finished agent pair. The journal carries no SHA.
      emitted.push({
        timestamp: endTs,
        event: 'commit',
        task,
        attempt,
        role: rawRole,
        sha: null,
        source: 'import-workflow-journal',
        label: label || null,
        workflow_run_id: workflowRunId,
        transcript: transcriptPathForEvent,
        reason: ['sha not carried in the workflow journal; see git log', ...reasonBits]
          .filter(Boolean)
          .join(' | ') || null,
      });
      if (!resultRec && startedRec) stillOpen++;
      continue;
    }

    if (startedRec) {
      emitted.push({
        timestamp: startTs,
        event: 'started',
        task,
        attempt,
        role: rawRole,
        source: 'import-workflow-journal',
        label: label || null,
        workflow_run_id: workflowRunId,
        transcript: transcriptPathForEvent,
        ...(reasonBits.length ? { reason: reasonBits.join('; ') } : {}),
      });
    }

    if (resultRec) {
      const durationMs =
        startTs && endTs ? Math.max(0, Date.parse(endTs) - Date.parse(startTs)) : null;
      const result = resultRec.result || {};
      const status = result.status || null;
      const summary = typeof result.summary === 'string' ? result.summary.slice(0, 500) : null;
      emitted.push({
        timestamp: endTs,
        event: 'finished',
        task,
        attempt,
        role: rawRole,
        tokens,
        duration_ms: durationMs,
        source: 'import-workflow-journal',
        label: label || null,
        workflow_run_id: workflowRunId,
        transcript: transcriptPathForEvent,
        reason: [status ? `status=${status}` : null, summary, ...reasonBits]
          .filter(Boolean)
          .join(' | ') || null,
      });

      if (REVIEW_ROLES.has(role)) {
        const verdict = extractReviewVerdict(result);
        if (verdict) {
          emitted.push({
            timestamp: endTs,
            event: 'review_verdict',
            task,
            attempt,
            role: rawRole,
            source: 'import-workflow-journal',
            label: label || null,
            workflow_run_id: workflowRunId,
            transcript: transcriptPathForEvent,
            reason: `${verdict.ok ? 'approve' : 'reject'} (inferred from result.${verdict.source})`,
          });
        }
      }
    } else if (startedRec) {
      stillOpen++;
    }
  }

  return {
    emitted,
    stats: {
      journalLines: rawLines.filter((l) => l.trim()).length,
      pairs: order.length,
      stillOpen,
      missingStart,
      noTranscript,
      skippedUnknownType: skipped,
      malformedLines: malformed,
    },
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2), {
    flags: ['dir', 'events-file', 'workflow-run-id'],
    booleans: ['dry-run', 'attempts-from-events'],
  });
  if (!args.dir) {
    process.stderr.write(
      'usage: import-workflow-journal.mjs --dir <journal-dir> [--events-file PATH] ' +
        '[--workflow-run-id ID] [--dry-run] [--attempts-from-events]\n'
    );
    process.exit(1);
  }
  const journalDir = path.resolve(args.dir);
  const eventsFile = args['events-file'] ? path.resolve(args['events-file']) : EVENTS_FILE;

  const { emitted, stats } = importJournal(journalDir, {
    eventsFile,
    workflowRunId: args['workflow-run-id'],
    attemptsFromEvents: args['attempts-from-events'],
  });

  if (args['dry-run']) {
    for (const rec of emitted) process.stdout.write(JSON.stringify(rec) + '\n');
  } else {
    appendJsonl(eventsFile, emitted);
  }

  process.stderr.write(
    `import-workflow-journal: ${journalDir}\n` +
      `  journal lines: ${stats.journalLines} (skipped unknown type: ${stats.skippedUnknownType}, malformed: ${stats.malformedLines})\n` +
      `  agent pairs: ${stats.pairs} -> ${emitted.length} events emitted\n` +
      `  still running (no result yet): ${stats.stillOpen}\n` +
      `  missing "started" line: ${stats.missingStart}\n` +
      `  no usable transcript (used mtime/placeholder fallback): ${stats.noTranscript}\n`
  );
}

main();
