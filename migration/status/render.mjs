#!/usr/bin/env node
/**
 * migration/status/render.mjs  (task P0-06)
 *
 * Turns migration/status/status.json into a short markdown summary,
 * suitable for the hourly chat report described in plan §5.
 *
 * Usage:
 *   node migration/status/render.mjs [path/to/status.json]
 *
 * With no argument, reads migration/status/status.json next to this
 * script. Prints markdown to stdout.
 */

import fs from 'node:fs';
import path from 'node:path';

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const DEFAULT_STATUS_JSON = path.join(SCRIPT_DIR, 'status.json');

function pct(n) {
  return n == null || Number.isNaN(n) ? 'n/a' : `${n.toFixed(2)}%`;
}

function line(available, reason, formatted) {
  return available ? formatted() : `n/a (${reason})`;
}

function renderQueue(queue) {
  if (!queue.available) return `- **Queue:** n/a (${queue.reason})`;
  const parts = Object.entries(queue.counts)
    .sort()
    .map(([k, v]) => `${v} ${k}`)
    .join(', ');
  return `- **Queue:** ${queue.total} tasks - ${parts}`;
}

function renderCoreTests(m) {
  const o = m.overall;
  if (!o.available) return `- **concerto-core tests (TS engine):** n/a (${o.reason})`;
  const head = `- **concerto-core tests (engine=${o.engine}):** ${o.passing}/${o.tests} passing, ${o.failing} failing, ${o.pending} pending (${(o.duration_ms / 1000).toFixed(1)}s)`;
  let tagLine = '';
  if (m.by_tag.available) {
    const t = m.by_tag.tally;
    const bits = Object.entries(t)
      .sort()
      .map(([tag, s]) => `${tag}: ${s.passing}/${s.tests}`)
      .join(', ');
    tagLine = `\n  - by tag: ${bits}`;
  } else {
    tagLine = `\n  - by tag: n/a (${m.by_tag.reason})`;
  }
  const rustMode = m.engine_modes.rust;
  const rustLine = `\n  - rust engine mode: ${rustMode.available ? 'available' : `n/a (${rustMode.reason})`}`;
  return head + tagLine + rustLine;
}

function renderNyc(n) {
  if (!n.available) return `- **nyc coverage:** n/a (${n.reason})`;
  const gate = n.gate_status ? ` - gate: ${n.gate_status}` : '';
  return `- **nyc coverage:** statements ${pct(n.statements_pct)}, branches ${pct(n.branches_pct)}, functions ${pct(n.functions_pct)}, lines ${pct(n.lines_pct)}${gate}`;
}

function renderOracle(o) {
  const bits = ['native', 'wasm', 'corpus_coverage_of_reference'].map((k) => {
    const v = o[k];
    return v.available ? `${k}: ${JSON.stringify(v).slice(0, 80)}` : `${k}: n/a`;
  });
  return `- **Oracle:** ${bits.join('; ')}`;
}

function renderRust(name, r) {
  const t = r.cargo_test;
  const testStr = t.available
    ? `${t.totals.passed} passed / ${t.totals.failed} failed`
    : `n/a (${t.reason})`;
  const c = r.llvm_cov;
  const covStr = c.available ? `${pct(c.workspace_lines_pct)} lines` : `n/a (${c.reason})`;
  return `- **${name}:** cargo test: ${testStr}; llvm-cov: ${covStr}`;
}

function renderLedger(l) {
  if (!l.available) return `- **Seam ledger:** n/a (${l.reason})`;
  return `- **Seam ledger:** ${pct(l.weighted_pct_rust_plus_hybrid)} weighted RUST+HYBRID (of ${l.total_weight} total weight, ${l.rows} rows)`;
}

function renderConformance(c) {
  if (!c.available) return `- **Conformance:** n/a (${c.reason})`;
  return `- **Conformance:** ${c.passed ?? '?'}/${c.total_scenarios} scenarios passed`;
}

function render(status) {
  const m = status.metrics;
  const at = status.requested_at_sha ? ` (--at ${status.requested_at_sha.slice(0, 12)})` : '';
  const lines = [];
  lines.push(`### Migration status${at}`);
  lines.push('');
  lines.push(`_Generated ${status.generated_at} in ${(status.runtime_ms / 1000).toFixed(1)}s${status.fast ? ', --fast' : ''}._`);
  lines.push('');
  lines.push(renderQueue(m.queue));
  lines.push(renderCoreTests(m.concerto_core_tests));
  lines.push(renderNyc(m.nyc_coverage));
  lines.push(renderOracle(m.oracle));
  lines.push(renderRust('concerto-rust', m.rust['concerto-rust']));
  lines.push(renderRust('concerto-validate-rs', m.rust['concerto-validate-rs']));
  lines.push(renderLedger(m.ledger));
  lines.push(
    `- **Mutants:** ${m.mutants.available ? JSON.stringify(m.mutants) : `n/a (${m.mutants.reason})`}`
  );
  lines.push(renderConformance(m.conformance));
  lines.push('');
  lines.push(
    `Commits: concerto \`${(status.repos.concerto.commit_used || status.repos.concerto.commit || '?').slice(0, 12)}\`, ` +
      `concerto-rust \`${(status.repos['concerto-rust'].commit || '?').slice(0, 12)}\`, ` +
      `concerto-validate-rs \`${(status.repos['concerto-validate-rs'].commit || '?').slice(0, 12)}\`, ` +
      `concerto-conformance \`${(status.repos['concerto-conformance'].commit || '?').slice(0, 12)}\`.`
  );
  return lines.join('\n') + '\n';
}

function main() {
  const statusPath = process.argv[2] || DEFAULT_STATUS_JSON;
  const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
  process.stdout.write(render(status));
}

main();
