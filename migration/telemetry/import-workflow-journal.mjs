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
//   - `label` is parsed as "<task>:<role>" (split on the first ':').
//     A label with no ':' becomes task=<label>, role=null. A missing
//     label becomes task=null, role=null and the pair is still emitted
//     (with a note) so nothing is silently dropped.
//   - `attempt` isn't in the journal, so it is inferred as "the nth time
//     this task id has started so far in this journal" (1-based). Pass
//     --attempts-from-events to instead continue numbering after
//     whatever attempts already exist for that task in an existing
//     events.jsonl.
//   - Token totals are the sum, over every transcript line with a
//     `message.usage`, of input_tokens + output_tokens +
//     cache_creation_input_tokens + cache_read_input_tokens. This is a
//     coarse "tokens touched" figure, not a billing figure.
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
  return (
    n(usage.input_tokens) +
    n(usage.output_tokens) +
    n(usage.cache_creation_input_tokens) +
    n(usage.cache_read_input_tokens)
  );
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

function parseLabel(label) {
  if (!label) return { task: null, role: null };
  const idx = label.indexOf(':');
  if (idx === -1) return { task: label, role: null };
  return { task: label.slice(0, idx), role: label.slice(idx + 1) };
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
    const { task, role } = parseLabel(label);

    const attempt = task
      ? (attemptCounters.set(task, (attemptCounters.get(task) || 0) + 1), attemptCounters.get(task))
      : null;

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

    const workflowRunId = opts.workflowRunId || path.basename(journalDir);

    if (startedRec) {
      emitted.push({
        timestamp: startTs,
        event: 'started',
        task,
        attempt,
        role,
        source: 'import-workflow-journal',
        label: label || null,
        workflow_run_id: workflowRunId,
        transcript: agentId ? (findTranscript(journalDir, agentId) || null) : null,
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
        role,
        tokens,
        duration_ms: durationMs,
        source: 'import-workflow-journal',
        label: label || null,
        workflow_run_id: workflowRunId,
        transcript: agentId ? (findTranscript(journalDir, agentId) || null) : null,
        reason: [status ? `status=${status}` : null, summary, ...reasonBits]
          .filter(Boolean)
          .join(' | ') || null,
      });
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
