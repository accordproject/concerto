#!/usr/bin/env node
/**
 * migration/gate/run.mjs  (task P5-01a)
 *
 * The Phase 5 gate runner: runs everything migration/gate/CHECKLIST.md maps
 * to a §0 done criterion, plus the WASM size budget and smokes, and writes
 * one report. This is prep work — a *dry run* of the mechanics, not the
 * final gate (P5-01, blocked on all of Phase 4). Failures are expected
 * wherever a Phase 4 group has not landed yet; this script does not try to
 * fix product code, and never touches packages/concerto-core/test/**,
 * the canonical oracle corpus, or baseline.tsv.
 *
 * Usage:
 *   node migration/gate/run.mjs [options]
 *
 *   --oracle-fixtures <dir>   Canonical corpus (default: sibling
 *                             ../concerto/migration/oracle/fixtures next to
 *                             this checkout, i.e. CONCERTO_ORACLE_FIXTURES
 *                             if already exported, else that sibling path).
 *   --rust-root <dir>         concerto-rust checkout (default: sibling).
 *   --validate-rs-root <dir> concerto-validate-rs checkout (default: sibling).
 *   --conformance-root <dir> concerto-conformance checkout (default: sibling).
 *   --skip-status             Skip the migration/bin/status.mjs step
 *                             (core suite ts+rust, nyc, rust cargo
 *                             test/llvm-cov, conformance, ledger).
 *   --skip-oracle-coverage     Skip coverage.sh --with-suite (slow: reruns
 *                             nyc over the reference AND the unit suite).
 *   --skip-wasm               Skip the concerto-wasm build/size/smoke step.
 *   --skip-conformance-install Skip `npm install` in concerto-conformance
 *                             before status.mjs's conformance collection
 *                             (only useful if it is already installed).
 *   --fast                    Pass --fast through to status.mjs (skips its
 *                             llvm-cov and conformance). Off by default:
 *                             the plan requires the full run for the gate.
 *
 * Writes migration/gate/reports/<timestamp>/{report.json,report.md} plus
 * copies of every sub-tool's own output (status.json, oracle results,
 * guardrails log, wasm build/smoke logs).
 */

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyStep, parseJsonDocuments, verdictLabel } from './classify.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION_ROOT = path.resolve(__dirname, '..');
const CONCERTO_ROOT = path.resolve(MIGRATION_ROOT, '..');
const DEFAULT_RUST_ROOT = path.resolve(CONCERTO_ROOT, '..', 'concerto-rust');
const DEFAULT_VALIDATE_RS_ROOT = path.resolve(CONCERTO_ROOT, '..', 'concerto-validate-rs');
const DEFAULT_CONFORMANCE_ROOT = path.resolve(CONCERTO_ROOT, '..', 'concerto-conformance');
const DEFAULT_ORACLE_FIXTURES =
  process.env.CONCERTO_ORACLE_FIXTURES || path.join(CONCERTO_ROOT, 'migration', 'oracle', 'fixtures');

function parseArgs(argv) {
  const o = {
    oracleFixtures: DEFAULT_ORACLE_FIXTURES,
    rustRoot: DEFAULT_RUST_ROOT,
    validateRsRoot: DEFAULT_VALIDATE_RS_ROOT,
    conformanceRoot: DEFAULT_CONFORMANCE_ROOT,
    skipStatus: false,
    skipOracleCoverage: false,
    skipWasm: false,
    skipConformanceInstall: false,
    fast: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--oracle-fixtures') o.oracleFixtures = path.resolve(next());
    else if (a === '--rust-root') o.rustRoot = path.resolve(next());
    else if (a === '--validate-rs-root') o.validateRsRoot = path.resolve(next());
    else if (a === '--conformance-root') o.conformanceRoot = path.resolve(next());
    else if (a === '--skip-status') o.skipStatus = true;
    else if (a === '--skip-oracle-coverage') o.skipOracleCoverage = true;
    else if (a === '--skip-wasm') o.skipWasm = true;
    else if (a === '--skip-conformance-install') o.skipConformanceInstall = true;
    else if (a === '--fast') o.fast = true;
    else throw new Error(`unrecognised argument: ${a}`);
  }
  return o;
}

function run(cmd, args, { cwd, env, timeoutMs = 10 * 60 * 1000, logFile } = {}) {
  const res = spawnSync(cmd, args, {
    cwd,
    env: env ? { ...process.env, ...env } : process.env,
    timeout: timeoutMs,
    maxBuffer: 256 * 1024 * 1024,
    encoding: 'utf8',
  });
  const stdout = res.stdout || '';
  const stderr = res.stderr || '';
  if (logFile) {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.writeFileSync(
      logFile,
      `$ ${cmd} ${args.join(' ')}\n(cwd: ${cwd || process.cwd()})\n\n--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}\n--- exit: ${res.status} signal: ${res.signal} ---\n`
    );
  }
  return { ok: res.status === 0 && !res.error, status: res.status, stdout, stderr, error: res.error ? res.error.message : null };
}

function sha256(filePath) {
  return execFileSync('sha256sum', [filePath], { encoding: 'utf8' }).trim().split(/\s+/)[0];
}

// ---------------------------------------------------------------------------
// Step: guardrails (§0.5)
// ---------------------------------------------------------------------------
function stepGuardrails(reportDir) {
  const logFile = path.join(reportDir, 'guardrails.log');
  const res = run('node', [path.join(MIGRATION_ROOT, 'bin', 'check-guardrails.mjs'), '--base-ref', 'origin/main'], {
    cwd: CONCERTO_ROOT,
    logFile,
  });
  return { name: 'guardrails (§0.5 API snapshot + guardrails)', ok: res.ok, exit: res.status, log: path.relative(reportDir, logFile) };
}

// ---------------------------------------------------------------------------
// Step: full status.mjs (§0.1, §0.2, §0.3 reference replay, §0.4 ledger read,
// §0.6 rust tests/llvm-cov, §0.7 conformance)
// ---------------------------------------------------------------------------
// status.mjs itself never applies a §0 threshold to what it collects — it
// always exits 0 unless it throws, whatever its metrics say (it just
// records numbers). So this step has to apply the thresholds itself, per
// CHECKLIST.md, rather than trusting the exit code as the verdict. A metric
// that came back `na` (tool missing, --fast used, ...) counts as NOT judged
// — never silently treated as a pass.
function checkFloor(value, floor) {
  return typeof value === 'number' && Number.isFinite(value) ? value >= floor : null;
}

function judgeStatusThresholds(status) {
  const m = status.metrics;
  const ledgerPct = m.ledger && m.ledger.weighted_pct_rust_plus_hybrid;
  const llvmCov = m.rust && m.rust['concerto-rust'] && m.rust['concerto-rust'].llvm_cov;
  // §0.6 is judged on the concerto-core crate's own lines %, which
  // status.mjs keys by crate directory ('concerto-core'), not by package
  // name. No fallback to the workspace figure: a missing per-crate number
  // means the criterion was not judged.
  const llvmCovPct =
    llvmCov && llvmCov.available && llvmCov.per_crate_lines_pct
      ? llvmCov.per_crate_lines_pct['concerto-core'] ?? null
      : null;
  const conformance = m.conformance;
  const conformanceOk = conformance && conformance.available ? conformance.failed === 0 : null;
  const byTag = m.concerto_core_tests && m.concerto_core_tests.by_tag;
  const tagOk = (tag) => {
    if (!byTag || !byTag.available) return null;
    const t = byTag.tally && byTag.tally[tag];
    return t ? t.failing === 0 : null;
  };
  const tagFailing = (tag) => (byTag && byTag.available && byTag.tally && byTag.tally[tag] ? byTag.tally[tag].failing : null);
  return {
    ledger_weighted_pct_rust_plus_hybrid: { value: ledgerPct ?? null, floor: 70, meets: checkFloor(ledgerPct, 70) },
    llvm_cov_lines_pct: { crate: 'concerto-core', value: llvmCovPct ?? null, floor: 90, meets: checkFloor(llvmCovPct, 90) },
    conformance_all_scenarios_pass: { value: conformance && conformance.available ? { total: conformance.total_scenarios, failed: conformance.failed } : null, meets: conformanceOk },
    core_tests_tag_B_pass: { failing: tagFailing('B'), meets: tagOk('B') },
    core_tests_tag_W_pass: { failing: tagFailing('W'), meets: tagOk('W') },
  };
}

// Tag map (migration/tags/test-tags.tsv), keyed by fullTitle and by
// `<file relative to packages/concerto-core/test>::<fullTitle>`, the same
// way status.mjs keys it.
function loadTagMap() {
  const tagsPath = path.join(MIGRATION_ROOT, 'tags', 'test-tags.tsv');
  if (!fs.existsSync(tagsPath)) return null;
  const lines = fs.readFileSync(tagsPath, 'utf8').split('\n').filter(Boolean);
  const header = lines[0].split('\t');
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  const map = new Map();
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t');
    const file = cols[idx.file], title = cols[idx.test_title], tag = cols[idx.tag];
    if (!title || !tag) continue;
    map.set(title, tag);
    map.set(`${file}::${title}`, tag);
  }
  return map;
}

const CORE_TEST_DIR = path.join(CONCERTO_ROOT, 'packages', 'concerto-core', 'test');
function tagOf(map, relFile, fullTitle) {
  return (map && ((relFile && map.get(`${relFile}::${fullTitle}`)) || map.get(fullTitle))) || 'untagged';
}

/** The failing tests from a mocha JSON reporter result, with file, tag and error message. */
function mochaFailures(mocha, tagMap) {
  return (mocha.failures || []).map((t) => {
    const relFile = t.file ? path.relative(CORE_TEST_DIR, t.file) : null;
    return {
      file: relFile,
      fullTitle: t.fullTitle,
      tag: tagOf(tagMap, relFile, t.fullTitle),
      message: t.err && (t.err.message || t.err.stack) ? String(t.err.message || t.err.stack) : '',
    };
  });
}

function stepStatus(opts, reportDir) {
  const args = [path.join(MIGRATION_ROOT, 'bin', 'status.mjs')];
  if (opts.fast) args.push('--fast');
  const logFile = path.join(reportDir, 'status-run.log');
  const res = run('node', args, {
    cwd: CONCERTO_ROOT,
    env: { CONCERTO_ORACLE_FIXTURES: opts.oracleFixtures },
    timeoutMs: 30 * 60 * 1000,
    logFile,
  });
  let status = null;
  let thresholds = null;
  const statusJsonPath = path.join(MIGRATION_ROOT, 'status', 'status.json');
  if (fs.existsSync(statusJsonPath)) {
    status = JSON.parse(fs.readFileSync(statusJsonPath, 'utf8'));
    fs.copyFileSync(statusJsonPath, path.join(reportDir, 'status.json'));
    const logsDir = path.join(MIGRATION_ROOT, 'status', 'logs');
    if (fs.existsSync(logsDir)) fs.cpSync(logsDir, path.join(reportDir, 'logs'), { recursive: true });
    thresholds = judgeStatusThresholds(status);
  }
  // The CONCERTO_ENGINE=ts run's own failing tests (status.mjs keeps its
  // parsed mocha JSON under logs/concerto-core/), so a failed tag-tally
  // threshold can be classified by which tests actually failed.
  let tsFailures = null;
  const mochaPath = path.join(reportDir, 'logs', 'concerto-core', 'mocha-results.json');
  if (fs.existsSync(mochaPath)) {
    try {
      tsFailures = mochaFailures(JSON.parse(fs.readFileSync(mochaPath, 'utf8')), loadTagMap());
    } catch { /* leave null: the classifier treats an unreadable list as unexpected */ }
  }
  // ok requires: the script itself ran cleanly, status.json was produced,
  // and every §0 threshold it carries was both judged (not `na`) and met.
  const ok = res.ok && thresholds != null && Object.values(thresholds).every((t) => t.meets === true);
  return { name: 'status.mjs (full run)', ok, exit: res.status, log: path.relative(reportDir, logFile), status, thresholds, ts_failures: tsFailures };
}

// ---------------------------------------------------------------------------
// Step: concerto-core suite with CONCERTO_ENGINE=rust (§0.1 B tests, §0.2 W
// tests). status.mjs's own `engine_modes.rust` is a hardcoded
// na('...has not landed') stub that predates P4-02 landing, so it is stale
// for every Phase 4 group that has since merged — this step runs the real
// thing instead of trusting that stub.
// ---------------------------------------------------------------------------
function stepCoreSuiteRust(opts, reportDir) {
  const coreDir = path.join(CONCERTO_ROOT, 'packages', 'concerto-core');
  const engineCjs = path.join(opts.rustRoot, 'concerto-wasm', 'pkg', 'concerto-engine.cjs');
  if (!fs.existsSync(engineCjs)) {
    return { name: 'concerto-core suite, CONCERTO_ENGINE=rust (§0.1/§0.2)', ok: false, na: `${engineCjs} not built yet (run concerto-wasm/build.sh first)` };
  }
  const logFile = path.join(reportDir, 'core-suite-rust.log');
  const res = run(
    'npx',
    ['mocha', '-r', 'ts-node/register', '--recursive', '-t', '10000', '--reporter', 'json', 'test/'],
    { cwd: coreDir, env: { TS_NODE_PROJECT: 'tsconfig.build.json', TZ: 'UTC', CONCERTO_ENGINE: 'rust' }, timeoutMs: 8 * 60 * 1000, logFile }
  );
  let mocha = null;
  try {
    const jsonStart = res.stdout.search(/\{\s*\n\s*"stats"/);
    if (jsonStart !== -1) mocha = JSON.parse(res.stdout.slice(jsonStart));
  } catch { /* leave null; raw log still captured */ }
  fs.writeFileSync(path.join(reportDir, 'core-suite-rust-raw-stdout.log'), res.stdout);

  let by_tag = null;
  const map = loadTagMap();
  if (mocha && map) {
    const failedTitles = new Set((mocha.failures || []).map((t) => t.fullTitle));
    const pendingTitles = new Set((mocha.pending || []).map((t) => t.fullTitle));
    const tally = {};
    for (const t of mocha.tests || []) {
      const relFile = t.file ? path.relative(CORE_TEST_DIR, t.file) : null;
      const tag = tagOf(map, relFile, t.fullTitle);
      tally[tag] = tally[tag] || { tests: 0, passing: 0, failing: 0, pending: 0 };
      tally[tag].tests++;
      tally[tag][failedTitles.has(t.fullTitle) ? 'failing' : pendingTitles.has(t.fullTitle) ? 'pending' : 'passing']++;
    }
    by_tag = tally;
  }

  return {
    name: 'concerto-core suite, CONCERTO_ENGINE=rust (§0.1/§0.2, real run — status.mjs\'s own engine_modes.rust is stale)',
    ok: res.ok,
    exit: res.status,
    stats: mocha ? mocha.stats : null,
    by_tag,
    failures: mocha ? mochaFailures(mocha, map) : null,
    log: path.relative(reportDir, logFile),
  };
}

// ---------------------------------------------------------------------------
// Step: native oracle harness explicitly, for a clean pass/fail independent
// of status.mjs's own cargo test --workspace (§0.3 native leg)
// ---------------------------------------------------------------------------
function stepOracleNative(opts, reportDir) {
  const logFile = path.join(reportDir, 'oracle-native.log');
  if (!fs.existsSync(opts.rustRoot)) {
    return { name: 'oracle native (cargo test --test oracle)', ok: false, na: `${opts.rustRoot} does not exist` };
  }
  const res = run(
    'cargo',
    ['test', '--release', '-p', 'accordproject-concerto-core', '--test', 'oracle'],
    { cwd: opts.rustRoot, env: { CONCERTO_ORACLE_FIXTURES: opts.oracleFixtures }, timeoutMs: 15 * 60 * 1000, logFile }
  );
  const m = res.stdout.match(/test result: (\w+)\. (\d+) passed; (\d+) failed;/);
  return {
    name: 'oracle native (cargo test --test oracle, §0.3 native leg)',
    ok: res.ok,
    passed: m ? Number(m[2]) : null,
    failed: m ? Number(m[3]) : null,
    log: path.relative(reportDir, logFile),
  };
}

// ---------------------------------------------------------------------------
// Shared: the JS oracle tools (coverage.sh, replay.js) don't read
// CONCERTO_ORACLE_FIXTURES at all (that's Rust-only, see PORTING.md OD-7);
// they always resolve migration/oracle/fixtures relative to this checkout.
// From a worktree that's empty (gitignored), so make sure it resolves to
// the canonical corpus before running either tool, or the step silently
// "passes" against near-nothing (single-digit % coverage).
// ---------------------------------------------------------------------------
function ensureFixturesSymlink(opts) {
  const fixturesLink = path.join(MIGRATION_ROOT, 'oracle', 'fixtures');
  if (!fs.existsSync(fixturesLink) && fs.existsSync(opts.oracleFixtures)) {
    fs.symlinkSync(opts.oracleFixtures, fixturesLink);
    return { ok: true };
  }
  if (fs.existsSync(fixturesLink) && fs.realpathSync(fixturesLink) !== fs.realpathSync(opts.oracleFixtures)) {
    return {
      ok: false,
      na: `${fixturesLink} exists and does not resolve to the canonical corpus (${opts.oracleFixtures}); refusing to run against the wrong corpus`,
    };
  }
  return { ok: true };
}

// §0.3's floor: statements/functions/lines >= 99, branches >= 94.8 (the unit
// suite's own coverage of the reference, per CHECKLIST.md §3).
const ORACLE_COVERAGE_FLOOR = { statements: 99, functions: 99, lines: 99, branches: 94.8 };

// ---------------------------------------------------------------------------
// Step: oracle corpus coverage of the reference (§0.3 coverage floor)
// ---------------------------------------------------------------------------
function stepOracleCoverage(opts, reportDir) {
  const workDir = path.join(reportDir, 'oracle-coverage-work');
  const logFile = path.join(reportDir, 'oracle-coverage.log');
  const name = 'oracle corpus coverage of the reference (§0.3 floor)';

  const link = ensureFixturesSymlink(opts);
  if (!link.ok) return { name, ok: false, na: link.na };

  const res = run(
    'bash',
    [path.join(MIGRATION_ROOT, 'oracle', 'bin', 'coverage.sh'), workDir, '--with-suite'],
    { cwd: CONCERTO_ROOT, env: { CONCERTO_ORACLE_FIXTURES: opts.oracleFixtures }, timeoutMs: 20 * 60 * 1000, logFile }
  );
  // Only trust coverage.json when this run actually produced it: a failed
  // or skipped run must never report a stale coverage.json left over from
  // a previous (possibly unrelated) invocation as if it were fresh.
  const coveragePath = path.join(MIGRATION_ROOT, 'oracle', 'results', 'coverage.json');
  let coverage = null;
  let meetsFloor = null;
  if (res.ok && fs.existsSync(coveragePath)) {
    coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
    fs.copyFileSync(coveragePath, path.join(reportDir, 'oracle-coverage.json'));
    const corpus = coverage.corpus || {};
    meetsFloor = {};
    for (const metric of Object.keys(ORACLE_COVERAGE_FLOOR)) {
      const pct = corpus[metric] && corpus[metric].pct;
      meetsFloor[metric] = typeof pct === 'number' && pct >= ORACLE_COVERAGE_FLOOR[metric];
    }
  }
  // The step only "passes" when coverage.sh exited 0 AND every §0.3 floor
  // metric is actually met — an exit-0 run against below-floor coverage is
  // not a pass just because the shell script didn't error.
  const ok = res.ok && meetsFloor != null && Object.values(meetsFloor).every(Boolean);
  return {
    name,
    ok,
    exit: res.status,
    log: path.relative(reportDir, logFile),
    coverage,
    floor: ORACLE_COVERAGE_FLOOR,
    meets_floor: meetsFloor,
  };
}

// ---------------------------------------------------------------------------
// Step: oracle corpus through the JS/WASM binding (§0.3 WASM leg —
// CHECKLIST.md §3 "WASM (JS binding)": replay.js --engine
// migration/oracle/lib/rust-adapter.js, driven by the built concerto-engine
// module via CONCERTO_ENGINE_MODULE, same as stepCoreSuiteRust's B/W run).
// ---------------------------------------------------------------------------
function stepOracleWasm(opts, reportDir) {
  const name = 'oracle WASM/JS-binding leg (§0.3, replay.js --engine rust-adapter.js)';
  const engineCjs = path.join(opts.rustRoot, 'concerto-wasm', 'pkg', 'concerto-engine.cjs');
  if (!fs.existsSync(engineCjs)) {
    return { name, ok: false, na: `${engineCjs} not built yet (run concerto-wasm/build.sh first)` };
  }
  const link = ensureFixturesSymlink(opts);
  if (!link.ok) return { name, ok: false, na: link.na };

  const adapterPath = path.join(MIGRATION_ROOT, 'oracle', 'lib', 'rust-adapter.js');
  const reportPath = path.join(reportDir, 'oracle-replay-wasm.json');
  const logFile = path.join(reportDir, 'oracle-wasm.log');
  const res = run(
    'node',
    [path.join(MIGRATION_ROOT, 'oracle', 'bin', 'replay.js'), '--engine', adapterPath, '--report', reportPath],
    // 20 minutes was measured against a smaller pre-supplement corpus and is
    // no longer enough for the full pin+supplement corpus (16,862 fixtures
    // replayed one at a time through the JS/WASM binding, each paying the
    // WASM call-boundary cost): a P5-01 full-gate run hit this timeout
    // (SIGTERM, no report written) even though the leg itself was still
    // making progress. Widened so a real hang still gets caught well short
    // of an agent turn's own limits.
    { cwd: CONCERTO_ROOT, env: { CONCERTO_ENGINE_MODULE: engineCjs }, timeoutMs: 90 * 60 * 1000, logFile }
  );
  let replay = null;
  if (fs.existsSync(reportPath)) replay = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  return {
    name,
    ok: res.ok && replay != null && replay.pass === replay.total && replay.total > 0 && replay.fail === 0 && replay.harness_error === 0,
    exit: res.status,
    log: path.relative(reportDir, logFile),
    replay: replay
      ? { total: replay.total, pass: replay.pass, fail: replay.fail, harness_error: replay.harness_error, agreement_pct: replay.agreement_pct, failures_truncated: replay.failures_truncated }
      : null,
    failures: replay && Array.isArray(replay.failures) ? replay.failures.map((f) => ({ file: f.file, op: f.op, status: f.status, detail: f.detail })) : null,
  };
}

// ---------------------------------------------------------------------------
// Step: WASM build (size budget) + smokes
// ---------------------------------------------------------------------------
function stepWasm(opts, reportDir) {
  const wasmDir = path.join(opts.rustRoot, 'concerto-wasm');
  if (!fs.existsSync(wasmDir)) {
    return { name: 'WASM build/size/smoke', ok: false, na: `${wasmDir} does not exist` };
  }
  const buildLog = path.join(reportDir, 'wasm-build.log');
  const buildRes = run('sh', ['build.sh'], { cwd: wasmDir, timeoutMs: 10 * 60 * 1000, logFile: buildLog });

  // build.sh's own optimised, size-budgeted output (pkg/concerto_wasm.wasm),
  // not the pre-wasm-opt raw build in target/ — that one isn't budget-checked.
  let bytes = null;
  const wasmFile = path.join(wasmDir, 'pkg', 'concerto_wasm.wasm');
  if (fs.existsSync(wasmFile)) bytes = fs.statSync(wasmFile).size;
  const BUDGET = 4194304;

  const installLog = path.join(reportDir, 'wasm-npm-install.log');
  const installRes = run('npm', ['install', '--no-audit', '--no-fund'], { cwd: wasmDir, timeoutMs: 5 * 60 * 1000, logFile: installLog });

  const smokeLog = path.join(reportDir, 'wasm-smoke.log');
  const smokeRes = buildRes.ok
    ? run('npm', ['run', 'smoke:node'], { cwd: wasmDir, timeoutMs: 5 * 60 * 1000, logFile: smokeLog })
    : { ok: false, status: null };

  // smoke:node prints one JSON document per runtime ({runtime, rows: [{name,
  // ok, detail}]}); keep the failing rows so the classifier can match them.
  let smokeFailures = null;
  if (smokeRes.stdout != null) {
    const docs = parseJsonDocuments(smokeRes.stdout).filter((d) => d && Array.isArray(d.rows));
    if (docs.length > 0) {
      smokeFailures = docs.flatMap((d) => d.rows.filter((r) => !r.ok).map((r) => ({ runtime: d.runtime, name: r.name, detail: r.detail ?? null })));
    }
  }

  const withinBudget = bytes != null && bytes <= BUDGET;
  return {
    name: 'WASM build (size budget) + smoke:node',
    // A pass needs every leg green: the build itself, staying within the
    // size budget, npm install, and the smoke suite — not just "the shell
    // command that ran last exited 0".
    ok: buildRes.ok && withinBudget && installRes.ok && smokeRes.ok,
    build_ok: buildRes.ok,
    size_bytes: bytes,
    size_budget_bytes: BUDGET,
    within_budget: bytes != null ? withinBudget : null,
    install_ok: installRes.ok,
    smoke_ok: smokeRes.ok,
    smoke_failures: smokeFailures,
    logs: {
      build: path.relative(reportDir, buildLog),
      install: path.relative(reportDir, installLog),
      smoke: path.relative(reportDir, smokeLog),
    },
  };
}

// ---------------------------------------------------------------------------
// Step: conformance npm install (so status.mjs's own conformance collection
// can actually run instead of reporting "no installed dependencies")
// ---------------------------------------------------------------------------
function stepConformanceInstall(opts, reportDir) {
  if (!fs.existsSync(opts.conformanceRoot)) return { name: 'conformance npm install', ok: false, na: 'repo missing' };
  const logFile = path.join(reportDir, 'conformance-npm-install.log');
  const res = run('npm', ['install', '--no-audit', '--no-fund'], { cwd: opts.conformanceRoot, timeoutMs: 10 * 60 * 1000, logFile });
  return { name: 'conformance npm install', ok: res.ok, log: path.relative(reportDir, logFile) };
}

// ---------------------------------------------------------------------------
// Step: install the frozen oracle reference (published concerto-core 5.0.0,
// pinned by migration/oracle/reference/package-lock.json) so coverage.sh can
// instrument it. node_modules is gitignored, so a fresh checkout or worktree
// never has it; README.md's documented one-time `npm ci`.
// ---------------------------------------------------------------------------
function stepOracleReferenceInstall(reportDir) {
  const refDir = path.join(MIGRATION_ROOT, 'oracle', 'reference');
  const logFile = path.join(reportDir, 'oracle-reference-npm-ci.log');
  const res = run('npm', ['ci', '--no-audit', '--no-fund'], { cwd: refDir, timeoutMs: 10 * 60 * 1000, logFile });
  return { name: 'oracle reference npm ci (frozen concerto-core 5.0.0)', ok: res.ok, exit: res.status, log: path.relative(reportDir, logFile) };
}

// ---------------------------------------------------------------------------
// Corpus provenance check (never trust a corpus that isn't the canonical one)
// ---------------------------------------------------------------------------
const CANONICAL_CORPUS_SHA256 = 'e8a2bf72c7775a2d45123dea7b6ff897823c74a108603f5412251ced2619fce1';
// Pin (oracle-corpus-p107-06aa375): the tarball extracted at the corpus root.
const EXPECTED_PIN_FILE_COUNT = 16704;
// Maintainer-approved additive supplement (issue 188, recorded by task
// P2-11b): oracle-corpus-supplement-d842c0ab7 adds fixtures/supplement/ —
// 157 new gap-driver fixtures plus its own manifest.json (158 files) — on
// top of the pin, without changing any pinned file. A full §0 gate needs
// the supplement present (baseline.tsv has 66 supplement rows and fails
// "baselined fixtures missing" without it), so this check requires both
// parts, counted separately so a corrupt pin can't hide behind a present
// supplement or vice versa.
const EXPECTED_SUPPLEMENT_FILE_COUNT = 158;
function countFiles(dir) {
  try {
    // -L: opts.oracleFixtures is a symlink into the shared corpus checkout
    // (worktrees don't duplicate the 16k-file corpus); without -L, BSD find
    // (macOS) refuses to descend through a symlinked top-level argument and
    // silently reports 0 files, which previously misread a fully-populated,
    // canonical corpus as missing.
    return Number(execFileSync('sh', ['-c', `find -L "${dir}" -type f | wc -l`], { encoding: 'utf8' }).trim());
  } catch {
    return null;
  }
}
function stepCorpusProvenance(opts) {
  const manifestPath = path.join(opts.oracleFixtures, 'manifest.json');
  const supplementDir = path.join(opts.oracleFixtures, 'supplement');
  const exists = fs.existsSync(opts.oracleFixtures);
  const supplementPresent = fs.existsSync(supplementDir);
  const fileCount = exists ? countFiles(opts.oracleFixtures) : null;
  const supplementFileCount = supplementPresent ? countFiles(supplementDir) : 0;
  const pinFileCount = fileCount != null && supplementFileCount != null ? fileCount - supplementFileCount : null;
  const expectedFileCount = EXPECTED_PIN_FILE_COUNT + EXPECTED_SUPPLEMENT_FILE_COUNT;
  return {
    name: 'oracle corpus provenance (must be the canonical corpus, never self-recorded)',
    // A pass needs the fixtures directory to exist, its non-supplement file
    // count to match the canonical pin exactly, AND (required for a full
    // gate) the maintainer-approved supplement to be present with exactly
    // its own recorded file count — this never re-hashes the corpus (that
    // was verified once at extraction time, see CANONICAL_CORPUS_SHA256
    // below), but a wrong, missing, partial or supplement-less corpus must
    // not read as a pass.
    ok: exists && pinFileCount === EXPECTED_PIN_FILE_COUNT && supplementPresent && supplementFileCount === EXPECTED_SUPPLEMENT_FILE_COUNT,
    fixtures_dir: opts.oracleFixtures,
    exists,
    file_count: fileCount,
    expected_file_count: expectedFileCount,
    pin_file_count: pinFileCount,
    expected_pin_file_count: EXPECTED_PIN_FILE_COUNT,
    supplement_present: supplementPresent,
    supplement_file_count: supplementFileCount,
    expected_supplement_file_count: EXPECTED_SUPPLEMENT_FILE_COUNT,
    manifest_present: fs.existsSync(manifestPath),
    note: 'This checks the fixtures directory is populated as expected; it does not re-hash the corpus (that was verified once at extraction time against ' + CANONICAL_CORPUS_SHA256 + ', plus the supplement\'s own pinned content hash 7b9be1de66690be63e689b3bf0feb4583ed6cd9597099fdec1acb32f87736e71).',
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportDir = path.join(MIGRATION_ROOT, 'gate', 'reports', stamp);
  fs.mkdirSync(reportDir, { recursive: true });

  const steps = {};
  steps.corpus_provenance = stepCorpusProvenance(opts);
  steps.guardrails = stepGuardrails(reportDir);
  if (!opts.skipConformanceInstall) steps.conformance_install = stepConformanceInstall(opts, reportDir);
  if (!opts.skipStatus) steps.status = stepStatus(opts, reportDir);
  // Build concerto-wasm before anything that loads pkg/concerto-engine.cjs
  // (the CONCERTO_ENGINE=rust suite and the WASM oracle leg), so both run
  // against the module built from --rust-root, never a stale leftover.
  if (!opts.skipWasm) steps.wasm = stepWasm(opts, reportDir);
  steps.core_suite_rust = stepCoreSuiteRust(opts, reportDir);
  steps.oracle_native = stepOracleNative(opts, reportDir);
  if (!opts.skipOracleCoverage) {
    steps.oracle_reference_install = stepOracleReferenceInstall(reportDir);
    steps.oracle_coverage = stepOracleCoverage(opts, reportDir);
  }
  if (!opts.skipWasm) steps.oracle_wasm = stepOracleWasm(opts, reportDir);

  // §0.6 cargo-mutants (validation modules) is not run by this script: it is
  // task P5-06's own long-running job, not part of the mechanical dry run.
  steps.cargo_mutants = {
    name: 'cargo-mutants on validation modules (§0.6 catch rate)',
    na: 'not run by this dry run — long-running, owned by task P5-06; cargo-mutants is installed in this environment for that task to use',
  };

  // Failure-driven classification (see classify.mjs): every failing step
  // is broken into failing items, each matched against a small, explicit
  // set of known failures with an owner; anything else is `unexpected`.
  const classification = {};
  for (const [key, st] of Object.entries(steps)) classification[key] = classifyStep(key, st);
  const skipped = Object.entries(opts).filter(([k, v]) => k.startsWith('skip') && v === true).map(([k]) => k);

  const report = {
    generated_at: new Date().toISOString(),
    task: 'P5-01a',
    plan_issue: 'accordproject/concerto-rust#29',
    task_issue: 'accordproject/concerto-rust#145',
    options: opts,
    skipped_steps: skipped,
    steps,
    classification,
  };
  fs.writeFileSync(path.join(reportDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');

  const lines = [];
  lines.push(`# Gate dry run — ${report.generated_at}`);
  lines.push('');
  lines.push('Dry run of migration/gate/run.mjs (task P5-01a). Not the final gate (P5-01). Each failing step is broken into failing items; an item is expected-pending only if it is in a known, owned set (migration/gate/classify.mjs), otherwise unexpected.');
  lines.push('');
  lines.push(`- skip flags used: ${skipped.length ? skipped.join(', ') : 'none (every step enabled)'}`);
  lines.push('');
  for (const [key, s] of Object.entries(steps)) {
    if (s == null) continue;
    const c = classification[key];
    lines.push(`## ${s.name || key}`);
    lines.push(`- verdict: ${verdictLabel(c)}`);
    if ('exit' in s) lines.push(`- exit code: ${s.exit}`);
    if ('log' in s) lines.push(`- log: ${s.log}`);
    // Unexpected items one per line; expected items grouped by known entry
    // (full per-item lists are in report.json's `classification`).
    for (const it of c.items.filter((i) => i.verdict !== 'expected-pending')) {
      lines.push(`  - ${it.verdict}: ${it.item}: ${it.reason}`);
    }
    const groups = new Map();
    for (const it of c.items.filter((i) => i.verdict === 'expected-pending')) {
      if (!groups.has(it.known_id)) groups.set(it.known_id, []);
      groups.get(it.known_id).push(it);
    }
    for (const [id, its] of groups) {
      const shown = its.length === 1 ? its[0].item : `${its.length} items (${id})`;
      lines.push(`  - expected-pending: ${shown} (owner: ${its[0].owner}): ${its[0].reason}`);
    }
    lines.push('');
  }
  fs.writeFileSync(path.join(reportDir, 'report.md'), lines.join('\n') + '\n');

  console.log(`gate/run.mjs: wrote ${path.join(reportDir, 'report.json')} and report.md`);
}

main().catch((e) => {
  console.error('gate/run.mjs: FATAL', e);
  process.exitCode = 1;
});
