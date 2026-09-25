/**
 * migration/gate/classify.mjs  (task P5-01a)
 *
 * Failure-driven classification for migration/gate/run.mjs. A step's verdict
 * is derived from WHAT failed, never from which step it is:
 *
 *   - Each failing step is broken down into failing *items* (a threshold, a
 *     test fullTitle, a smoke check, an oracle fixture, a sub-leg such as the
 *     WASM build or size budget).
 *   - An item is `expected-pending` only if it matches an entry in one of the
 *     KNOWN_* sets below, each of which names its owner and reason.
 *   - Every other item is `unexpected`, including a failure the runner could
 *     not break down into items (no parsable output, a count mismatch, a
 *     truncated failure list, a metric that was never judged).
 *   - A step is `expected-pending` only if it has at least one item and every
 *     item is expected-pending; otherwise it is `unexpected`.
 *
 * Keep the KNOWN_* sets small and explicit. Adding an entry needs an owner
 * that is an open, tracked task (or a documented environment caveat) and a
 * reason. Anything not listed here is, by design, a new problem.
 *
 * P4-08 (accordproject/concerto-rust#67, ModelFile/BaseModelManager views)
 * deliberately has NO entry. Its exit condition (#67) is "the group's B tests
 * and oracle fixtures pass with CONCERTO_ENGINE=rust; the group's W tests
 * pass". As of the 2026-09-25 dry run no B/W test, oracle fixture or §0
 * threshold fails because of that group: the only B failure (in both engine
 * modes) is the network test below, and status.mjs runs CONCERTO_ENGINE=ts
 * only, so none of its thresholds can be P4-08's. If a ModelFile or
 * BaseModelManager test starts failing under CONCERTO_ENGINE=rust it is
 * reported as `unexpected` until someone verifies it is P4-08's and adds it.
 */

// ---------------------------------------------------------------------------
// Known sets
// ---------------------------------------------------------------------------

/**
 * concerto-core mocha tests that are known to fail for a reason outside the
 * migration. Matched on test file (relative to packages/concerto-core/test)
 * AND fullTitle AND the failure message, so the same test failing for a
 * different reason (an assertion, a TypeError, ...) is still `unexpected`.
 * Applies to both the CONCERTO_ENGINE=ts run (status.mjs) and the
 * CONCERTO_ENGINE=rust run (run.mjs's core_suite_rust step).
 */
export const KNOWN_TEST_FAILURES = [
  {
    id: 'modelloader-network',
    file: 'modelloader.js',
    fullTitle: 'ModelLoader #loadModelFromUrl should load models',
    // The test fetches a model over HTTPS. In sandboxed CI/agent containers
    // outbound requests are blocked (HTTP 403 from the egress proxy) or DNS
    // fails. Only a network-shaped error counts as this known failure.
    errorPattern: /\b403\b|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|getaddrinfo|fetch failed|socket hang up|network/i,
    owner: 'environment (sandboxed network egress), not a migration task',
    reason:
      'fetches a model over HTTPS; sandboxed environments block outbound requests (HTTP 403 from the egress proxy). ' +
      'Fails identically under CONCERTO_ENGINE=ts and =rust; passes with network access.',
  },
];

/**
 * concerto-wasm `npm run smoke:node` checks (concerto-wasm/scripts/checks.mjs)
 * known to fail because the check itself is stale, matched on check name.
 */
export const KNOWN_WASM_SMOKE_FAILURES = [
  {
    id: 'smoke-system-model-count',
    check: 'a new manager holds the system model',
    owner: 'accordproject/concerto-rust#150 (open, worker:cloud-2)',
    reason: 'stale assertion: a new manager now starts with two model files (modelFileIds 0,1), not one',
  },
  {
    id: 'smoke-enum-propids',
    check: 'property handles and snapshots',
    owner: 'accordproject/concerto-rust#150 (open, worker:cloud-2)',
    reason: "stale assertion 'enum values have no PropId yet (P2-04)': P2-04 (#48) landed and enum values have PropIds",
  },
];

/**
 * Oracle fixtures known to disagree through the WASM/JS binding (replay.js
 * --engine rust-adapter.js), matched on op. The count is pinned: more
 * disagreements than tracked is a regression, not the known gap.
 */
export const KNOWN_ORACLE_WASM_DISAGREEMENTS = {
  id: 'oracle-wasm-decorator-manager',
  ops: ['DecoratorManager.decorateModels', 'DecoratorManager.extractDecorators'],
  maxCount: 31,
  owner: 'P4-09a, accordproject/concerto-rust#157 (open, worker:local-matt)',
  reason:
    'DecoratorManager.decorateModels/extractDecorators disagree through the WASM binding only ' +
    '(native cargo oracle passes on the same corpus); tracked as P4-09a',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EXPECTED = 'expected-pending';
const UNEXPECTED = 'unexpected';

function unexpected(item, reason) {
  return { item, verdict: UNEXPECTED, owner: null, reason };
}

function expected(item, known) {
  return { item, verdict: EXPECTED, owner: known.owner, reason: known.reason, known_id: known.id };
}

/** Matches one failing mocha test ({file, fullTitle, message}) against KNOWN_TEST_FAILURES. */
export function classifyTestFailure(f) {
  const label = `test: ${f.file ? `${f.file} :: ` : ''}${f.fullTitle}`;
  const known = KNOWN_TEST_FAILURES.find(
    (k) => k.fullTitle === f.fullTitle && (f.file == null || f.file === k.file) && k.errorPattern.test(f.message || '')
  );
  if (known) return expected(label, known);
  const sameTest = KNOWN_TEST_FAILURES.find((k) => k.fullTitle === f.fullTitle);
  return unexpected(
    label,
    sameTest
      ? `known-flaky test failed with a non-network error: ${truncate(f.message)}`
      : `not in the known-failure set: ${truncate(f.message)}`
  );
}

function truncate(s, n = 200) {
  const str = String(s ?? '');
  return str.length > n ? `${str.slice(0, n)}…` : str;
}

/**
 * Classifies a set of failing tests against a reported failure count.
 * `failures` null means the list could not be obtained: that is unexpected,
 * because we cannot show every failure is a known one.
 */
function classifyTestFailures(failures, expectedCount, context) {
  if (!Array.isArray(failures)) {
    return [unexpected(context, `${expectedCount ?? 'unknown number of'} failing test(s), but the failing-test list could not be read`)];
  }
  const items = failures.map(classifyTestFailure);
  if (typeof expectedCount === 'number' && expectedCount !== failures.length) {
    items.push(unexpected(context, `reported ${expectedCount} failing test(s) but ${failures.length} could be identified`));
  }
  return items;
}

// ---------------------------------------------------------------------------
// Per-step item extraction
// ---------------------------------------------------------------------------

const STATUS_THRESHOLD_TAGS = { core_tests_tag_B_pass: 'B', core_tests_tag_W_pass: 'W' };

function statusItems(step) {
  const items = [];
  if (step.exit !== 0) items.push(unexpected('status.mjs exit', `status.mjs exited ${step.exit}`));
  if (!step.thresholds) {
    items.push(unexpected('status.json', 'status.json was not produced, so no §0 threshold could be judged'));
    return items;
  }
  for (const [name, t] of Object.entries(step.thresholds)) {
    if (t.meets === true) continue;
    const label = `threshold: ${name}`;
    if (t.meets == null) {
      items.push(unexpected(label, 'not judged: the metric was unavailable in status.json'));
      continue;
    }
    const tag = STATUS_THRESHOLD_TAGS[name];
    if (!tag) {
      const detail = 'value' in t ? ` (value ${JSON.stringify(t.value)}${'floor' in t ? `, floor ${t.floor}` : ''})` : '';
      items.push(unexpected(label, `§0 threshold not met${detail}; no known pending owner`));
      continue;
    }
    // A tag-tally threshold: classify the actual failing tests with that tag
    // from the CONCERTO_ENGINE=ts run status.mjs made.
    const failing = t.failing;
    const list = Array.isArray(step.ts_failures) ? step.ts_failures.filter((f) => f.tag === tag) : null;
    items.push(...classifyTestFailures(list, failing, `${label} (CONCERTO_ENGINE=ts, tag ${tag})`));
  }
  return items;
}

function coreSuiteRustItems(step) {
  const failing = step.stats ? step.stats.failures : null;
  if (!step.stats) {
    return [unexpected('core suite (CONCERTO_ENGINE=rust)', `mocha exited ${step.exit} and its JSON reporter output could not be parsed`)];
  }
  const items = classifyTestFailures(step.failures ?? null, failing, 'core suite (CONCERTO_ENGINE=rust)');
  if (items.length === 0) {
    items.push(unexpected('core suite (CONCERTO_ENGINE=rust)', `mocha exited ${step.exit} with no failing tests reported`));
  }
  return items;
}

function wasmItems(step) {
  const items = [];
  if (!step.build_ok) items.push(unexpected('wasm: build.sh', 'build failed'));
  if (step.within_budget !== true) {
    items.push(unexpected('wasm: size budget', `size ${step.size_bytes} bytes vs budget ${step.size_budget_bytes}`));
  }
  if (!step.install_ok) items.push(unexpected('wasm: npm install', 'npm install failed'));
  if (!step.smoke_ok) {
    if (!Array.isArray(step.smoke_failures)) {
      items.push(unexpected('wasm: smoke:node', 'smoke failed and its check rows could not be parsed'));
    } else if (step.smoke_failures.length === 0) {
      items.push(unexpected('wasm: smoke:node', 'smoke exited non-zero with no failing check rows'));
    } else {
      for (const row of step.smoke_failures) {
        const label = `wasm smoke check: ${row.name}${row.runtime ? ` (${row.runtime})` : ''}`;
        const known = KNOWN_WASM_SMOKE_FAILURES.find((k) => k.check === row.name);
        items.push(known ? expected(label, known) : unexpected(label, `not in the known-failure set: ${truncate(row.detail)}`));
      }
    }
  }
  if (items.length === 0) items.push(unexpected('wasm', 'step failed but no failing leg was identified'));
  return items;
}

function oracleWasmItems(step) {
  const r = step.replay;
  if (!r) return [unexpected('oracle WASM replay', `replay.js exited ${step.exit} without a report`)];
  const items = [];
  if (r.harness_error > 0) items.push(unexpected('oracle WASM replay: harness errors', `${r.harness_error} harness error(s)`));
  if (!(r.total > 0)) items.push(unexpected('oracle WASM replay', 'no fixtures replayed'));
  const failures = step.failures;
  if (!Array.isArray(failures) || r.failures_truncated || failures.length !== r.fail) {
    items.push(unexpected('oracle WASM replay: failures', `${r.fail} failing fixture(s) but the full list is not available`));
    return items;
  }
  const K = KNOWN_ORACLE_WASM_DISAGREEMENTS;
  let knownCount = 0;
  for (const f of failures) {
    const label = `oracle fixture: ${f.file} (${f.op})`;
    if (K.ops.includes(f.op)) {
      knownCount++;
      items.push(expected(label, K));
    } else {
      items.push(unexpected(label, `not in the known-disagreement set: ${truncate(f.detail)}`));
    }
  }
  if (knownCount > K.maxCount) {
    items.push(unexpected('oracle WASM replay: DecoratorManager count', `${knownCount} DecoratorManager disagreements, more than the ${K.maxCount} tracked by ${K.owner}`));
  }
  if (items.length === 0) items.push(unexpected('oracle WASM replay', `replay.js exited ${step.exit} with no failing fixture`));
  return items;
}

function oracleCoverageItems(step) {
  if (!step.meets_floor) return [unexpected('oracle coverage', `coverage.sh exited ${step.exit} or produced no coverage.json`)];
  const items = [];
  for (const [metric, ok] of Object.entries(step.meets_floor)) {
    if (ok) continue;
    const pct = step.coverage && step.coverage.corpus && step.coverage.corpus[metric] && step.coverage.corpus[metric].pct;
    items.push(unexpected(`oracle coverage: ${metric}`, `${pct}% < floor ${step.floor[metric]}%; no open task owns it (corpus-currency question routed to the maintainer)`));
  }
  if (items.length === 0) items.push(unexpected('oracle coverage', `coverage.sh exited ${step.exit}`));
  return items;
}

function genericItems(key, step) {
  const bits = [];
  if ('exit' in step) bits.push(`exit ${step.exit}`);
  if ('failed' in step && step.failed != null) bits.push(`${step.failed} failed`);
  return [unexpected(key, bits.length ? bits.join(', ') : 'step reported not ok')];
}

/** Every top-level JSON object printed to a stream (string-aware brace matching). */
export function parseJsonDocuments(text) {
  const docs = [];
  let i = 0;
  while (i < text.length) {
    const start = text.indexOf('{', i);
    if (start === -1) break;
    let depth = 0, inString = false, escaped = false, end = -1;
    for (let j = start; j < text.length; j++) {
      const ch = text[j];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') inString = true;
      else if (ch === '{') depth++;
      else if (ch === '}' && --depth === 0) { end = j + 1; break; }
    }
    if (end === -1) break;
    try { docs.push(JSON.parse(text.slice(start, end))); i = end; } catch { i = start + 1; }
  }
  return docs;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Classifies one step result from run.mjs.
 * Returns { verdict: 'pass' | 'not-run' | 'expected-pending' | 'unexpected', items, owners }.
 */
export function classifyStep(key, step) {
  if (step == null) return { verdict: 'not-run', items: [], owners: [] };
  if (step.na) return { verdict: 'not-run', reason: step.na, items: [], owners: [] };
  if (step.ok === true) return { verdict: 'pass', items: [], owners: [] };

  let items;
  switch (key) {
    case 'status': items = statusItems(step); break;
    case 'core_suite_rust': items = coreSuiteRustItems(step); break;
    case 'wasm': items = wasmItems(step); break;
    case 'oracle_wasm': items = oracleWasmItems(step); break;
    case 'oracle_coverage': items = oracleCoverageItems(step); break;
    default: items = genericItems(key, step);
  }
  if (items.length === 0) items = [unexpected(key, 'step reported not ok but no failing item was identified')];

  const verdict = items.every((i) => i.verdict === EXPECTED) ? EXPECTED : UNEXPECTED;
  const owners = [...new Set(items.filter((i) => i.verdict === EXPECTED).map((i) => i.owner))];
  return { verdict, items, owners };
}

/** One-line label for report.md. */
export function verdictLabel(c) {
  if (c.verdict === 'pass') return 'PASS';
  if (c.verdict === 'not-run') return `NOT RUN: ${c.reason ?? 'skipped'}`;
  const nUnexpected = c.items.filter((i) => i.verdict === UNEXPECTED).length;
  if (c.verdict === EXPECTED) return `expected-pending (owner: ${c.owners.join('; ')})`;
  return `unexpected (${nUnexpected} of ${c.items.length} failing item(s) not in a known, owned set)`;
}
