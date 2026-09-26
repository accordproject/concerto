#!/usr/bin/env node
// migration/telemetry/final-report.mjs
//
// Generates the end-of-migration markdown report (plan §5.1) from
// events.jsonl, metrics.jsonl and runs/, plus a read-only look at
// migration/queue.yaml for the planned dependency order (queue.yaml is
// owned by another task; this script only reads it, never writes it).
//
// Sections (plan §5.1 "Final report"):
//   - the actual critical path against the planned one
//   - time lost to stuck periods, by cause
//   - how the stuck rules and model escalations performed
//   - the coverage curves
//   - rework: review rejections and regressions per phase
//   - cost per task, phase and model
//   - lessons learned
//
// Usage:
//   node final-report.mjs [--events PATH] [--metrics PATH] [--runs-dir PATH]
//        [--queue PATH] [--out PATH]
//
// Prints the report to stdout when --out is omitted.

import fs from 'node:fs';
import path from 'node:path';
import { readJsonl, parseArgs, EVENTS_FILE, METRICS_FILE, RUNS_DIR, MIGRATION_ROOT } from './lib.mjs';

const TERMINAL = new Set(['merged', 'failed', 'blocked']);

function phaseOf(task) {
  const m = /^([A-Za-z]+\d+)/.exec(task || '');
  return m ? m[1] : 'unphased';
}

function byTask(events) {
  const tasks = new Map();
  for (const e of events) {
    if (!e.task) continue;
    if (!tasks.has(e.task)) tasks.set(e.task, []);
    tasks.get(e.task).push(e);
  }
  for (const evs of tasks.values()) evs.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  return tasks;
}

function fmtHours(ms) {
  return (ms / 3600000).toFixed(2) + 'h';
}

/** Very small, deliberately narrow reader for migration/queue.yaml's
 *  "- id: X" / "deps: [A, B]" / "priority: Pn" shape -- not a general
 *  YAML parser (this file does not own queue.yaml's schema). Tolerant:
 *  any task block it can't fully parse is skipped, never fatal. */
function readQueuePlan(queuePath) {
  let text;
  try {
    text = fs.readFileSync(queuePath, 'utf8');
  } catch {
    return [];
  }
  const tasks = [];
  const blocks = text.split(/\n(?=\s*- id:)/);
  for (const block of blocks) {
    const idM = /- id:\s*"?([\w.-]+)"?/.exec(block);
    if (!idM) continue;
    const depsM = /deps:\s*\[([^\]]*)\]/.exec(block);
    const prioM = /priority:\s*"?(\w+)"?/.exec(block);
    const deps = depsM
      ? depsM[1].split(',').map((s) => s.trim().replace(/^"|"$/g, '')).filter(Boolean)
      : [];
    tasks.push({ id: idM[1], deps, priority: prioM ? prioM[1] : null });
  }
  return tasks;
}

/** Longest dependency chain through the planned queue (a proxy critical
 *  path when no per-task planned duration exists in the plan). */
function longestChain(planTasks) {
  const byId = new Map(planTasks.map((t) => [t.id, t]));
  const memo = new Map();
  function chainFrom(id) {
    if (memo.has(id)) return memo.get(id);
    const t = byId.get(id);
    if (!t || t.deps.length === 0) {
      const result = [id];
      memo.set(id, result);
      return result;
    }
    let best = [];
    for (const d of t.deps) {
      const c = chainFrom(d);
      if (c.length > best.length) best = c;
    }
    const result = [...best, id];
    memo.set(id, result);
    return result;
  }
  let longest = [];
  for (const t of planTasks) {
    const c = chainFrom(t.id);
    if (c.length > longest.length) longest = c;
  }
  return longest;
}

function taskSpan(events) {
  if (events.length === 0) return null;
  const start = Date.parse(events[0].timestamp);
  const end = Date.parse(events[events.length - 1].timestamp);
  return { start, end, durationMs: Math.max(0, end - start) };
}

function section(title) {
  return `\n## ${title}\n`;
}

function buildReport({ events, metricsRows, runsDir, queuePath }) {
  const tasks = byTask(events);
  const generatedAt = new Date().toISOString();
  let md = `# Migration telemetry: final report\n\nGenerated ${generatedAt} from migration/telemetry/events.jsonl, metrics.jsonl and runs/.\n`;

  // --- critical path ---
  md += section('Critical path: actual vs. planned');
  const planTasks = readQueuePlan(queuePath);
  if (planTasks.length === 0) {
    md += `_migration/queue.yaml not found or unparseable at ${queuePath}; planned critical path omitted._\n`;
  } else {
    const chain = longestChain(planTasks);
    md += `Planned critical path (longest dependency chain in migration/queue.yaml, ${chain.length} task(s)):\n\n`;
    md += chain.map((id) => `\`${id}\``).join(' → ') + '\n\n';
    md += 'Actual duration of each planned-critical-path task (first event to last event recorded):\n\n';
    md += '| task | first event | last event | duration | outcome |\n|---|---|---|---|---|\n';
    let totalMs = 0;
    let missing = 0;
    for (const id of chain) {
      const evs = tasks.get(id);
      const span = evs ? taskSpan(evs) : null;
      if (!span) {
        missing++;
        md += `| \`${id}\` | — | — | no events recorded | — |\n`;
        continue;
      }
      totalMs += span.durationMs;
      const last = evs[evs.length - 1];
      md += `| \`${id}\` | ${new Date(span.start).toISOString()} | ${new Date(span.end).toISOString()} | ${fmtHours(span.durationMs)} | ${last.event} |\n`;
    }
    md += `\nActual elapsed time summed along the planned critical path: **${fmtHours(totalMs)}**`;
    md += missing ? ` (${missing} of ${chain.length} tasks have no recorded events yet).\n` : '.\n';
    md +=
      '\n_The plan does not give a planned duration per task, so this compares dependency ORDER (the planned critical path) against the ACTUAL elapsed time recorded for each task on that path, rather than two calendar durations. A genuine planned-vs-actual time comparison needs per-task estimates added to queue.yaml._\n';
  }

  // --- time lost to stuck periods ---
  md += section('Time lost to stuck periods, by cause');
  const stuckEvents = events.filter((e) => e.event === 'stuck');
  if (stuckEvents.length === 0) {
    md += '_No stuck events recorded._\n';
  } else {
    const lostByCause = new Map();
    for (const s of stuckEvents) {
      const evs = s.task ? tasks.get(s.task) || [] : [];
      const idx = evs.findIndex((e) => e === s);
      const stuckTime = Date.parse(s.timestamp);
      const next = idx >= 0 ? evs.slice(idx + 1).find((e) => e.event !== 'stuck') : null;
      const resolvedAtMs = next ? Date.parse(next.timestamp) : null;
      const lostMs = resolvedAtMs ? Math.max(0, resolvedAtMs - stuckTime) : 0;
      const cause = s.cause || 'unknown';
      const cur = lostByCause.get(cause) || { count: 0, lostMs: 0, unresolved: 0 };
      cur.count++;
      cur.lostMs += lostMs;
      if (!resolvedAtMs) cur.unresolved++;
      lostByCause.set(cause, cur);
    }
    md += '| cause | occurrences | time lost (of those resolved) | still unresolved |\n|---|---|---|---|\n';
    for (const [cause, v] of [...lostByCause.entries()].sort((a, b) => b[1].lostMs - a[1].lostMs)) {
      md += `| ${cause} | ${v.count} | ${fmtHours(v.lostMs)} | ${v.unresolved} |\n`;
    }
    md +=
      '\n_"Time lost" is measured from a stuck event to the next non-stuck event recorded for that task (0 for global causes such as deadlock/global_stall, and left unresolved when no later event exists yet)._\n';
  }

  // --- stuck rule / escalation performance ---
  md += section('How the stuck rules and model escalations performed');
  const escalations = events.filter((e) => e.event === 'escalated');
  const causeCounts = new Map();
  for (const s of stuckEvents) causeCounts.set(s.cause || 'unknown', (causeCounts.get(s.cause || 'unknown') || 0) + 1);
  md += `Total stuck events: **${stuckEvents.length}**. Total escalations: **${escalations.length}**.\n\n`;
  if (causeCounts.size) {
    md += '| cause | times fired |\n|---|---|\n';
    for (const [cause, n] of [...causeCounts.entries()].sort((a, b) => b[1] - a[1])) {
      md += `| ${cause} | ${n} |\n`;
    }
  }
  if (escalations.length) {
    md += '\nEscalation reasons recorded:\n\n';
    for (const e of escalations.slice(0, 20)) {
      md += `- \`${e.task || '(global)'}\`: ${e.reason || '(no reason recorded)'}\n`;
    }
  }

  // --- coverage curves ---
  md += section('Coverage curves');
  const coveragePaths = discoverNumericPaths(metricsRows).filter((p) =>
    /cov|coverage|pass_pct|pct/i.test(p)
  );
  if (metricsRows.length === 0) {
    md += '_No metric snapshots recorded in metrics.jsonl._\n';
  } else if (coveragePaths.length === 0) {
    md += '_metrics.jsonl has rows, but no coverage-shaped numeric field was found under any row\'s `metrics` key._\n';
  } else {
    const sorted = [...metricsRows].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    md += '| metric | first value | last value | change |\n|---|---|---|---|\n';
    for (const p of coveragePaths) {
      const values = sorted
        .map((r) => getPath(r, `metrics.${p}`))
        .filter((v) => typeof v === 'number');
      if (values.length === 0) continue;
      const first = values[0];
      const last = values[values.length - 1];
      md += `| \`${p}\` | ${first} | ${last} | ${(last - first >= 0 ? '+' : '')}${(last - first).toFixed(2)} |\n`;
    }
    md += `\n(${metricsRows.length} metric snapshot(s) total; see migration/dashboard/out/index.html for the full curves.)\n`;
  }

  // --- rework ---
  md += section('Rework: review rejections and regressions per phase');
  const rejectionsByPhase = new Map();
  const regressionsByPhase = new Map();
  for (const [task, evs] of tasks) {
    const phase = phaseOf(task);
    const rejects = evs.filter((e) => e.event === 'review_verdict' && /reject/i.test(e.reason || '')).length;
    const regressions = evs.filter((e) => e.event === 'stuck' && e.cause === 'regression').length;
    if (rejects) rejectionsByPhase.set(phase, (rejectionsByPhase.get(phase) || 0) + rejects);
    if (regressions) regressionsByPhase.set(phase, (regressionsByPhase.get(phase) || 0) + regressions);
  }
  const phases = new Set([...rejectionsByPhase.keys(), ...regressionsByPhase.keys()]);
  if (phases.size === 0) {
    md += '_No review rejections or regressions recorded._\n';
  } else {
    md += '| phase | review rejections | regressions |\n|---|---|---|\n';
    for (const phase of [...phases].sort()) {
      md += `| ${phase} | ${rejectionsByPhase.get(phase) || 0} | ${regressionsByPhase.get(phase) || 0} |\n`;
    }
  }

  // --- cost ---
  md += section('Cost per task, phase and model');
  const tokensByTask = new Map();
  const tokensByPhase = new Map();
  const tokensByModel = new Map();
  for (const e of events) {
    const tok = typeof e.tokens === 'number' ? e.tokens : 0;
    if (!tok) continue;
    if (e.task) {
      tokensByTask.set(e.task, (tokensByTask.get(e.task) || 0) + tok);
      tokensByPhase.set(phaseOf(e.task), (tokensByPhase.get(phaseOf(e.task)) || 0) + tok);
    }
    const modelKey = e.model || 'unspecified';
    tokensByModel.set(modelKey, (tokensByModel.get(modelKey) || 0) + tok);
  }
  if (tokensByTask.size === 0) {
    md += '_No token figures recorded on any event._\n';
  } else {
    md += '**By task (top 15):**\n\n| task | tokens |\n|---|---|\n';
    for (const [task, n] of [...tokensByTask.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
      md += `| ${task} | ${n} |\n`;
    }
    md += '\n**By phase:**\n\n| phase | tokens |\n|---|---|\n';
    for (const [phase, n] of [...tokensByPhase.entries()].sort((a, b) => b[1] - a[1])) {
      md += `| ${phase} | ${n} |\n`;
    }
    md += '\n**By model:**\n\n| model | tokens |\n|---|---|\n';
    for (const [model, n] of [...tokensByModel.entries()].sort((a, b) => b[1] - a[1])) {
      md += `| ${model} | ${n} |\n`;
    }
  }

  // --- lessons learned ---
  md += section('Lessons learned');
  const bullets = [];
  if (causeCounts.size) {
    const [topCause, topCount] = [...causeCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    bullets.push(`The most common stuck cause was **${topCause}** (${topCount} occurrence(s)) — worth checking whether its threshold in thresholds.yaml is well-tuned.`);
  }
  if (tokensByTask.size) {
    const [topTask, topTokens] = [...tokensByTask.entries()].sort((a, b) => b[1] - a[1])[0];
    bullets.push(`\`${topTask}\` used the most tokens of any task (${topTokens}) — consider whether it should have been split.`);
  }
  const topSigs = collectFailureSignatures(runsDir).slice(0, 1);
  if (topSigs.length) {
    bullets.push(`The most repeated failure signature was on \`${topSigs[0].task}\` / "${topSigs[0].fullTitle}" (seen ${topSigs[0].count} time(s)).`);
  }
  if ([...regressionsByPhase.values()].some((n) => n > 0)) {
    const [worstPhase] = [...regressionsByPhase.entries()].sort((a, b) => b[1] - a[1])[0];
    bullets.push(`Phase **${worstPhase}** had the most regressions — a candidate for extra oracle coverage before its tasks are declared done.`);
  }
  if (bullets.length === 0) {
    md += '_Not enough data yet to derive candidate lessons._\n';
  } else {
    md += 'These are data-derived candidates for a human to confirm or reject, not a narrative:\n\n';
    for (const b of bullets) md += `- ${b}\n`;
  }
  md += '\n_(Add narrative lessons here by hand once the migration is done — this generator only surfaces what the logs already show.)_\n';

  return md;
}

function getPath(obj, dotted) {
  return dotted.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);
}

function discoverNumericPaths(metricsRows) {
  const leaves = new Set();
  const walk = (obj, prefix) => {
    if (!obj || typeof obj !== 'object') return;
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'number') leaves.add(key);
      else if (v && typeof v === 'object') walk(v, key);
    }
  };
  for (const row of metricsRows) walk(row.metrics || {}, '');
  return [...leaves];
}

function collectFailureSignatures(runsDir) {
  const counts = new Map();
  if (!fs.existsSync(runsDir)) return [];
  for (const task of fs.readdirSync(runsDir)) {
    const taskDir = path.join(runsDir, task);
    if (!fs.statSync(taskDir).isDirectory()) continue;
    for (const attempt of fs.readdirSync(taskDir)) {
      const resultPath = path.join(taskDir, attempt, 'result.json');
      if (!fs.existsSync(resultPath)) continue;
      let doc;
      try {
        doc = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
      } catch {
        continue;
      }
      for (const t of doc.tests || []) {
        if (t.status !== 'fail' || !t.signature) continue;
        const entry = counts.get(t.signature) || { count: 0, fullTitle: t.fullTitle, task };
        entry.count++;
        counts.set(t.signature, entry);
      }
    }
  }
  return [...counts.entries()].map(([signature, v]) => ({ signature, ...v })).sort((a, b) => b.count - a.count);
}

function main() {
  const args = parseArgs(process.argv.slice(2), {
    flags: ['events', 'metrics', 'runs-dir', 'queue', 'out'],
  });
  const eventsFile = args.events ? path.resolve(args.events) : EVENTS_FILE;
  const metricsFile = args.metrics ? path.resolve(args.metrics) : METRICS_FILE;
  const runsDir = args['runs-dir'] ? path.resolve(args['runs-dir']) : RUNS_DIR;
  const queuePath = args.queue ? path.resolve(args.queue) : path.join(MIGRATION_ROOT, 'queue.yaml');

  const events = readJsonl(eventsFile);
  const metricsRows = readJsonl(metricsFile);

  const md = buildReport({ events, metricsRows, runsDir, queuePath });

  if (args.out) {
    fs.mkdirSync(path.dirname(path.resolve(args.out)), { recursive: true });
    fs.writeFileSync(path.resolve(args.out), md, 'utf8');
    process.stderr.write(`final-report: wrote ${path.resolve(args.out)}\n`);
  } else {
    process.stdout.write(md);
  }
}

main();
