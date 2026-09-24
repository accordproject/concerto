#!/usr/bin/env node
// migration/telemetry/record-run.mjs
//
// Ingests a mocha JSON-reporter file and/or a JUnit XML file (as produced
// by cargo-nextest) into migration/telemetry/runs/<task>/<attempt>/, as a
// normalised result.json: one record per test, with a failure signature
// (sha1 of the test's full title + its first error line) for every
// failing test, so repeats and regressions are detectable by machine
// (plan §5.1).
//
// Usage:
//   node record-run.mjs --task ID --attempt N
//        [--mocha-json PATH] [--junit-xml PATH] [--label TEXT]
//        [--runs-dir PATH] [--dry-run]
//
// At least one of --mocha-json/--junit-xml must be given. Both may be
// given (e.g. a TS mocha run and a Rust cargo-nextest run for the same
// attempt); their tests are concatenated into one result.json with a
// `suite` field ("mocha" | "junit") per test.
//
// Output: <runs-dir>/<task>/<attempt>/result.json:
//   {
//     task, attempt, label, recordedAt,
//     summary: { total, passed, failed, pending },
//     tests: [
//       { suite, fullTitle, title, status: "pass"|"fail"|"pending",
//         errorMessage, signature (only when status === "fail"),
//         durationMs }
//       ...
//     ]
//   }
// A copy of each raw input is also saved alongside (mocha.json /
// junit.xml) so the original report is never lost.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, failureSignature, RUNS_DIR } from './lib.mjs';

function readJsonFile(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/** Normalise a mocha JSON-reporter document into our test record shape. */
function parseMochaJson(doc) {
  const tests = [];
  const failedTitles = new Set();

  for (const f of doc.failures || []) {
    failedTitles.add(f.fullTitle || f.title);
    tests.push({
      suite: 'mocha',
      fullTitle: f.fullTitle || f.title,
      title: f.title,
      status: 'fail',
      errorMessage: (f.err && (f.err.message || f.err.stack)) || '',
      durationMs: typeof f.duration === 'number' ? f.duration : null,
    });
  }
  for (const p of doc.passes || []) {
    tests.push({
      suite: 'mocha',
      fullTitle: p.fullTitle || p.title,
      title: p.title,
      status: 'pass',
      durationMs: typeof p.duration === 'number' ? p.duration : null,
    });
  }
  for (const pd of doc.pending || []) {
    tests.push({
      suite: 'mocha',
      fullTitle: pd.fullTitle || pd.title,
      title: pd.title,
      status: 'pending',
      durationMs: null,
    });
  }

  // Some mocha configurations only populate `tests` (all of them, each
  // carrying its own `err` when failed) rather than the passes/failures/
  // pending split above. Fold those in too, de-duplicating by fullTitle
  // against what we already collected.
  const seen = new Set(tests.map((t) => t.fullTitle));
  for (const t of doc.tests || []) {
    const fullTitle = t.fullTitle || t.title;
    if (seen.has(fullTitle)) continue;
    seen.add(fullTitle);
    const hasErr = t.err && Object.keys(t.err).length > 0;
    tests.push({
      suite: 'mocha',
      fullTitle,
      title: t.title,
      status: hasErr ? 'fail' : t.pending ? 'pending' : 'pass',
      errorMessage: hasErr ? t.err.message || t.err.stack || '' : undefined,
      durationMs: typeof t.duration === 'number' ? t.duration : null,
    });
  }

  return tests;
}

/** Minimal JUnit XML parser, tolerant of cargo-nextest's dialect.
 *  Deliberately not a full XML parser: it regex-scans <testcase ...>
 *  elements (self-closed, or wrapping a <failure>/<error>), which is
 *  what cargo-nextest emits. Good enough for this pipeline; if a future
 *  nextest version changes the schema, widen these patterns rather than
 *  reaching for a full XML dependency. */
function parseJunitXml(xml) {
  const tests = [];
  const testcaseRe = /<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g;
  let m;
  while ((m = testcaseRe.exec(xml))) {
    const attrs = parseAttrs(m[1]);
    const inner = m[3] || '';
    const name = attrs.name || 'unknown';
    const classname = attrs.classname || '';
    const fullTitle = classname ? `${classname}::${name}` : name;
    const durationMs =
      attrs.time !== undefined ? Math.round(parseFloat(attrs.time) * 1000) : null;

    const failMatch = /<failure\b([^>]*)(?:\/>|>([\s\S]*?)<\/failure>)/.exec(inner);
    const errMatch = /<error\b([^>]*)(?:\/>|>([\s\S]*?)<\/error>)/.exec(inner);
    const skipped = /<skipped\b/.test(inner);

    if (failMatch || errMatch) {
      const which = failMatch || errMatch;
      const failAttrs = parseAttrs(which[1]);
      const errorMessage = decodeXml(
        failAttrs.message || (which[2] || '').trim() || 'test failed'
      );
      tests.push({
        suite: 'junit',
        fullTitle,
        title: name,
        status: 'fail',
        errorMessage,
        durationMs,
      });
    } else if (skipped) {
      tests.push({ suite: 'junit', fullTitle, title: name, status: 'pending', durationMs });
    } else {
      tests.push({ suite: 'junit', fullTitle, title: name, status: 'pass', durationMs });
    }
  }
  return tests;
}

function parseAttrs(attrString) {
  const attrs = {};
  const attrRe = /([\w:-]+)\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = attrRe.exec(attrString))) {
    attrs[m[1]] = decodeXml(m[2]);
  }
  return attrs;
}

function decodeXml(s) {
  return String(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function withSignatures(tests) {
  return tests.map((t) => {
    if (t.status !== 'fail') return t;
    return { ...t, signature: failureSignature(t.fullTitle, t.errorMessage) };
  });
}

function main() {
  const args = parseArgs(process.argv.slice(2), {
    flags: ['task', 'attempt', 'mocha-json', 'junit-xml', 'label', 'runs-dir'],
    booleans: ['dry-run'],
  });

  if (!args.task || !args.attempt) {
    process.stderr.write(
      'usage: record-run.mjs --task ID --attempt N [--mocha-json PATH] [--junit-xml PATH] ' +
        '[--label TEXT] [--runs-dir PATH] [--dry-run]\n'
    );
    process.exit(1);
  }
  if (!args['mocha-json'] && !args['junit-xml']) {
    process.stderr.write('record-run: need at least one of --mocha-json or --junit-xml\n');
    process.exit(1);
  }

  let tests = [];
  const rawFiles = {};

  if (args['mocha-json']) {
    const doc = readJsonFile(args['mocha-json']);
    tests = tests.concat(parseMochaJson(doc));
    rawFiles.mocha = fs.readFileSync(args['mocha-json'], 'utf8');
  }
  if (args['junit-xml']) {
    const xml = fs.readFileSync(args['junit-xml'], 'utf8');
    tests = tests.concat(parseJunitXml(xml));
    rawFiles.junit = xml;
  }

  tests = withSignatures(tests);

  const summary = {
    total: tests.length,
    passed: tests.filter((t) => t.status === 'pass').length,
    failed: tests.filter((t) => t.status === 'fail').length,
    pending: tests.filter((t) => t.status === 'pending').length,
  };

  const record = {
    task: args.task,
    attempt: Number.parseInt(args.attempt, 10),
    label: args.label || null,
    recordedAt: new Date().toISOString(),
    summary,
    tests,
  };

  if (args['dry-run']) {
    process.stdout.write(JSON.stringify(record, null, 2) + '\n');
    return;
  }

  const runsDir = args['runs-dir'] ? path.resolve(args['runs-dir']) : RUNS_DIR;
  const dir = path.join(runsDir, args.task, String(record.attempt));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify(record, null, 2) + '\n', 'utf8');
  if (rawFiles.mocha) fs.writeFileSync(path.join(dir, 'mocha.json'), rawFiles.mocha, 'utf8');
  if (rawFiles.junit) fs.writeFileSync(path.join(dir, 'junit.xml'), rawFiles.junit, 'utf8');

  process.stderr.write(
    `record-run: wrote ${path.join(dir, 'result.json')} ` +
      `(${summary.total} tests: ${summary.passed} passed, ${summary.failed} failed, ${summary.pending} pending)\n`
  );
}

main();
