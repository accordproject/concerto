#!/usr/bin/env node
/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

/**
 * Compare corpus-only coverage of the reference with the unit suite's and
 * list every branch the corpus does not reach (plan §2.4).
 *
 *   node bin/coverage-gaps.js --corpus <coverage-final.json> --corpus-summary <coverage-summary.json>
 *       [--corpus-src <coverage-final.json> --corpus-src-summary <coverage-summary.json>]
 *       [--suite <coverage-final.json> --suite-summary <coverage-summary.json>]
 *       [--reasons <gap-reasons.json>]
 *
 * --corpus is the corpus replayed against the frozen reference (its dist/
 * remapped through its source maps to src/*.ts); --corpus-src the same corpus
 * replayed against the workspace src/. Files are matched on their path below
 * `concerto-core/`, so the two and the unit suite's run line up branch by
 * branch. The gap list is taken from --corpus; any branch on which the two
 * corpus runs disagree is reported.
 *
 * gap-reasons.json (committed, default migration/oracle/gap-reasons.json)
 * holds the verified reason for every uncovered branch the unit suite does
 * reach, keyed "<file>:<line>:<branch>". It is merged into the gap list, so
 * regenerating coverage-gaps.json keeps them; a reason whose branch is now
 * covered is reported as stale, and a suite-covered gap without a reason is
 * reported as unexplained.
 *
 * Writes migration/oracle/coverage-gaps.json and migration/oracle/results/coverage.json.
 */

const fs = require('fs');
const path = require('path');

const ORACLE_DIR = path.resolve(__dirname, '..');
const MIGRATION_DIR = path.resolve(ORACLE_DIR, '..');
const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
    args[process.argv[i].replace(/^--/, '')] = path.resolve(process.argv[i + 1]);
}
const load = (f) => (f ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);
const corpus = load(args.corpus);
const corpusSummary = load(args['corpus-summary']);
const corpusSrc = load(args['corpus-src']);
const corpusSrcSummary = load(args['corpus-src-summary']);
const suite = load(args.suite);
const suiteSummary = load(args['suite-summary']);
const reasonsFile = args.reasons || path.join(ORACLE_DIR, 'gap-reasons.json');
const reasonsDoc = fs.existsSync(reasonsFile) ? load(reasonsFile) : { reasons: {} };
const reasons = reasonsDoc.reasons || {};
const baseline = load(path.join(MIGRATION_DIR, 'baseline.json'));

// packages/concerto-core/src/x.ts and
// reference/node_modules/@accordproject/concerto-core/src/x.ts both -> src/x.ts
const relFile = (f) => f.replace(/^.*\/concerto-core\//, '');
const pick = (s) => {
    if (!s) {
        return null;
    }
    const t = s.total;
    const one = (k) => ({ pct: t[k].pct, covered: t[k].covered, total: t[k].total });
    return { statements: one('statements'), branches: one('branches'), functions: one('functions'), lines: one('lines') };
};
const byFile = (cov) => {
    const out = {};
    for (const [f, c] of Object.entries(cov || {})) {
        out[relFile(f)] = c;
    }
    return out;
};
const suiteByFile = byFile(suite);
const srcByFile = byFile(corpusSrc);
const locKey = (l) => (l && l.start ? `${l.start.line}:${l.start.column}-${l.end.line}:${l.end.column}` : '');

const gaps = [];
const perFile = {};
const disagreements = [];
const layoutMismatches = [];
for (const [f, cov] of Object.entries(corpus)) {
    const file = relFile(f);
    const sc = suiteByFile[file];
    const cs = srcByFile[file];
    let uncovered = 0;
    for (const [id, br] of Object.entries(cov.branchMap)) {
        const counts = cov.b[id];
        for (const other of [sc, cs]) {
            if (other && (!other.branchMap[id] || locKey(other.branchMap[id].loc) !== locKey(br.loc))) {
                layoutMismatches.push(`${file}:${id}`);
            }
        }
        counts.forEach((n, i) => {
            if (cs && cs.b[id] && (cs.b[id][i] > 0) !== (n > 0)) {
                disagreements.push({ file, branch: `${id}[${i}]`, reference: n, src: cs.b[id][i] });
            }
            if (n > 0) {
                return;
            }
            uncovered++;
            const loc = br.locations[i] || br.loc;
            const entry = {
                file,
                line: (loc && loc.start && loc.start.line) || br.line,
                type: br.type,
                branch: `${id}[${i}]`,
                location: loc ? { start: loc.start, end: loc.end } : null,
            };
            if (sc && sc.b[id]) {
                entry.covered_by_suite = sc.b[id][i] > 0;
            }
            const r = reasons[`${file}:${entry.line}:${entry.branch}`];
            if (r) {
                entry.category = r.category;
                entry.reason = r.reason;
            }
            gaps.push(entry);
        });
    }
    const unStatements = Object.entries(cov.s).filter(([, n]) => n === 0).map(([id]) => cov.statementMap[id].start.line);
    const unFunctions = Object.entries(cov.f).filter(([, n]) => n === 0).map(([id]) => cov.fnMap[id].name);
    if (uncovered || unStatements.length || unFunctions.length) {
        perFile[file] = { uncovered_branches: uncovered, uncovered_statement_lines: unStatements, uncovered_functions: unFunctions };
    }
}
gaps.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);

const open = new Set(gaps.map((g) => `${g.file}:${g.line}:${g.branch}`));
const staleReasons = Object.keys(reasons).filter((k) => !open.has(k));
const unexplained = gaps.filter((g) => g.covered_by_suite && !g.reason).map((g) => `${g.file}:${g.line}:${g.branch}`);
const byCategory = {};
for (const g of gaps.filter((x) => x.covered_by_suite)) {
    const c = g.category || 'unexplained';
    byCategory[c] = (byCategory[c] || 0) + 1;
}

const suiteNums = pick(suiteSummary) || (baseline && baseline.typescript_concerto_core && {
    statements: { pct: baseline.typescript_concerto_core.nyc_coverage.statements_pct, fraction: baseline.typescript_concerto_core.nyc_coverage.statements_fraction },
    branches: { pct: baseline.typescript_concerto_core.nyc_coverage.branches_pct, fraction: baseline.typescript_concerto_core.nyc_coverage.branches_fraction },
    functions: { pct: baseline.typescript_concerto_core.nyc_coverage.functions_pct, fraction: baseline.typescript_concerto_core.nyc_coverage.functions_fraction },
    lines: { pct: baseline.typescript_concerto_core.nyc_coverage.lines_pct, fraction: baseline.typescript_concerto_core.nyc_coverage.lines_fraction },
});
const summary = {
    generated_at: new Date().toISOString(),
    driver: 'oracle corpus only: bin/replay.js --engine reference under nyc, over the frozen reference dist/*.js remapped to src/*.ts through its source maps',
    corpus: pick(corpusSummary),
    corpus_src_driver: corpusSrcSummary ? 'the same corpus, bin/replay.js --engine src under nyc (workspace src/ through ts-node)' : null,
    corpus_src: pick(corpusSrcSummary),
    corpus_reference_vs_src: corpusSrc ? {
        branch_layout_mismatches: layoutMismatches.length,
        branch_hit_disagreements: disagreements.length,
        disagreements: disagreements.slice(0, 50),
    } : null,
    unit_suite: suiteNums,
    unit_suite_source: suiteSummary ? 'nyc run of the unit suite over the workspace src/ (same command as baseline.json)' : 'migration/baseline.json',
    baseline_json: baseline && baseline.typescript_concerto_core ? baseline.typescript_concerto_core.nyc_coverage : null,
    thresholds: baseline && baseline.typescript_concerto_core ? baseline.typescript_concerto_core.nyc_thresholds : null,
    uncovered_branches: gaps.length,
    uncovered_branches_covered_by_suite: suite ? gaps.filter((g) => g.covered_by_suite).length : null,
    covered_by_suite_by_category: suite ? byCategory : null,
    unexplained_covered_by_suite: suite ? unexplained : null,
    stale_reasons: staleReasons,
};
fs.mkdirSync(path.join(ORACLE_DIR, 'results'), { recursive: true });
fs.writeFileSync(path.join(ORACLE_DIR, 'results', 'coverage.json'), JSON.stringify(summary, null, 1) + '\n');
fs.writeFileSync(path.join(ORACLE_DIR, 'coverage-gaps.json'), JSON.stringify({
    summary,
    note: 'Every branch of concerto-core src the oracle corpus does not reach on the frozen reference. covered_by_suite marks branches the unit suite does reach; each of those carries the category and verified reason from gap-reasons.json (categories are defined there).',
    categories: reasonsDoc.categories || null,
    per_file: perFile,
    branches: gaps,
}, null, 1) + '\n');
const fmt = (x) => (x ? `${x.pct}% (${x.covered !== undefined ? `${x.covered}/${x.total}` : x.fraction})` : 'n/a');
console.log(`corpus (reference): statements ${fmt(summary.corpus.statements)} branches ${fmt(summary.corpus.branches)} functions ${fmt(summary.corpus.functions)} lines ${fmt(summary.corpus.lines)}`);
if (summary.corpus_src) {
    console.log(`corpus (src):       statements ${fmt(summary.corpus_src.statements)} branches ${fmt(summary.corpus_src.branches)} functions ${fmt(summary.corpus_src.functions)} lines ${fmt(summary.corpus_src.lines)}`);
    console.log(`reference vs src:   ${layoutMismatches.length} branch layout mismatches, ${disagreements.length} branch hit disagreements`);
}
if (summary.unit_suite) {
    console.log(`unit suite (src):   statements ${fmt(summary.unit_suite.statements)} branches ${fmt(summary.unit_suite.branches)} functions ${fmt(summary.unit_suite.functions)} lines ${fmt(summary.unit_suite.lines)}`);
}
console.log(`uncovered branches: ${gaps.length}${suite ? ` (${summary.uncovered_branches_covered_by_suite} of them covered by the unit suite: ${JSON.stringify(byCategory)})` : ''}`);
if (suite && unexplained.length) {
    console.log(`covered by the suite but without a reason in ${path.basename(reasonsFile)}: ${unexplained.length}`);
}
if (staleReasons.length) {
    console.log(`stale reasons (branch now covered): ${staleReasons.length}`);
}
