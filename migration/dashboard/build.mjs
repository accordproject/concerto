#!/usr/bin/env node
// migration/dashboard/build.mjs
//
// Builds a single self-contained static HTML dashboard (inline SVG
// charts, no external scripts, light/dark via prefers-color-scheme) from
// the migration telemetry logs (plan §5.1):
//   - metric curves over time, with merge markers
//   - a task timeline, with stuck periods shaded by cause
//   - a task burn-up chart
//   - cost (tokens) by model and by phase
//   - the top 10 failure signatures
//
// Usage:
//   node build.mjs [--events PATH] [--metrics PATH] [--runs-dir PATH]
//        [--out PATH] [--title TEXT]
//
// Defaults read migration/telemetry/{events,metrics}.jsonl and
// migration/telemetry/runs/, and write migration/dashboard/out/index.html.
// Point --events/--metrics/--runs-dir at the synthetic fixtures under
// migration/telemetry/test/ to build a dashboard from those instead (used
// by the synthetic replay to prove the dashboard renders at all).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJsonl, parseArgs } from '../telemetry/lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION_ROOT = path.resolve(__dirname, '..');
const DEFAULT_EVENTS = path.join(MIGRATION_ROOT, 'telemetry', 'events.jsonl');
const DEFAULT_METRICS = path.join(MIGRATION_ROOT, 'telemetry', 'metrics.jsonl');
const DEFAULT_RUNS_DIR = path.join(MIGRATION_ROOT, 'telemetry', 'runs');
const DEFAULT_OUT = path.join(__dirname, 'out', 'index.html');

const TERMINAL = new Set(['merged', 'failed', 'blocked']);

// ---------------------------------------------------------------------
// small SVG helpers (no dependency: this is the whole charting library)
// ---------------------------------------------------------------------
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function fmtDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toISOString().replace('T', ' ').slice(0, 16) + 'Z';
}

const PALETTE = [
  '#5b8def', '#e0725a', '#4fb286', '#cf9a3e', '#9b7fd4',
  '#4bb6c9', '#d3618c', '#8aa63a', '#c17a3e', '#6a7bd8',
];
const CAUSE_COLORS = {
  silent: '#9aa0a6',
  looping: '#e0725a',
  plateau: '#cf9a3e',
  burning: '#d3618c',
  regression: '#c14545',
  deadlock: '#6a7bd8',
  global_stall: '#8aa63a',
  review_churn: '#9b7fd4',
  external: '#4bb6c9',
};

function svg(width, height, inner, extraAttrs = '') {
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" ${extraAttrs} xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}

/** A multi-series line chart with optional vertical merge markers. */
function lineChart({ width = 900, height = 260, series, xDomain, yDomain, markers = [], yLabel = '' }) {
  const padL = 56;
  const padR = 16;
  const padT = 16;
  const padB = 34;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const [x0, x1] = xDomain;
  const [y0, y1] = yDomain;
  const sx = (x) => padL + (x1 === x0 ? plotW / 2 : ((x - x0) / (x1 - x0)) * plotW);
  const sy = (y) => padT + plotH - (y1 === y0 ? plotH / 2 : ((y - y0) / (y1 - y0)) * plotH);

  let out = '';

  // gridlines + y-axis labels
  const yTicks = 4;
  for (let i = 0; i <= yTicks; i++) {
    const yv = y0 + ((y1 - y0) * i) / yTicks;
    const yy = sy(yv);
    out += `<line class="grid" x1="${padL}" y1="${yy.toFixed(1)}" x2="${width - padR}" y2="${yy.toFixed(1)}" />`;
    out += `<text class="axis-label" x="${padL - 8}" y="${(yy + 3).toFixed(1)}" text-anchor="end">${yv.toFixed(1)}</text>`;
  }
  // x-axis start/end labels
  out += `<text class="axis-label" x="${padL}" y="${height - 10}" text-anchor="start">${esc(fmtDate(new Date(x0).toISOString()))}</text>`;
  out += `<text class="axis-label" x="${width - padR}" y="${height - 10}" text-anchor="end">${esc(fmtDate(new Date(x1).toISOString()))}</text>`;

  // merge markers
  for (const m of markers) {
    const xx = sx(m.x);
    out += `<line class="marker" x1="${xx.toFixed(1)}" y1="${padT}" x2="${xx.toFixed(1)}" y2="${padT + plotH}"><title>${esc(m.label)}</title></line>`;
  }

  // series
  series.forEach((s, i) => {
    const color = PALETTE[i % PALETTE.length];
    if (s.points.length === 0) return;
    const d = s.points
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`)
      .join(' ');
    out += `<path class="series" d="${d}" stroke="${color}" fill="none" />`;
    for (const p of s.points) {
      out += `<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="2.5" fill="${color}"><title>${esc(s.name)}: ${p.y} @ ${esc(fmtDate(new Date(p.x).toISOString()))}</title></circle>`;
    }
  });

  const legend = series
    .map((s, i) => `<span class="legend-item"><i style="background:${PALETTE[i % PALETTE.length]}"></i>${esc(s.name)}</span>`)
    .join('');

  return `<div class="chart-legend">${legend}</div>${svg(width, height, out)}`;
}

/** Task timeline: one horizontal row per task, a bar from first to last
 *  event, with stuck-cause bands overlaid at each 'stuck' event's time. */
function timelineChart({ width = 900, rowHeight = 22, tasks, xDomain }) {
  const padL = 140;
  const padR = 16;
  const padT = 10;
  const padB = 10;
  const plotW = width - padL - padR;
  const height = padT + padB + rowHeight * Math.max(tasks.length, 1);
  const [x0, x1] = xDomain;
  const sx = (x) => padL + (x1 === x0 ? plotW / 2 : ((x - x0) / (x1 - x0)) * plotW);

  let out = '';
  tasks.forEach((t, i) => {
    const y = padT + i * rowHeight;
    const barY = y + 4;
    const barH = rowHeight - 10;
    const startX = sx(t.start);
    const endX = sx(t.end);
    const stateColor = TERMINAL.has(t.lastEvent)
      ? (t.lastEvent === 'merged' ? '#4fb286' : '#c14545')
      : '#5b8def';
    out += `<text class="axis-label" x="${padL - 8}" y="${(barY + barH / 2 + 3).toFixed(1)}" text-anchor="end">${esc(t.task)}</text>`;
    out += `<rect x="${startX.toFixed(1)}" y="${barY}" width="${Math.max(2, endX - startX).toFixed(1)}" height="${barH}" fill="${stateColor}" rx="3"><title>${esc(t.task)}: ${esc(t.lastEvent)} (${esc(fmtDate(new Date(t.start).toISOString()))} → ${esc(fmtDate(new Date(t.end).toISOString()))})</title></rect>`;
    for (const stuck of t.stuckMarks) {
      const sxp = sx(stuck.x);
      const color = CAUSE_COLORS[stuck.cause] || '#888';
      out += `<rect x="${(sxp - 2).toFixed(1)}" y="${barY - 3}" width="4" height="${barH + 6}" fill="${color}"><title>stuck: ${esc(stuck.cause)} — ${esc(stuck.reason || '')}</title></rect>`;
    }
  });

  const legend = Object.entries(CAUSE_COLORS)
    .map(([cause, color]) => `<span class="legend-item"><i style="background:${color}"></i>${esc(cause)}</span>`)
    .join('');

  return `<div class="chart-legend">${legend}</div>${svg(width, height, out)}`;
}

/** Simple burn-up: cumulative merged tasks vs. cumulative tasks seen. */
function burnUpChart({ width = 900, height = 220, totalSeries, doneSeries, xDomain }) {
  const maxY = Math.max(1, ...totalSeries.map((p) => p.y), ...doneSeries.map((p) => p.y));
  return lineChart({
    width,
    height,
    series: [
      { name: 'tasks seen', points: totalSeries },
      { name: 'tasks merged', points: doneSeries },
    ],
    xDomain,
    yDomain: [0, maxY],
  });
}

/** Horizontal bar chart for cost-by-group panels. */
function barChart({ width = 420, height = 220, bars, unit = '' }) {
  const padL = 110;
  const padR = 60;
  const padT = 10;
  const padB = 10;
  const rowH = Math.max(18, Math.min(28, (height - padT - padB) / Math.max(bars.length, 1)));
  const plotW = width - padL - padR;
  const maxV = Math.max(1, ...bars.map((b) => b.value));
  const h = padT + padB + rowH * Math.max(bars.length, 1);

  let out = '';
  bars.forEach((b, i) => {
    const y = padT + i * rowH;
    const barH = rowH - 6;
    const barW = (b.value / maxV) * plotW;
    out += `<text class="axis-label" x="${padL - 8}" y="${(y + barH / 2 + 3).toFixed(1)}" text-anchor="end">${esc(b.label)}</text>`;
    out += `<rect x="${padL}" y="${y}" width="${Math.max(1, barW).toFixed(1)}" height="${barH}" fill="${PALETTE[i % PALETTE.length]}" rx="3"><title>${esc(b.label)}: ${b.value}${unit}</title></rect>`;
    out += `<text class="bar-value" x="${(padL + barW + 6).toFixed(1)}" y="${(y + barH / 2 + 3).toFixed(1)}">${b.value}${unit}</text>`;
  });
  return svg(width, h, out);
}

// ---------------------------------------------------------------------
// data extraction
// ---------------------------------------------------------------------
function buildTaskIndex(events) {
  const tasks = new Map();
  for (const e of events) {
    if (!e.task) continue;
    if (!tasks.has(e.task)) tasks.set(e.task, []);
    tasks.get(e.task).push(e);
  }
  return tasks;
}

function phaseOf(task) {
  const m = /^([A-Za-z]+\d+)/.exec(task || '');
  return m ? m[1] : 'unphased';
}

function collectFailureSignatures(runsDir) {
  const counts = new Map(); // signature -> {count, sample}
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
        const entry = counts.get(t.signature) || { count: 0, fullTitle: t.fullTitle, task, errorMessage: t.errorMessage };
        entry.count++;
        counts.set(t.signature, entry);
      }
    }
  }
  return [...counts.entries()]
    .map(([signature, v]) => ({ signature, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function extractMetricSeries(metricsRows, dottedPaths) {
  const get = (obj, dotted) => dotted.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);
  const sorted = [...metricsRows].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  return dottedPaths.map((p) => ({
    name: p,
    points: sorted
      .map((r) => ({ x: Date.parse(r.timestamp), y: get(r, `metrics.${p}`) }))
      .filter((pt) => typeof pt.y === 'number' && !Number.isNaN(pt.x)),
  }));
}

function discoverMetricPaths(metricsRows, max = 4) {
  // Pick up to `max` numeric leaves that actually vary, so the chart
  // means something even when the real metrics.jsonl schema differs
  // from what this script was written against.
  const leaves = new Map(); // dotted path -> Set of values seen
  const walk = (obj, prefix) => {
    if (!obj || typeof obj !== 'object') return;
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (typeof v === 'number') {
        if (!leaves.has(key)) leaves.set(key, new Set());
        leaves.get(key).add(v);
      } else if (v && typeof v === 'object') {
        walk(v, key);
      }
    }
  };
  for (const row of metricsRows) walk(row.metrics || {}, '');
  const varying = [...leaves.entries()].filter(([, vals]) => vals.size > 1).map(([k]) => k);
  const chosen = (varying.length ? varying : [...leaves.keys()]).slice(0, max);
  return chosen;
}

// ---------------------------------------------------------------------
// page assembly
// ---------------------------------------------------------------------
function buildPage({ events, metricsRows, runsDir, title }) {
  const tasks = buildTaskIndex(events);
  const allTimestamps = events.map((e) => Date.parse(e.timestamp)).filter((t) => !Number.isNaN(t));
  const xDomain = allTimestamps.length
    ? [Math.min(...allTimestamps), Math.max(...allTimestamps)]
    : [Date.now() - 1, Date.now()];

  // --- metric curves ---
  const metricPaths = discoverMetricPaths(metricsRows);
  const metricSeries = extractMetricSeries(metricsRows, metricPaths);
  const mergeMarkers = events
    .filter((e) => e.event === 'merged')
    .map((e) => ({ x: Date.parse(e.timestamp), label: `merged ${e.task || ''} (${e.sha || 'no sha'})` }))
    .filter((m) => !Number.isNaN(m.x));
  const metricYs = metricSeries.flatMap((s) => s.points.map((p) => p.y));
  const metricYDomain = metricYs.length ? [Math.min(0, ...metricYs), Math.max(...metricYs) * 1.05] : [0, 1];
  const metricChart = metricSeries.some((s) => s.points.length)
    ? lineChart({ series: metricSeries, xDomain, yDomain: metricYDomain, markers: mergeMarkers })
    : '<p class="empty">No numeric metrics found in metrics.jsonl.</p>';

  // --- task timeline ---
  const timelineTasks = [...tasks.entries()]
    .map(([task, evs]) => {
      const times = evs.map((e) => Date.parse(e.timestamp)).filter((t) => !Number.isNaN(t));
      const last = evs[evs.length - 1];
      const stuckMarks = evs
        .filter((e) => e.event === 'stuck')
        .map((e) => ({ x: Date.parse(e.timestamp), cause: e.cause, reason: e.reason }));
      return {
        task,
        start: Math.min(...times),
        end: Math.max(...times),
        lastEvent: last ? last.event : 'unknown',
        stuckMarks,
      };
    })
    .sort((a, b) => a.start - b.start);
  const timeline = timelineTasks.length
    ? timelineChart({ tasks: timelineTasks, xDomain })
    : '<p class="empty">No task-scoped events found.</p>';

  // --- burn-up ---
  const sortedEvents = [...events].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const seenTasks = new Set();
  const mergedTasks = new Set();
  const totalSeries = [];
  const doneSeries = [];
  for (const e of sortedEvents) {
    if (!e.task) continue;
    const t = Date.parse(e.timestamp);
    if (Number.isNaN(t)) continue;
    let changed = false;
    if (!seenTasks.has(e.task)) {
      seenTasks.add(e.task);
      changed = true;
    }
    if (e.event === 'merged' && !mergedTasks.has(e.task)) {
      mergedTasks.add(e.task);
      changed = true;
    }
    if (changed) {
      totalSeries.push({ x: t, y: seenTasks.size });
      doneSeries.push({ x: t, y: mergedTasks.size });
    }
  }
  const burnUp = totalSeries.length
    ? burnUpChart({ totalSeries, doneSeries, xDomain })
    : '<p class="empty">No task-scoped events found.</p>';

  // --- cost by model / phase ---
  const tokensByModel = new Map();
  const tokensByPhase = new Map();
  for (const e of events) {
    const tok = typeof e.tokens === 'number' ? e.tokens : 0;
    if (tok === 0) continue;
    const modelKey = e.model || 'unspecified';
    tokensByModel.set(modelKey, (tokensByModel.get(modelKey) || 0) + tok);
    const phaseKey = phaseOf(e.task);
    tokensByPhase.set(phaseKey, (tokensByPhase.get(phaseKey) || 0) + tok);
  }
  const modelBars = [...tokensByModel.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  const phaseBars = [...tokensByPhase.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  const costByModel = modelBars.length ? barChart({ bars: modelBars, unit: ' tok' }) : '<p class="empty">No token figures on any event.</p>';
  const costByPhase = phaseBars.length ? barChart({ bars: phaseBars, unit: ' tok' }) : '<p class="empty">No token figures on any event.</p>';

  // --- top 10 failure signatures ---
  const topSignatures = collectFailureSignatures(runsDir);
  const sigTable = topSignatures.length
    ? `<table class="sig-table"><thead><tr><th>#</th><th>signature</th><th>task</th><th>test</th><th>seen</th><th>first error line</th></tr></thead><tbody>${topSignatures
        .map(
          (s, i) =>
            `<tr><td>${i + 1}</td><td class="mono">${esc(s.signature.slice(0, 12))}</td><td>${esc(s.task)}</td><td>${esc(s.fullTitle)}</td><td>${s.count}</td><td class="mono">${esc((s.errorMessage || '').split('\n')[0].slice(0, 100))}</td></tr>`
        )
        .join('')}</tbody></table>`
    : '<p class="empty">No failure signatures found under runs/.</p>';

  const stuckEvents = events.filter((e) => e.event === 'stuck');
  const generatedAt = new Date().toISOString();

  return renderHtml({
    title,
    generatedAt,
    stats: {
      events: events.length,
      tasks: tasks.size,
      merged: mergedTasks.size,
      stuck: stuckEvents.length,
      metricRows: metricsRows.length,
    },
    metricChart,
    timeline,
    burnUp,
    costByModel,
    costByPhase,
    sigTable,
  });
}

function renderHtml({ title, generatedAt, stats, metricChart, timeline, burnUp, costByModel, costByPhase, sigTable }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="Migration telemetry dashboard: metric curves, task timeline, burn-up, cost, and top failure signatures.">
<style>
:root {
  --bg: #ffffff;
  --fg: #1b1f24;
  --muted: #5b6470;
  --card-bg: #f6f7f9;
  --border: #e2e5ea;
  --grid: #e9ebef;
  --accent: #5b8def;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #14161a;
    --fg: #e7e9ee;
    --muted: #9aa3af;
    --card-bg: #1c1f25;
    --border: #2a2e35;
    --grid: #262a31;
    --accent: #7fa6f5;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  padding: 16px;
}
h1 { font-size: 20px; margin: 0 0 4px; }
h2 { font-size: 15px; margin: 0 0 10px; color: var(--fg); }
.meta { color: var(--muted); font-size: 12px; margin-bottom: 20px; }
.stat-row { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }
.stat-tile {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 14px;
  min-width: 110px;
}
.stat-tile .n { font-size: 20px; font-weight: 600; }
.stat-tile .l { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 720px) { .grid-2 { grid-template-columns: 1fr; } }
.card {
  background: var(--card-bg);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 16px;
  overflow-x: auto;
}
.empty { color: var(--muted); font-style: italic; }
svg { display: block; }
.grid { stroke: var(--grid); stroke-width: 1; }
.axis-label { fill: var(--muted); font-size: 10px; }
.series { stroke-width: 2; }
.marker { stroke: var(--muted); stroke-width: 1; stroke-dasharray: 3 3; opacity: 0.6; }
.bar-value { fill: var(--muted); font-size: 11px; }
.chart-legend { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 8px; font-size: 11px; color: var(--muted); }
.legend-item { display: inline-flex; align-items: center; gap: 4px; }
.legend-item i { width: 9px; height: 9px; border-radius: 2px; display: inline-block; }
.sig-table { border-collapse: collapse; width: 100%; font-size: 12px; }
.sig-table th, .sig-table td { border-bottom: 1px solid var(--border); padding: 5px 8px; text-align: left; }
.sig-table th { color: var(--muted); font-weight: 500; }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
footer { color: var(--muted); font-size: 11px; margin-top: 24px; }
</style>
</head>
<body>
<h1>${esc(title)}</h1>
<div class="meta">Generated ${esc(generatedAt)} from migration/telemetry/*.jsonl and migration/telemetry/runs/</div>

<div class="stat-row">
  <div class="stat-tile"><div class="n">${stats.events}</div><div class="l">events</div></div>
  <div class="stat-tile"><div class="n">${stats.tasks}</div><div class="l">tasks</div></div>
  <div class="stat-tile"><div class="n">${stats.merged}</div><div class="l">merged</div></div>
  <div class="stat-tile"><div class="n">${stats.stuck}</div><div class="l">stuck events</div></div>
  <div class="stat-tile"><div class="n">${stats.metricRows}</div><div class="l">metric snapshots</div></div>
</div>

<div class="card">
  <h2>Metric curves over time (merge markers dashed)</h2>
  ${metricChart}
</div>

<div class="card">
  <h2>Task timeline (stuck periods shaded by cause)</h2>
  ${timeline}
</div>

<div class="card">
  <h2>Task burn-up</h2>
  ${burnUp}
</div>

<div class="grid-2">
  <div class="card">
    <h2>Cost by model (tokens)</h2>
    ${costByModel}
  </div>
  <div class="card">
    <h2>Cost by phase (tokens)</h2>
    ${costByPhase}
  </div>
</div>

<div class="card">
  <h2>Top 10 failure signatures</h2>
  ${sigTable}
</div>

<footer>migration/dashboard/build.mjs &middot; rebuilt from migration/telemetry/events.jsonl, metrics.jsonl and runs/</footer>
</body>
</html>
`;
}

function main() {
  const args = parseArgs(process.argv.slice(2), {
    flags: ['events', 'metrics', 'runs-dir', 'out', 'title'],
  });
  const eventsFile = args.events ? path.resolve(args.events) : DEFAULT_EVENTS;
  const metricsFile = args.metrics ? path.resolve(args.metrics) : DEFAULT_METRICS;
  const runsDir = args['runs-dir'] ? path.resolve(args['runs-dir']) : DEFAULT_RUNS_DIR;
  const outFile = args.out ? path.resolve(args.out) : DEFAULT_OUT;
  const title = args.title || 'Rust migration dashboard';

  const events = readJsonl(eventsFile);
  const metricsRows = readJsonl(metricsFile);

  const html = buildPage({ events, metricsRows, runsDir, title });

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, html, 'utf8');
  process.stderr.write(
    `dashboard: wrote ${outFile} (${events.length} events, ${metricsRows.length} metric rows)\n`
  );
}

main();
