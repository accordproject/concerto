// Unit tests for migration/gate/classify.mjs (task P5-01a).
// Run: node --test migration/gate/test/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyStep,
  classifyTestFailure,
  parseJsonDocuments,
  verdictLabel,
  KNOWN_ORACLE_WASM_DISAGREEMENTS,
} from '../classify.mjs';

const NETWORK_FAILURE = {
  file: 'modelloader.js',
  fullTitle: 'ModelLoader #loadModelFromUrl should load models',
  tag: 'B',
  message: 'Request failed with status code 403',
};
const OTHER_B_FAILURE = {
  file: 'introspect/modelfile.js',
  fullTitle: 'ModelFile #constructor should throw when ast is null',
  tag: 'B',
  message: 'expected [Function] to throw an error',
};

function passingThresholds() {
  return {
    ledger_weighted_pct_rust_plus_hybrid: { value: 85.3, floor: 70, meets: true },
    llvm_cov_lines_pct: { value: 92.35, floor: 90, meets: true },
    conformance_all_scenarios_pass: { value: { total: 75, failed: 0 }, meets: true },
    core_tests_tag_B_pass: { failing: 0, meets: true },
    core_tests_tag_W_pass: { failing: 0, meets: true },
  };
}

function statusStep({ thresholds = passingThresholds(), ts_failures = [], exit = 0 } = {}) {
  const ok = exit === 0 && Object.values(thresholds).every((t) => t.meets === true);
  return { name: 'status.mjs (full run)', ok, exit, thresholds, ts_failures };
}

function withTagB(failures) {
  const t = passingThresholds();
  t.core_tests_tag_B_pass = { failing: failures.filter((f) => f.tag === 'B').length, meets: false };
  return t;
}

// --- status step -----------------------------------------------------------

test('status: only the known network test failing → expected-pending, environment owner, not P4-08', () => {
  const c = classifyStep('status', statusStep({ thresholds: withTagB([NETWORK_FAILURE]), ts_failures: [NETWORK_FAILURE] }));
  assert.equal(c.verdict, 'expected-pending');
  assert.equal(c.items.length, 1);
  assert.match(c.owners[0], /environment/);
  assert.doesNotMatch(verdictLabel(c), /P4-08/);
});

test('status: known network test plus another tag-B failure → unexpected', () => {
  const fails = [NETWORK_FAILURE, OTHER_B_FAILURE];
  const c = classifyStep('status', statusStep({ thresholds: withTagB(fails), ts_failures: fails }));
  assert.equal(c.verdict, 'unexpected');
  assert.deepEqual(c.items.map((i) => i.verdict).sort(), ['expected-pending', 'unexpected']);
});

test('status: network test failing with a non-network error → unexpected', () => {
  const f = { ...NETWORK_FAILURE, message: "TypeError: Cannot read properties of undefined (reading 'x')" };
  const c = classifyStep('status', statusStep({ thresholds: withTagB([f]), ts_failures: [f] }));
  assert.equal(c.verdict, 'unexpected');
});

test('status: tag-B threshold failed but the failing-test list is unavailable → unexpected', () => {
  const c = classifyStep('status', statusStep({ thresholds: withTagB([NETWORK_FAILURE]), ts_failures: null }));
  assert.equal(c.verdict, 'unexpected');
});

test('status: tally count disagrees with the identified failures → unexpected', () => {
  const t = passingThresholds();
  t.core_tests_tag_B_pass = { failing: 2, meets: false };
  const c = classifyStep('status', statusStep({ thresholds: t, ts_failures: [NETWORK_FAILURE] }));
  assert.equal(c.verdict, 'unexpected');
});

test('status: llvm-cov below 90 (with the known network test also failing) → unexpected', () => {
  const t = withTagB([NETWORK_FAILURE]);
  t.llvm_cov_lines_pct = { value: 89.2, floor: 90, meets: false };
  const c = classifyStep('status', statusStep({ thresholds: t, ts_failures: [NETWORK_FAILURE] }));
  assert.equal(c.verdict, 'unexpected');
  assert.ok(c.items.some((i) => i.item === 'threshold: llvm_cov_lines_pct' && i.verdict === 'unexpected'));
});

test('status: conformance failure → unexpected', () => {
  const t = passingThresholds();
  t.conformance_all_scenarios_pass = { value: { total: 75, failed: 2 }, meets: false };
  assert.equal(classifyStep('status', statusStep({ thresholds: t })).verdict, 'unexpected');
});

test('status: ledger drop below 70 → unexpected', () => {
  const t = passingThresholds();
  t.ledger_weighted_pct_rust_plus_hybrid = { value: 64.1, floor: 70, meets: false };
  assert.equal(classifyStep('status', statusStep({ thresholds: t })).verdict, 'unexpected');
});

test('status: a threshold that was not judged (metric na) → unexpected', () => {
  const t = passingThresholds();
  t.llvm_cov_lines_pct = { value: null, floor: 90, meets: null };
  assert.equal(classifyStep('status', statusStep({ thresholds: t })).verdict, 'unexpected');
});

test('status: status.mjs exits non-zero → unexpected', () => {
  assert.equal(classifyStep('status', statusStep({ exit: 1 })).verdict, 'unexpected');
});

test('status: all thresholds met → pass', () => {
  assert.equal(classifyStep('status', statusStep()).verdict, 'pass');
});

// --- core_suite_rust -------------------------------------------------------

function rustStep(failures, statsFailures = failures.length) {
  return { ok: failures.length === 0, exit: failures.length ? 1 : 0, stats: { failures: statsFailures }, failures };
}

test('core_suite_rust: only the known network test → expected-pending', () => {
  const c = classifyStep('core_suite_rust', rustStep([NETWORK_FAILURE]));
  assert.equal(c.verdict, 'expected-pending');
  assert.match(c.owners.join(), /environment/);
});

test('core_suite_rust: known plus an extra failure → unexpected', () => {
  const c = classifyStep('core_suite_rust', rustStep([NETWORK_FAILURE, OTHER_B_FAILURE]));
  assert.equal(c.verdict, 'unexpected');
  assert.equal(c.items.filter((i) => i.verdict === 'unexpected').length, 1);
});

test('core_suite_rust: unparsable mocha output → unexpected', () => {
  assert.equal(classifyStep('core_suite_rust', { ok: false, exit: 1, stats: null, failures: null }).verdict, 'unexpected');
});

test('core_suite_rust: non-zero exit with no failing tests → unexpected', () => {
  assert.equal(classifyStep('core_suite_rust', { ok: false, exit: 1, stats: { failures: 0 }, failures: [] }).verdict, 'unexpected');
});

test('core_suite_rust: failure matched on title but a different file → unexpected', () => {
  const c = classifyTestFailure({ ...NETWORK_FAILURE, file: 'other.js' });
  assert.equal(c.verdict, 'unexpected');
});

// --- wasm --------------------------------------------------------------------

function wasmStep(overrides = {}) {
  return {
    ok: false, build_ok: true, size_bytes: 1_500_000, size_budget_bytes: 4194304, within_budget: true, install_ok: true,
    smoke_ok: false,
    smoke_failures: [
      { runtime: 'node (CommonJS)', name: 'a new manager holds the system model', detail: 'modelFileIds 0,1' },
      { runtime: 'node (CommonJS)', name: 'property handles and snapshots', detail: 'enum values have no PropId yet (P2-04)' },
    ],
    ...overrides,
  };
}

test('wasm: only the two stale smoke checks from #150 → expected-pending (#150)', () => {
  const c = classifyStep('wasm', wasmStep());
  assert.equal(c.verdict, 'expected-pending');
  assert.match(c.owners.join(), /#150/);
});

test('wasm: a new smoke failure → unexpected', () => {
  const s = wasmStep();
  s.smoke_failures.push({ runtime: 'node (CommonJS)', name: 'a freed manager throws', detail: 'did not throw' });
  assert.equal(classifyStep('wasm', s).verdict, 'unexpected');
});

test('wasm: over the size budget → unexpected even if the smoke failures are known', () => {
  assert.equal(classifyStep('wasm', wasmStep({ size_bytes: 5_000_000, within_budget: false })).verdict, 'unexpected');
});

test('wasm: smoke output unparsable → unexpected', () => {
  assert.equal(classifyStep('wasm', wasmStep({ smoke_failures: null })).verdict, 'unexpected');
});

// --- oracle_wasm -------------------------------------------------------------

function oracleWasmStep(failures, extra = {}) {
  return {
    ok: false, exit: 1,
    replay: { total: 16085, pass: 16085 - failures.length, fail: failures.length, harness_error: 0, failures_truncated: false, ...extra },
    failures,
  };
}
const decoFailures = (n) =>
  Array.from({ length: n }, (_, i) => ({ file: `data/DecoratorManager.decorateModels/${i}.json`, op: 'DecoratorManager.decorateModels', detail: 'x' }));

test('oracle_wasm: the tracked DecoratorManager disagreements → expected-pending, owner P4-09a', () => {
  const c = classifyStep('oracle_wasm', oracleWasmStep(decoFailures(31)));
  assert.equal(c.verdict, 'expected-pending');
  assert.match(c.owners.join(), /P4-09a/);
});

test('oracle_wasm: more DecoratorManager disagreements than tracked → unexpected', () => {
  const c = classifyStep('oracle_wasm', oracleWasmStep(decoFailures(KNOWN_ORACLE_WASM_DISAGREEMENTS.maxCount + 1)));
  assert.equal(c.verdict, 'unexpected');
});

test('oracle_wasm: a disagreement in another op → unexpected', () => {
  const f = [...decoFailures(3), { file: 'data/Serializer.toJSON/a.json', op: 'Serializer.toJSON', detail: 'y' }];
  assert.equal(classifyStep('oracle_wasm', oracleWasmStep(f)).verdict, 'unexpected');
});

test('oracle_wasm: truncated failure list or harness errors → unexpected', () => {
  assert.equal(classifyStep('oracle_wasm', oracleWasmStep(decoFailures(3), { failures_truncated: true })).verdict, 'unexpected');
  assert.equal(classifyStep('oracle_wasm', oracleWasmStep(decoFailures(3), { harness_error: 1 })).verdict, 'unexpected');
});

// --- everything else -----------------------------------------------------------

test('oracle_coverage below floor → unexpected (no owning task)', () => {
  const c = classifyStep('oracle_coverage', {
    ok: false, exit: 0, floor: { statements: 99, branches: 94.8 },
    coverage: { corpus: { statements: { pct: 95.4 }, branches: { pct: 95.9 } } },
    meets_floor: { statements: false, branches: true },
  });
  assert.equal(c.verdict, 'unexpected');
  assert.equal(c.items.length, 1);
});

test('guardrails / native oracle / conformance install failing → unexpected', () => {
  for (const key of ['guardrails', 'oracle_native', 'conformance_install', 'corpus_provenance']) {
    assert.equal(classifyStep(key, { ok: false, exit: 1 }).verdict, 'unexpected', key);
  }
});

test('a step marked na is not-run, not a pass', () => {
  const c = classifyStep('cargo_mutants', { na: 'owned by P5-06' });
  assert.equal(c.verdict, 'not-run');
  assert.match(verdictLabel(c), /NOT RUN/);
});

test('parseJsonDocuments finds each top-level object, ignoring braces in strings', () => {
  const docs = parseJsonDocuments('noise {"rows":[{"name":"a}","ok":false}]}\n> next\n{"rows":[]}');
  assert.equal(docs.length, 2);
  assert.equal(docs[0].rows[0].name, 'a}');
});
