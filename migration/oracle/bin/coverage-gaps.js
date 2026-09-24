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
 *       [--suite <coverage-final.json> --suite-summary <coverage-summary.json>]
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
const suite = load(args.suite);
const suiteSummary = load(args['suite-summary']);
const baseline = load(path.join(MIGRATION_DIR, 'baseline.json'));

const relFile = (f) => f.replace(/^.*\/packages\/concerto-core\//, '');
const pick = (s) => {
    if (!s) {
        return null;
    }
    const t = s.total;
    const one = (k) => ({ pct: t[k].pct, covered: t[k].covered, total: t[k].total });
    return { statements: one('statements'), branches: one('branches'), functions: one('functions'), lines: one('lines') };
};

const suiteByFile = {};
for (const [f, cov] of Object.entries(suite || {})) {
    suiteByFile[relFile(f)] = cov;
}

const gaps = [];
const perFile = {};
for (const [f, cov] of Object.entries(corpus)) {
    const file = relFile(f);
    const sc = suiteByFile[file];
    let uncovered = 0;
    for (const [id, br] of Object.entries(cov.branchMap)) {
        const counts = cov.b[id];
        counts.forEach((n, i) => {
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

const suiteNums = pick(suiteSummary) || (baseline && baseline.typescript_concerto_core && {
    statements: { pct: baseline.typescript_concerto_core.nyc_coverage.statements_pct, fraction: baseline.typescript_concerto_core.nyc_coverage.statements_fraction },
    branches: { pct: baseline.typescript_concerto_core.nyc_coverage.branches_pct, fraction: baseline.typescript_concerto_core.nyc_coverage.branches_fraction },
    functions: { pct: baseline.typescript_concerto_core.nyc_coverage.functions_pct, fraction: baseline.typescript_concerto_core.nyc_coverage.functions_fraction },
    lines: { pct: baseline.typescript_concerto_core.nyc_coverage.lines_pct, fraction: baseline.typescript_concerto_core.nyc_coverage.lines_fraction },
});
const summary = {
    generated_at: new Date().toISOString(),
    driver: 'oracle corpus only (bin/replay.js --engine src under nyc)',
    corpus: pick(corpusSummary),
    unit_suite: suiteNums,
    unit_suite_source: suiteSummary ? 'nyc run of the unit suite in this task (same command as baseline.json)' : 'migration/baseline.json',
    baseline_json: baseline && baseline.typescript_concerto_core ? baseline.typescript_concerto_core.nyc_coverage : null,
    thresholds: baseline && baseline.typescript_concerto_core ? baseline.typescript_concerto_core.nyc_thresholds : null,
    uncovered_branches: gaps.length,
    uncovered_branches_covered_by_suite: suite ? gaps.filter((g) => g.covered_by_suite).length : null,
};
fs.mkdirSync(path.join(ORACLE_DIR, 'results'), { recursive: true });
fs.writeFileSync(path.join(ORACLE_DIR, 'results', 'coverage.json'), JSON.stringify(summary, null, 1) + '\n');
fs.writeFileSync(path.join(ORACLE_DIR, 'coverage-gaps.json'), JSON.stringify({
    summary,
    note: 'Every branch of packages/concerto-core/src that the oracle corpus does not reach. covered_by_suite marks branches the unit suite does reach: these are the lifting tasks of plan §2.3/§2.4.',
    per_file: perFile,
    branches: gaps,
}, null, 1) + '\n');
const fmt = (x) => (x ? `${x.pct}%` : 'n/a');
console.log(`corpus:     statements ${fmt(summary.corpus.statements)} branches ${fmt(summary.corpus.branches)} functions ${fmt(summary.corpus.functions)} lines ${fmt(summary.corpus.lines)}`);
if (summary.unit_suite) {
    console.log(`unit suite: statements ${fmt(summary.unit_suite.statements)} branches ${fmt(summary.unit_suite.branches)} functions ${fmt(summary.unit_suite.functions)} lines ${fmt(summary.unit_suite.lines)}`);
}
console.log(`uncovered branches: ${gaps.length}${suite ? ` (${summary.uncovered_branches_covered_by_suite} of them covered by the unit suite)` : ''}`);
