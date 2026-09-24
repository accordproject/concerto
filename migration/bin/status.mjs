#!/usr/bin/env node
/**
 * migration/bin/status.mjs  (task P0-06)
 *
 * Gathers every plan §0 metric that is currently available and marks the
 * rest "n/a" with a reason (most producers - the oracle, the seam ledger,
 * the test-tag map, the Rust bindings - are being built by other tasks in
 * parallel, or land later in the plan). Writes migration/status/status.json
 * and appends one row to migration/telemetry/metrics.jsonl.
 *
 * Usage:
 *   node migration/bin/status.mjs [--at <sha>] [--fast]
 *
 *   --at <sha>  Collect concerto-core/nyc/queue/ledger/tags/oracle metrics
 *               from a temporary git worktree of the concerto repo checked
 *               out at <sha>, instead of the live working tree. The main
 *               checkout is never touched. The worktree's own node_modules
 *               is missing (git-ignored), so it is pointed at the live
 *               checkout's node_modules to avoid a slow reinstall; this
 *               means concerto-core's own source/tests are pinned to
 *               <sha>, but its workspace dependencies (concerto-util,
 *               concerto-cto, concerto-vocabulary) resolve to whatever the
 *               live checkout currently has built, not to their state at
 *               <sha>. The Rust repos and concerto-conformance are not
 *               worktree'd - they are read at whatever commit they are
 *               currently on.
 *   --fast      Skip the slow parts (Rust llvm-cov for both crates,
 *               concerto-conformance). Everything else still runs.
 *
 * See migration/PLAN.md §0 (done criteria), §4 P0-06 and §5.1
 * (instrumentation) for what this is for.
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const CONCERTO_ROOT = path.resolve(SCRIPT_DIR, '..', '..'); // /home/user/concerto
const RUST_ROOT = path.resolve(CONCERTO_ROOT, '..', 'concerto-rust');
const VALIDATE_RS_ROOT = path.resolve(CONCERTO_ROOT, '..', 'concerto-validate-rs');
const CONFORMANCE_ROOT = path.resolve(CONCERTO_ROOT, '..', 'concerto-conformance');

const STATUS_DIR = path.join(CONCERTO_ROOT, 'migration', 'status');
const STATUS_JSON = path.join(STATUS_DIR, 'status.json');
const TELEMETRY_DIR = path.join(CONCERTO_ROOT, 'migration', 'telemetry');
const METRICS_JSONL = path.join(TELEMETRY_DIR, 'metrics.jsonl');
const RUN_LOG_DIR = path.join(STATUS_DIR, 'logs');

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = { at: null, fast: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--at') {
      opts.at = argv[++i];
      if (!opts.at) throw new Error('--at requires a <sha> argument');
    } else if (a === '--fast') {
      opts.fast = true;
    } else if (a === '--help' || a === '-h') {
      opts.help = true;
    } else {
      throw new Error(`unrecognised argument: ${a}`);
    }
  }
  return opts;
}

// ---------------------------------------------------------------------------
// Small process helpers
// ---------------------------------------------------------------------------

function tryGitSha(repoPath) {
  try {
    return execFileSync('git', ['-C', repoPath, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

/** Runs a command, always returns (never throws); captures stdout+stderr. */
function run(cmd, args, { cwd, env, timeoutMs = 5 * 60 * 1000, logFile } = {}) {
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
      `$ ${cmd} ${args.join(' ')}\n(cwd: ${cwd || process.cwd()})\n\n--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}\n--- exit: ${res.status} signal: ${res.signal} timedOut: ${!!res.error && res.error.code === 'ETIMEDOUT'} ---\n`
    );
  }
  return {
    ok: res.status === 0 && !res.error,
    status: res.status,
    signal: res.signal,
    timedOut: !!(res.error && res.error.code === 'ETIMEDOUT'),
    error: res.error ? res.error.message : null,
    stdout,
    stderr,
  };
}

function na(reason) {
  return { available: false, reason };
}

// ---------------------------------------------------------------------------
// Queue state
// ---------------------------------------------------------------------------

function collectQueue(migrationDir) {
  const queuePath = path.join(migrationDir, 'queue.yaml');
  if (!fs.existsSync(queuePath)) return na(`${queuePath} does not exist`);
  try {
    const yaml = require('js-yaml');
    const doc = yaml.load(fs.readFileSync(queuePath, 'utf8'));
    const tasks = (doc && doc.tasks) || [];
    const counts = {};
    const by_priority = {};
    for (const t of tasks) {
      const st = t.status || 'unknown';
      counts[st] = (counts[st] || 0) + 1;
      const pri = t.priority || 'unknown';
      by_priority[pri] = by_priority[pri] || {};
      by_priority[pri][st] = (by_priority[pri][st] || 0) + 1;
    }
    return { available: true, total: tasks.length, counts, by_priority };
  } catch (e) {
    return na(`failed to parse queue.yaml: ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// Test tags (B/W/M), from migration/tags/test-tags.tsv (task P0-02)
// ---------------------------------------------------------------------------

function collectTagMap(migrationDir) {
  const tagsPath = path.join(migrationDir, 'tags', 'test-tags.tsv');
  if (!fs.existsSync(tagsPath)) {
    return { available: false, reason: `${tagsPath} does not exist yet (P0-02 not finished)`, map: null };
  }
  try {
    const lines = fs.readFileSync(tagsPath, 'utf8').split('\n').filter(Boolean);
    const header = lines[0].split('\t');
    const idx = Object.fromEntries(header.map((h, i) => [h, i]));
    const map = new Map();
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split('\t');
      const file = cols[idx.file];
      const title = cols[idx.test_title];
      const tag = cols[idx.tag];
      if (!title || !tag) continue;
      // Keyed primarily by the full test title (matches mocha's fullTitle);
      // also keep a file-qualified key in case two files share a title.
      map.set(title, tag);
      map.set(`${file}::${title}`, tag);
    }
    return { available: true, map };
  } catch (e) {
    return { available: false, reason: `failed to parse test-tags.tsv: ${e.message}`, map: null };
  }
}

// ---------------------------------------------------------------------------
// Seam ledger (RUST/HYBRID/TS + weight), from migration/ledger/SEAM_LEDGER.tsv
// ---------------------------------------------------------------------------

function collectLedger(migrationDir) {
  const ledgerPath = path.join(migrationDir, 'ledger', 'SEAM_LEDGER.tsv');
  if (!fs.existsSync(ledgerPath)) {
    return na(`${ledgerPath} does not exist yet (P0-03 not finished)`);
  }
  try {
    const lines = fs.readFileSync(ledgerPath, 'utf8').split('\n').filter(Boolean);
    const header = lines[0].split('\t');
    const idx = Object.fromEntries(header.map((h, i) => [h, i]));
    const weights = { RUST: 0, HYBRID: 0, TS: 0 };
    let total = 0;
    let rows = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split('\t');
      const cls = cols[idx.classification];
      const w = parseFloat(cols[idx.weight]);
      if (!cls || Number.isNaN(w)) continue;
      weights[cls] = (weights[cls] || 0) + w;
      total += w;
      rows++;
    }
    const rustPlusHybrid = (weights.RUST || 0) + (weights.HYBRID || 0);
    return {
      available: true,
      rows,
      total_weight: round2(total),
      weight_by_classification: {
        RUST: round2(weights.RUST || 0),
        HYBRID: round2(weights.HYBRID || 0),
        TS: round2(weights.TS || 0),
      },
      weighted_pct_rust_plus_hybrid: total > 0 ? round2((rustPlusHybrid / total) * 100) : null,
    };
  } catch (e) {
    return na(`failed to parse SEAM_LEDGER.tsv: ${e.message}`);
  }
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// concerto-core: build (if needed), run the suite under nyc, split by tag
// ---------------------------------------------------------------------------

function ensureCoreBuilt(concertoRoot, logDir) {
  const pkgs = ['concerto-util', 'concerto-cto', 'concerto-core', 'concerto-vocabulary'];
  const built = [];
  for (const pkg of pkgs) {
    const distDir = path.join(concertoRoot, 'packages', pkg, 'dist');
    if (fs.existsSync(distDir) && fs.readdirSync(distDir).length > 0) continue;
    const res = run('npm', ['run', 'build', '-w', `packages/${pkg}`], {
      cwd: concertoRoot,
      timeoutMs: 5 * 60 * 1000,
      logFile: path.join(logDir, `build-${pkg}.log`),
    });
    built.push({ pkg, ok: res.ok });
    if (!res.ok) {
      return { ok: false, reason: `build of packages/${pkg} failed (see log build-${pkg}.log)`, built };
    }
  }
  return { ok: true, built };
}

function collectCoreTests(concertoRoot, migrationDir, logDir, tagInfo) {
  const coreDir = path.join(concertoRoot, 'packages', 'concerto-core');
  if (!fs.existsSync(coreDir)) {
    return { overall: na('packages/concerto-core does not exist at this revision') };
  }

  // node_modules is git-ignored; a worktree checkout of the concerto repo
  // won't have any. Point them at the live checkout's own node_modules
  // (see the --at caveat in the file header) rather than reinstalling: the
  // root one, plus any workspace package's own nested one (npm hoists a
  // package into its own node_modules/ when versions conflict, e.g.
  // concerto-cto's copy of concerto-metamodel).
  if (concertoRoot !== CONCERTO_ROOT) {
    const candidateDirs = [
      concertoRoot,
      ...fs.existsSync(path.join(concertoRoot, 'packages'))
        ? fs.readdirSync(path.join(concertoRoot, 'packages')).map((p) => path.join(concertoRoot, 'packages', p))
        : [],
    ];
    for (const dir of candidateDirs) {
      const liveDir = dir.replace(concertoRoot, CONCERTO_ROOT);
      const liveNodeModules = path.join(liveDir, 'node_modules');
      const wtNodeModules = path.join(dir, 'node_modules');
      if (!fs.existsSync(liveNodeModules) || fs.existsSync(wtNodeModules)) continue;
      try {
        fs.mkdirSync(dir, { recursive: true });
        fs.symlinkSync(liveNodeModules, wtNodeModules, 'dir');
      } catch (e) {
        return { overall: na(`could not link node_modules for ${dir}: ${e.message}`) };
      }
    }
  }

  const buildResult = ensureCoreBuilt(concertoRoot, logDir);
  if (!buildResult.ok) {
    return { overall: na(buildResult.reason) };
  }

  const nycTempDir = path.join(logDir, 'nyc-tmp');
  const nycReportDir = path.join(logDir, 'nyc-report');
  fs.rmSync(nycTempDir, { recursive: true, force: true });
  fs.rmSync(nycReportDir, { recursive: true, force: true });
  const rawOutputPath = path.join(logDir, 'core-suite-raw-stdout.log');

  const args = [
    'nyc',
    '--temp-dir', nycTempDir,
    '--report-dir', nycReportDir,
    '--reporter', 'json-summary',
    '--reporter', 'text-summary',
    'mocha',
    '-r', 'ts-node/register',
    '--recursive',
    '-t', '10000',
    '--reporter', 'json',
    'test/',
  ];
  const res = run('npx', args, {
    cwd: coreDir,
    env: { TS_NODE_PROJECT: 'tsconfig.build.json', TZ: 'UTC', CONCERTO_ENGINE: 'ts' },
    timeoutMs: 8 * 60 * 1000,
    logFile: path.join(logDir, 'core-suite-stderr.log'),
  });
  fs.writeFileSync(rawOutputPath, res.stdout);

  let mocha;
  try {
    // Some tests log to stdout (e.g. API-snapshot validation "info:" lines)
    // ahead of mocha's own JSON reporter output, and nyc's own
    // `text-summary` reporter appends a plain-text coverage box after it.
    // Find the JSON object's start and its matching closing brace.
    const jsonStart = res.stdout.search(/\{\s*\n\s*"stats"/);
    if (jsonStart === -1) throw new Error('no JSON object found in stdout');
    // Brace-count while string-aware, so braces inside test titles/messages
    // (e.g. `it('foo {bar}')`) don't throw off the depth count.
    let depth = 0;
    let jsonEnd = -1;
    let inString = false;
    let escaped = false;
    for (let i = jsonStart; i < res.stdout.length; i++) {
      const ch = res.stdout[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') { inString = true; continue; }
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) { jsonEnd = i + 1; break; }
      }
    }
    if (jsonEnd === -1) throw new Error('unbalanced JSON object in stdout');
    mocha = JSON.parse(res.stdout.slice(jsonStart, jsonEnd));
    fs.writeFileSync(path.join(logDir, 'mocha-results.json'), JSON.stringify(mocha, null, 2));
  } catch (e) {
    return {
      overall: na(
        `could not parse mocha JSON reporter output (exit ${res.status}, timedOut=${res.timedOut}): ${e.message}; see core-suite-raw-stdout.log`
      ),
    };
  }

  const overall = {
    available: true,
    engine: 'ts',
    suites: mocha.stats.suites,
    tests: mocha.stats.tests,
    passing: mocha.stats.passes,
    failing: mocha.stats.failures,
    pending: mocha.stats.pending,
    duration_ms: mocha.stats.duration,
  };

  // Split by B/W/M tag, if the tag map is available.
  let by_tag = na(tagInfo.reason || 'tag map unavailable');
  if (tagInfo.available) {
    const failedTitles = new Set((mocha.failures || []).map((t) => t.fullTitle));
    const pendingTitles = new Set((mocha.pending || []).map((t) => t.fullTitle));
    const tally = {};
    const bump = (tag, key) => {
      tally[tag] = tally[tag] || { tests: 0, passing: 0, failing: 0, pending: 0 };
      tally[tag].tests++;
      tally[tag][key]++;
    };
    for (const t of mocha.tests || []) {
      const relFile = t.file ? path.relative(path.join(coreDir, 'test'), t.file) : null;
      const tag =
        (relFile && tagInfo.map.get(`${relFile}::${t.fullTitle}`)) ||
        tagInfo.map.get(t.fullTitle) ||
        'untagged';
      const key = failedTitles.has(t.fullTitle) ? 'failing' : pendingTitles.has(t.fullTitle) ? 'pending' : 'passing';
      bump(tag, key);
    }
    by_tag = { available: true, tally };
  }

  const engine_modes = {
    ts: overall,
    rust: na('CONCERTO_ENGINE=rust is not implemented yet (P4-02, engine shim, has not landed)'),
  };

  return { overall, by_tag, engine_modes, nycReportDir };
}

function collectNycCoverage(coreDir, nycReportDir) {
  if (!nycReportDir) return na('the concerto-core suite did not run, so no coverage was produced');
  const summaryPath = path.join(nycReportDir, 'coverage-summary.json');
  if (!fs.existsSync(summaryPath)) return na(`${summaryPath} was not produced`);
  let thresholds = null;
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(coreDir, 'package.json'), 'utf8'));
    thresholds = pkg.nyc && {
      statements: pkg.nyc.statements,
      branches: pkg.nyc.branches,
      functions: pkg.nyc.functions,
      lines: pkg.nyc.lines,
    };
  } catch { /* leave thresholds null */ }
  try {
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8')).total;
    const result = {
      available: true,
      statements_pct: summary.statements.pct,
      branches_pct: summary.branches.pct,
      functions_pct: summary.functions.pct,
      lines_pct: summary.lines.pct,
      thresholds,
    };
    if (thresholds) {
      const misses = [];
      for (const k of ['statements', 'branches', 'functions', 'lines']) {
        if (thresholds[k] != null && result[`${k}_pct`] < thresholds[k]) misses.push(k);
      }
      result.gate_status = misses.length === 0 ? 'PASS' : `FAILS: ${misses.join(', ')} below threshold`;
    }
    return result;
  } catch (e) {
    return na(`failed to parse coverage-summary.json: ${e.message}`);
  }
}

// ---------------------------------------------------------------------------
// Oracle (task P0-05): pass % per engine, corpus coverage of the reference
// ---------------------------------------------------------------------------

function collectOracle(migrationDir, rustRoot) {
  const oracleDir = path.join(migrationDir, 'oracle');
  const corpusDir = path.join(oracleDir, 'corpus');
  const coverageReport = path.join(oracleDir, 'coverage-report.json');
  const resultsFile = path.join(oracleDir, 'results.json');

  const reason = fs.existsSync(oracleDir)
    ? 'the oracle recorder has not produced a corpus/results file yet (P0-05 in progress - only lib/ and reference/ exist so far)'
    : 'migration/oracle/ does not exist yet (P0-05 not started)';

  const out = {
    native: na(reason),
    wasm: na(fs.existsSync(path.join(rustRoot, 'concerto-wasm'))
      ? reason
      : 'no WASM binding crate exists yet (P4-01 has not landed)'),
    corpus_coverage_of_reference: na(reason),
  };

  if (fs.existsSync(resultsFile)) {
    try {
      const results = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
      if (results.native) out.native = { available: true, ...results.native };
      if (results.wasm) out.wasm = { available: true, ...results.wasm };
    } catch (e) {
      out.native = na(`failed to parse oracle results.json: ${e.message}`);
    }
  }
  if (fs.existsSync(coverageReport)) {
    try {
      const cov = JSON.parse(fs.readFileSync(coverageReport, 'utf8'));
      out.corpus_coverage_of_reference = { available: true, ...cov };
    } catch (e) {
      out.corpus_coverage_of_reference = na(`failed to parse oracle coverage-report.json: ${e.message}`);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Rust: cargo test (+ optional llvm-cov) per crate
// ---------------------------------------------------------------------------

function parseCargoTestOutput(stdout, stderr) {
  // cargo prints "Running unittests ... (target/debug/deps/<crate>-<hash>)"
  // and "Doc-tests <crate>" status lines to stderr, one per test binary, in
  // the order it runs them; each corresponding harness prints its own
  // "test result: ok. N passed; M failed; ..." line to stdout. The two
  // streams are captured separately and interleave unpredictably once
  // concatenated, but each stream's own internal order is preserved, so
  // the Nth status line and the Nth result line refer to the same binary.
  const crateOrder = [];
  const runningRe = /Running .*[\\/]deps[\\/]([a-zA-Z0-9_]+)-[0-9a-f]+\)/;
  const doctestRe = /^\s*Doc-tests ([a-zA-Z0-9_-]+)/;
  for (const line of stderr.split('\n')) {
    const rm = line.match(runningRe);
    if (rm) { crateOrder.push(rm[1]); continue; }
    const dm = line.match(doctestRe);
    if (dm) { crateOrder.push(dm[1].replace(/-/g, '_')); continue; }
  }

  const results = [];
  const resultRe = /^test result: \w+\. (\d+) passed; (\d+) failed;/;
  for (const line of stdout.split('\n')) {
    const tm = line.match(resultRe);
    if (tm) results.push({ passed: parseInt(tm[1], 10), failed: parseInt(tm[2], 10) });
  }

  const perCrate = {};
  for (let i = 0; i < results.length; i++) {
    const crate = crateOrder[i] || `unknown_${i}`;
    const c = (perCrate[crate] = perCrate[crate] || { passed: 0, failed: 0 });
    c.passed += results[i].passed;
    c.failed += results[i].failed;
  }
  const totals = Object.values(perCrate).reduce(
    (acc, c) => ({ passed: acc.passed + c.passed, failed: acc.failed + c.failed }),
    { passed: 0, failed: 0 }
  );
  return { perCrate, totals };
}

function parseLlvmCovSummary(stdout) {
  const lines = stdout.split('\n');
  const headerIdx = lines.findIndex((l) => l.trim().startsWith('Filename'));
  if (headerIdx === -1) return null;
  const files = [];
  let total = null;
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (line.trim().startsWith('---')) continue;
    const tokens = line.trim().split(/\s+/);
    if (tokens.length < 13) continue;
    const numeric = tokens.slice(-12);
    const filename = tokens.slice(0, tokens.length - 12).join(' ');
    const row = {
      filename,
      lines_pct: parseFloat(numeric[8]),
      lines_total: parseInt(numeric[6], 10),
      lines_missed: parseInt(numeric[7], 10),
      functions_pct: parseFloat(numeric[5]),
      regions_pct: parseFloat(numeric[2]),
    };
    if (filename === 'TOTAL') {
      total = row;
      break; // the summary table ends here; anything after is re-run test output
    } else {
      files.push(row);
    }
  }
  return { files, total };
}

function perCrateLineCoverage(files) {
  const byCrate = {};
  for (const f of files) {
    const crate = f.filename.split('/')[0];
    const c = (byCrate[crate] = byCrate[crate] || { lines_total: 0, lines_missed: 0 });
    if (Number.isFinite(f.lines_total)) c.lines_total += f.lines_total;
    if (Number.isFinite(f.lines_missed)) c.lines_missed += f.lines_missed;
  }
  for (const crate of Object.keys(byCrate)) {
    const c = byCrate[crate];
    c.lines_pct = c.lines_total > 0 ? round2(((c.lines_total - c.lines_missed) / c.lines_total) * 100) : null;
  }
  return byCrate;
}

function collectRustRepo(repoPath, logDir, { fast, restoreFile } = {}) {
  if (!fs.existsSync(repoPath)) return { cargo_test: na(`${repoPath} does not exist`), llvm_cov: na('n/a') };
  const testRes = run('cargo', ['test', '--workspace'], {
    cwd: repoPath,
    timeoutMs: 5 * 60 * 1000,
    logFile: path.join(logDir, 'cargo-test.log'),
  });
  if (restoreFile) restoreTrackedFile(repoPath, restoreFile);

  let cargo_test;
  if (!testRes.ok && testRes.timedOut) {
    cargo_test = na('cargo test timed out');
  } else {
    const parsed = parseCargoTestOutput(testRes.stdout, testRes.stderr);
    cargo_test = {
      available: true,
      command_exit_ok: testRes.ok,
      totals: parsed.totals,
      per_crate: parsed.perCrate,
    };
  }

  let llvm_cov;
  if (fast) {
    llvm_cov = na('skipped by --fast');
  } else {
    const covRes = run('cargo', ['llvm-cov', '--workspace', '--summary-only'], {
      cwd: repoPath,
      timeoutMs: 6 * 60 * 1000,
      logFile: path.join(logDir, 'llvm-cov.log'),
    });
    if (restoreFile) restoreTrackedFile(repoPath, restoreFile);
    if (covRes.timedOut) {
      llvm_cov = na('cargo llvm-cov timed out');
    } else {
      const parsed = parseLlvmCovSummary(covRes.stdout + '\n' + covRes.stderr);
      if (!parsed || !parsed.total) {
        llvm_cov = na(`could not parse cargo llvm-cov output (exit ${covRes.status}); see llvm-cov.log`);
      } else {
        llvm_cov = {
          available: true,
          workspace_lines_pct: parsed.total.lines_pct,
          per_crate_lines_pct: Object.fromEntries(
            Object.entries(perCrateLineCoverage(parsed.files)).map(([k, v]) => [k, v.lines_pct])
          ),
        };
      }
    }
  }

  return { cargo_test, llvm_cov };
}

function restoreTrackedFile(repoPath, relFile) {
  try {
    execFileSync('git', ['-C', repoPath, 'checkout', '--', relFile], { stdio: 'ignore' });
  } catch {
    // best effort; note it but don't fail the whole run over it
  }
}

// ---------------------------------------------------------------------------
// concerto-conformance: scenario pass count
// ---------------------------------------------------------------------------

function collectConformance(repoPath, logDir, fast) {
  if (!fs.existsSync(repoPath)) return na(`${repoPath} does not exist`);
  if (fast) return na('skipped by --fast');
  const nodeModules = path.join(repoPath, 'node_modules');
  if (!fs.existsSync(nodeModules)) {
    return na(
      'concerto-conformance has no installed dependencies (npm install has not been run) and its Rust harness ' +
        'has not been updated to the current concerto-rust API yet (P0-07 pending)'
    );
  }
  const res = run('npm', ['run', 'test:semantic'], {
    cwd: repoPath,
    timeoutMs: 4 * 60 * 1000,
    logFile: path.join(logDir, 'conformance.log'),
  });
  const text = res.stdout + '\n' + res.stderr;
  const m = text.match(/(\d+) scenarios?(?: \(([^)]*)\))?/);
  if (!m) {
    return na(`could not parse conformance scenario summary (exit ${res.status}); see conformance.log`);
  }
  const passedMatch = (m[2] || '').match(/(\d+) passed/);
  const failedMatch = (m[2] || '').match(/(\d+) failed/);
  return {
    available: true,
    total_scenarios: parseInt(m[1], 10),
    passed: passedMatch ? parseInt(passedMatch[1], 10) : null,
    failed: failedMatch ? parseInt(failedMatch[1], 10) : 0,
  };
}

// ---------------------------------------------------------------------------
// Worktree management for --at <sha>
// ---------------------------------------------------------------------------

function makeWorktree(sha) {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'concerto-status-worktree-'));
  const wtPath = path.join(tmpBase, 'wt');
  execFileSync('git', ['-C', CONCERTO_ROOT, 'worktree', 'add', '--detach', wtPath, sha], { stdio: 'pipe' });
  return wtPath;
}

function removeWorktree(wtPath) {
  // Remove the node_modules symlinks we planted (root + each workspace
  // package) first, so `git worktree remove` doesn't try to walk into them.
  const candidates = [wtPath];
  const packagesDir = path.join(wtPath, 'packages');
  if (fs.existsSync(packagesDir)) {
    for (const p of fs.readdirSync(packagesDir)) candidates.push(path.join(packagesDir, p));
  }
  for (const dir of candidates) {
    const nm = path.join(dir, 'node_modules');
    try {
      if (fs.lstatSync(nm).isSymbolicLink()) fs.unlinkSync(nm);
    } catch { /* not present / not a symlink */ }
  }
  try {
    execFileSync('git', ['-C', CONCERTO_ROOT, 'worktree', 'remove', '--force', wtPath], { stdio: 'pipe' });
  } catch {
    try { fs.rmSync(wtPath, { recursive: true, force: true }); } catch { /* ignore */ }
  }
  try {
    fs.rmSync(path.dirname(wtPath), { recursive: true, force: true });
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const t0 = Date.now();
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log('Usage: status.mjs [--at <sha>] [--fast]');
    return;
  }

  fs.mkdirSync(STATUS_DIR, { recursive: true });
  fs.mkdirSync(TELEMETRY_DIR, { recursive: true });
  fs.rmSync(RUN_LOG_DIR, { recursive: true, force: true });
  fs.mkdirSync(RUN_LOG_DIR, { recursive: true });

  let worktreePath = null;
  let dataRoot = CONCERTO_ROOT; // where we read packages/ and migration/ from
  let concertoShaUsed = tryGitSha(CONCERTO_ROOT);

  try {
    if (opts.at) {
      worktreePath = makeWorktree(opts.at);
      dataRoot = worktreePath;
      concertoShaUsed = tryGitSha(worktreePath);
    }

    const migrationDir = path.join(dataRoot, 'migration');
    const coreDir = path.join(dataRoot, 'packages', 'concerto-core');

    const queue = collectQueue(migrationDir);
    const tagInfo = collectTagMap(migrationDir);
    const ledger = collectLedger(migrationDir);

    const coreLogDir = path.join(RUN_LOG_DIR, 'concerto-core');
    const coreTests = collectCoreTests(dataRoot, migrationDir, coreLogDir, tagInfo);
    const nycCoverage = collectNycCoverage(coreDir, coreTests.nycReportDir);

    const oracle = collectOracle(migrationDir, RUST_ROOT);

    const rustLogDir = path.join(RUN_LOG_DIR, 'concerto-rust');
    const validateRsLogDir = path.join(RUN_LOG_DIR, 'concerto-validate-rs');
    const concertoRust = collectRustRepo(RUST_ROOT, rustLogDir, { fast: opts.fast });
    const validateRs = collectRustRepo(VALIDATE_RS_ROOT, validateRsLogDir, {
      fast: opts.fast,
      restoreFile: 'metamodel.json',
    });

    const conformanceLogDir = path.join(RUN_LOG_DIR, 'concerto-conformance');
    const conformance = collectConformance(CONFORMANCE_ROOT, conformanceLogDir, opts.fast);

    const mutants = na(
      'cargo-mutants has not been run in this environment; the ledger/judge self-check is task P0-05, ' +
        'and the ≥85% catch-rate gate is task P5-06'
    );

    const repos = {
      concerto: { path: CONCERTO_ROOT, commit: tryGitSha(CONCERTO_ROOT), commit_used: concertoShaUsed },
      'concerto-rust': { path: RUST_ROOT, commit: tryGitSha(RUST_ROOT) },
      'concerto-validate-rs': { path: VALIDATE_RS_ROOT, commit: tryGitSha(VALIDATE_RS_ROOT) },
      'concerto-conformance': { path: CONFORMANCE_ROOT, commit: tryGitSha(CONFORMANCE_ROOT) },
    };

    const runtimeMs = Date.now() - t0;

    const status = {
      $schema: 'migration/status/status.json',
      generated_at: new Date().toISOString(),
      requested_at_sha: opts.at || null,
      fast: opts.fast,
      runtime_ms: runtimeMs,
      repos,
      metrics: {
        queue,
        concerto_core_tests: {
          overall: coreTests.overall,
          by_tag: coreTests.by_tag,
          engine_modes: coreTests.engine_modes,
        },
        nyc_coverage: nycCoverage,
        oracle,
        rust: {
          'concerto-rust': concertoRust,
          'concerto-validate-rs': validateRs,
        },
        ledger,
        mutants,
        conformance,
      },
    };

    fs.writeFileSync(STATUS_JSON, JSON.stringify(status, null, 2) + '\n');

    const telemetryRow = {
      timestamp: status.generated_at,
      commits: {
        concerto: repos.concerto.commit_used,
        'concerto-rust': repos['concerto-rust'].commit,
        'concerto-validate-rs': repos['concerto-validate-rs'].commit,
        'concerto-conformance': repos['concerto-conformance'].commit,
      },
      requested_at_sha: opts.at || null,
      fast: opts.fast,
      runtime_ms: runtimeMs,
      metrics: status.metrics,
    };
    fs.appendFileSync(METRICS_JSONL, JSON.stringify(telemetryRow) + '\n');

    console.log(`status.mjs: wrote ${STATUS_JSON} and appended a row to ${METRICS_JSONL} (${runtimeMs}ms)`);
    if (runtimeMs > 10 * 60 * 1000) {
      console.error(`status.mjs: WARNING - runtime ${runtimeMs}ms exceeded the 10 minute budget`);
    }
  } finally {
    if (worktreePath) removeWorktree(worktreePath);
  }
}

main().catch((e) => {
  console.error('status.mjs: FATAL', e);
  process.exitCode = 1;
});
