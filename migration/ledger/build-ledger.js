#!/usr/bin/env node
/*
 * Build the seam ledger (task P0-03).
 *
 *   node migration/ledger/build-ledger.js
 *
 * Reads every member of packages/concerto-core/src/**\/*.ts from the TS AST
 * (extract-members.js), applies classification.js, measures test coupling by
 * grepping packages/concerto-core/test, and writes:
 *   migration/ledger/SEAM_LEDGER.tsv
 *   migration/ledger/SUMMARY.md
 * Re-run after changing classification.js. Verify with
 *   node migration/ledger/extract-members.js --check migration/ledger/SEAM_LEDGER.tsv
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { extract, repo } = require('./extract-members.js');
const rules = require('./classification.js');
const { computeEvidence, fmtTestSet } = require('./test-evidence.js');
const { scan, crossingHelpers } = require('./engine-calls.js');

const pkg = path.join(repo, 'packages', 'concerto-core');
const outDir = __dirname;
const tagsPath = path.join(repo, 'migration', 'tags', 'test-tags.tsv');
const FACTOR = { glue: 0.5, logic: 1, validation: 1.5 };

// ---------------------------------------------------------------- tests
function walk(dir) {
    let out = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (['data', 'scripts', 'models', 'node_modules'].includes(e.name)) { continue; }
            out = out.concat(walk(p));
        } else if (e.name.endsWith('.js')) { out.push(p); }
    }
    return out.sort();
}
const testFiles = walk(path.join(pkg, 'test')).map(f => ({
    rel: path.relative(pkg, f),
    lines: fs.readFileSync(f, 'utf8').split('\n'),
}));
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const SINON_PROPS = 'returns|returnsArg|callsFake|throws|withArgs|resolves|rejects|callCount|called|calledWith|calledOnce|calledTwice|notCalled|args|getCall|firstCall|lastCall|reset|restore|should\\.have\\.been|onCall';

function coupling(row) {
    const name = row.member.replace(/^(get|set) /, '');
    const base = path.basename(row.file, '.ts');
    let callRe;
    const wRes = [];
    const sRes = [];
    if (row.kind === 'ctor') {
        callRe = new RegExp('new\\s+' + esc(row.cls) + '\\s*\\(');
        sRes.push(new RegExp('createStubInstance\\(\\s*' + esc(row.cls) + '\\b'));
    } else if (row.kind === 'function') {
        callRe = new RegExp('(^|[^.\\w$])' + esc(name) + '\\s*\\(|\\.' + esc(name) + '\\s*\\(');
    } else if (row.kind === 'static') {
        callRe = new RegExp('\\b' + esc(row.cls) + '\\.' + esc(name) + '\\s*\\(');
    } else {
        callRe = new RegExp('\\.' + esc(name) + '\\s*\\(');
    }
    if (row.kind !== 'ctor') {
        wRes.push(new RegExp('(stub|spy|replace)\\s*\\([^)]*[\'"`]' + esc(name) + '[\'"`]'));
        wRes.push(new RegExp('\\.' + esc(name) + '\\.(' + SINON_PROPS + ')\\b'));
    }
    const W = new Set(); const B = new Map(); const S = new Set();
    for (const t of testFiles) {
        for (const l of t.lines) {
            if (wRes.some(re => re.test(l))) { W.add(t.rel); }
            if (sRes.some(re => re.test(l))) { S.add(t.rel); }
            if (callRe.test(l)) { B.set(t.rel, (B.get(t.rel) || 0) + 1); }
        }
    }
    const fmt = (arr, max) => {
        const shown = arr.slice(0, max).map(f => f.replace(/^test\//, ''));
        return shown.join(',') + (arr.length > max ? `,+${arr.length - max}` : '');
    };
    const bSorted = [...B.keys()].sort((a, b) => {
        const am = path.basename(a, '.js') === base ? 0 : 1;
        const bm = path.basename(b, '.js') === base ? 0 : 1;
        return am - bm || B.get(b) - B.get(a) || a.localeCompare(b);
    });
    const parts = [];
    if (W.size) { parts.push('W:' + fmt([...W].sort(), 4)); }
    if (S.size) { parts.push('S:' + fmt([...S].sort(), 4)); }
    if (B.size) { parts.push('B:' + fmt(bSorted, 3)); }
    return { text: parts.join(' ') || '-', w: W.size, s: S.size, b: B.size };
}

// ---------------------------------------------------------------- classify
function body(text) {
    const i = text.indexOf('{');
    const j = text.lastIndexOf('}');
    return i >= 0 && j > i ? text.slice(i + 1, j).trim() : '';
}
function autoRule(row) {
    const b = body(row.text);
    if (row.member === 'accept' && /return\s+visitor\.visit\(this,\s*parameters\)/.test(b)) {
        return { c: 'TS', t: '-', p: '-', r: 'visitor dispatch entry point (accept -> visitor.visit); kept in TS, visitors call back into views', cat: 'glue' };
    }
    if (/^return\s+(true|false|null|'[^']*'|"[^"]*")\s*;?$/.test(b)) {
        return { c: 'TS', t: '-', p: '-', r: 'constant-return member (type/kind marker or fixed default, body is `return <literal>`); stays as-is on the TS class, nothing to port', cat: 'glue' };
    }
    if (/^throw\s+new\s+Error\(\s*'(not implemented|abstract function called)'\s*\)\s*;?$/.test(b)) {
        return { c: 'TS', t: '-', p: '-', r: 'abstract stub (throws); overridden by subclasses, nothing to port', cat: 'glue' };
    }
    if (row.kind !== 'ctor' && b === '') {
        return { c: 'TS', t: '-', p: '-', r: 'empty no-op body; nothing to port', cat: 'glue' };
    }
    return null;
}
function autoCategory(row) {
    const b = body(row.text);
    const name = row.member;
    if (/^(validate|_resolveSuperType|check|enforce|isCompatibleVersion|_throwAlreadyExists)/.test(name)) { return 'validation'; }
    if (row.loc > 6 && /throw new (IllegalModelException|ValidationException|MetamodelException)|reportError\(|\.report[A-Z]\w*\(/.test(b)) { return 'validation'; }
    if (row.loc <= 5) { return 'glue'; }
    if (row.kind === 'ctor' && !/throw|reportError/.test(b)) { return 'glue'; }
    return 'logic';
}
// PARTIAL (accordproject/concerto-rust#261): a row the rules call RUST whose
// own body makes no engine call (engine-calls.js). Its observable behaviour
// is its TS body's, so it is not counted as Rust in D1.
const PARTIAL_LOGIC_REASON = 'no engine call: the TS body (branches, loops or throw sites) still runs and decides the result and any exception; not yet converted to a delegation. Planned task kept; porting it is follow-up after P5-10 (accordproject/concerto-rust#261)';
const PARTIAL_READ_REASON = 'no engine call: a straight-line read of view state (a snapshot field, the wrapped AST node or a child view), a fixed-data builder or a forward to other members; PORTING 1.5 snapshot design allows it on a view, but the member itself runs no Rust (accordproject/concerto-rust#261)';
// P5-11 (accordproject/concerto-rust#276): a PARTIAL row whose rule is marked
// `deferred` is a port candidate the stage 1 evaluation recommended moving to
// Rust; the maintainer deferred the port on 2026-09-28.
const PARTIAL_DEFERRED_NOTE = 'Port candidate: moving it to Rust was recommended by the P5-11 evaluation and deferred by maintainer decision (accordproject/concerto-rust#276, 2026-09-28).';
function memberKey(row) {
    return row.cls ? `${row.cls}.${row.member}` : row.member;
}

const rows = extract();
const helpers = crossingHelpers(rows);
const usedOverrides = new Set();
const ledger = rows.map(row => {
    const fr = rules[row.file];
    if (!fr) { throw new Error('No classification rule for ' + row.file); }
    const key = memberKey(row);
    const ov = fr.m && fr.m[key];
    if (ov) { usedOverrides.add(row.file + '|' + key); }
    const auto = autoRule(row);
    let c = fr.c; let t = fr.t; let p = fr.p; let r = fr.r || '';
    let cat;
    if (auto) { c = auto.c; t = auto.t; p = auto.p; r = auto.r; cat = auto.cat; }
    if (ov) {
        if (ov.c) { c = ov.c; }
        if (ov.t) { t = ov.t; }
        if (ov.p) { p = ov.p; }
        if (ov.r !== undefined) { r = ov.r; }
        if (ov.cat) { cat = ov.cat; }
        // An override that promotes a member back out of TS takes the file target/task.
        if (ov.c && ov.c !== 'TS' && t === '-') { t = fr.t; p = fr.p; }
    }
    if (c === 'RUST' && !(ov && ov.r)) { r = ''; }
    const sc = scan(row, helpers);
    let partialKind = '';
    if (c === 'RUST' && !sc.engineCall) {
        c = 'PARTIAL';
        partialKind = sc.substantive ? 'logic' : 'read';
        r = sc.substantive ? PARTIAL_LOGIC_REASON : PARTIAL_READ_REASON;
        if (ov && ov.deferred) { r += ' ' + PARTIAL_DEFERRED_NOTE; }
    }
    if (ov && ov.deferred && c !== 'PARTIAL') {
        throw new Error('`deferred` rule on a row that is not PARTIAL (' + c + '): ' + row.file + ' ' + key);
    }
    if (!cat) { cat = autoCategory(row); }
    if (c === 'TS' && t !== '-') { t = '-'; }
    const cp = coupling(row);
    return {
        file: row.file, cls: row.cls, member: row.member, kind: row.kind, loc: row.loc,
        weight: +(row.loc * FACTOR[cat]).toFixed(1), category: cat, classification: c, reason: r,
        coupled_tests_grep: cp.text, target: t, planned: p, line: row.line, cw: cp.w, cs: cp.s, cb: cp.b,
        partialKind, engineCall: sc.engineCall, deferred: !!(ov && ov.deferred),
    };
});

// ---------------------------------------------------------------- real per-test evidence
// Re-derives test coupling from migration/tags/test-tags.tsv's per-it() B/W/M
// tags and reasons (runtime sinon trace + static acorn pass), instead of the
// coupled_tests_grep whole-file name grep above. See test-evidence.js.
const evidence = computeEvidence(rows, tagsPath, path.join(pkg, 'test'));
ledger.forEach((l, i) => {
    l.w_tests = fmtTestSet(evidence.wTestsByRow[i], 3);
    l.direct_tests = fmtTestSet(evidence.directTestsByRow[i], 3);
    l.needs_fallback = evidence.needsFallback[i];
    l.w_tests_n = evidence.wTestsByRow[i].size;
    l.direct_tests_n = evidence.directTestsByRow[i].size;
});
for (const f of Object.keys(rules)) {
    for (const k of Object.keys(rules[f].m || {})) {
        if (!usedOverrides.has(f + '|' + k)) { throw new Error(`Override ${f} ${k} matches no member`); }
    }
}
for (const l of ledger) {
    if (l.classification === 'RUST' && !l.engineCall) { throw new Error('RUST row with no engine call: ' + l.file + ' ' + l.cls + '.' + l.member); }
    if (l.classification !== 'RUST' && !l.reason) { throw new Error('Missing reason: ' + l.file + ' ' + l.cls + '.' + l.member); }
    if (/\t|\n/.test(l.reason)) { throw new Error('Bad reason text: ' + l.member); }
}

// ---------------------------------------------------------------- TSV
const header = [
    'file', 'class', 'member', 'kind', 'loc', 'weight', 'classification', 'reason',
    'coupled_tests_grep', 'w_tests', 'direct_tests', 'needs_fallback',
    'target_rust_module', 'planned_task', 'category', 'line',
];
const tsv = [header.join('\t')].concat(ledger.map(l => [
    l.file, l.cls, l.member, l.kind, l.loc, l.weight, l.classification, l.reason,
    l.coupled_tests_grep, l.w_tests, l.direct_tests, l.needs_fallback,
    l.target, l.planned, l.category, l.line,
].join('\t'))).join('\n') + '\n';
fs.writeFileSync(path.join(outDir, 'SEAM_LEDGER.tsv'), tsv);

// ---------------------------------------------------------------- SUMMARY
const sum = (arr, f) => +arr.reduce((a, x) => a + f(x), 0).toFixed(1);
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) : '0.0') + '%';
const CL = ['RUST', 'HYBRID', 'PARTIAL', 'TS'];
const totW = sum(ledger, l => l.weight);
const totLoc = sum(ledger, l => l.loc);
const by = (k) => CL.map(c => {
    const xs = ledger.filter(l => l.classification === c);
    return { c, n: xs.length, loc: sum(xs, l => l.loc), w: sum(xs, l => l.weight) };
});
const cls = by();
const wR = cls[0].w; const wH = cls[1].w; const wP = cls[2].w; const wT = cls[3].w;
const catRows = ['glue', 'logic', 'validation'].map(cat => {
    const xs = ledger.filter(l => l.category === cat);
    return `| ${cat} (x${FACTOR[cat]}) | ${xs.length} | ${sum(xs, l => l.loc)} | ${sum(xs, l => l.weight)} | ` +
        CL.map(c => sum(xs.filter(l => l.classification === c), l => l.weight)).join(' | ') + ' |';
});
const files = [...new Set(ledger.map(l => l.file))].sort();
const fileRows = files.map(f => {
    const xs = ledger.filter(l => l.file === f);
    const w = sum(xs, l => l.weight);
    const cnt = CL.map(c => xs.filter(l => l.classification === c).length);
    const ws = CL.map(c => sum(xs.filter(l => l.classification === c), l => l.weight));
    const tasks = [...new Set(xs.map(l => l.planned).filter(p => p !== '-'))].join(', ') || '-';
    return `| ${f.replace(/^src\//, '')} | ${xs.length} | ${cnt.join(' / ')} | ${w} | ${ws.join(' / ')} | ${pct(ws[0] + ws[1], w)} | ${tasks} |`;
});
const tasksAll = [...new Set(ledger.flatMap(l => l.planned === '-' ? [] : l.planned.split('+')))].sort();
const taskRows = tasksAll.map(t => {
    const xs = ledger.filter(l => l.planned.split('+').includes(t));
    return `| ${t} | ${xs.length} | ${sum(xs, l => l.weight)} | ${xs.filter(l => l.classification === 'HYBRID').length} |`;
});
const tsItems = ledger.filter(l => l.classification === 'TS');
const byReason = new Map();
for (const l of tsItems) {
    if (!byReason.has(l.reason)) { byReason.set(l.reason, []); }
    byReason.get(l.reason).push(l);
}
const tsGroups = [...byReason.entries()].sort((a, b) => sum(b[1], l => l.weight) - sum(a[1], l => l.weight)).map(([r, xs]) => {
    const list = xs.map(l => `\`${l.file.replace(/^src\//, '')}\` ${l.cls ? l.cls + '.' : ''}${l.member}`).join('; ');
    return `| ${r} | ${xs.length} | ${sum(xs, l => l.weight)} | ${list} |`;
});
const tsFull = tsItems.map(l => `| ${l.file.replace(/^src\//, '')} | ${l.cls || '(function)'} | ${l.member} | ${l.kind} | ${l.loc} | ${l.weight} | ${l.reason} |`);
const hyItems = ledger.filter(l => l.classification === 'HYBRID');
const paItems = ledger.filter(l => l.classification === 'PARTIAL');
const paLogic = paItems.filter(l => l.partialKind === 'logic');
const paRead = paItems.filter(l => l.partialKind === 'read');
const wPLogic = sum(paLogic, l => l.weight);
const wPRead = sum(paRead, l => l.weight);
const paRow = (l) => `| ${l.file.replace(/^src\//, '')} | ${l.cls || '(function)'} | ${l.member} | ${l.loc} | ${l.weight} | ${l.planned} | ${l.deferred ? 'port candidate, deferred (#276)' : '**undecided**'} |`;
const paDeferred = paItems.filter(l => l.deferred);
const hyFull = hyItems.map(l => `| ${l.file.replace(/^src\//, '')} | ${l.cls || '(function)'} | ${l.member} | ${l.weight} | ${l.reason} |`);
const wCoupled = ledger.filter(l => l.cw > 0);
const wCoupledRows = wCoupled.map(l => `| ${l.file.replace(/^src\//, '')} | ${l.cls ? l.cls + '.' : ''}${l.member} | ${l.classification} | ${l.coupled_tests_grep.split(' ').filter(s => s.startsWith('W:')).join('')} |`);
const stubbedClasses = ledger.filter(l => l.cs > 0).map(l => `| ${l.cls} | ${l.classification} | ${l.coupled_tests_grep.split(' ').filter(s => s.startsWith('S:')).join('')} |`);

// ---------------------------------------------------------------- D1 with the maintainer's denominator change (#32)
// Constant markers and accept() visitor entry points are not logic; excluded
// from the D1 denominator on the maintainer's decision (open question 2).
const CONST_REASON = 'constant-return member (type/kind marker or fixed default, body is `return <literal>`); stays as-is on the TS class, nothing to port';
const ACCEPT_REASON = 'visitor dispatch entry point (accept -> visitor.visit); kept in TS, visitors call back into views';
const d1Excluded = ledger.filter(l => l.reason === CONST_REASON || l.reason === ACCEPT_REASON);
const d1ExcludedW = sum(d1Excluded, l => l.weight);
const d1TotW = +(totW - d1ExcludedW).toFixed(1);
const d1Pct = pct(wR + wH, d1TotW);
const d1PctWithReads = pct(wR + wH + wPRead, d1TotW);
const d1PctWithPartial = pct(wR + wH + wP, d1TotW);
const oldPct = pct(wR + wH, totW);

// ---------------------------------------------------------------- needs_fallback, grouped by class (drives P4 view work)
const nfRows = ledger.filter(l => l.needs_fallback);
const nfByClass = new Map();
for (const l of nfRows) {
    const key = l.cls || '(function)';
    if (!nfByClass.has(key)) { nfByClass.set(key, []); }
    nfByClass.get(key).push(l);
}
const nfSections = [...nfByClass.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([cls, xs]) => {
    const rowsMd = xs.map(l => `| ${l.member} | ${l.kind} | ${l.classification} | ${l.w_tests} |`).join('\n');
    return `### ${cls} (${xs.length} member${xs.length === 1 ? '' : 's'})\n\n| member | kind | classification | w_tests |\n|---|---|---|---|\n${rowsMd}`;
});

// ---------------------------------------------------------------- W tests to lift to fixtures, per test file (drives P2-10)
const wLiftSections = [...evidence.wLiftByFile.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])).map(([file, tests]) => {
    const items = tests.map(t => `  - ${t.title}`).join('\n');
    return `### \`${file}\` (${tests.length} W test${tests.length === 1 ? '' : 's'})\n\n${items}`;
});
const wLiftTotal = [...evidence.wLiftByFile.values()].reduce((a, xs) => a + xs.length, 0);

// ---------------------------------------------------------------- unmapped W tests (verification step 4)
const unmappedRows = evidence.unmappedW.map(u => `| ${u.file} | ${u.title} | ${u.reason} |`);

const md = `# Seam ledger summary (P0-03)

Generated by \`migration/ledger/build-ledger.js\` from the TypeScript AST of
\`packages/concerto-core/src/**/*.ts\` and the rules in
\`migration/ledger/classification.js\`. The row-level data is in
[\`SEAM_LEDGER.tsv\`](SEAM_LEDGER.tsv). Do not hand-edit the TSV: change
\`classification.js\` and re-run the builder.

## How to review

1. Start with the **TS items** below (section 4). Each one needs a reason you accept.
2. Then read the **HYBRID items** (section 5). The reason says which part stays in JS.
3. Section 8's open questions are now settled; see
   [accordproject/concerto-rust#32](https://github.com/accordproject/concerto-rust/issues/32).
4. RUST rows need no reason. Spot-check them by file in section 3.
5. PARTIAL rows (section 5b) are members the rules put in Rust whose own body
   makes no engine call; their reason is set automatically.

Reproduce the whole ledger, including the test-coupling columns below, with
one command (it reads \`migration/tags/test-tags.tsv\`, so run
\`migration/tags/run-tagging.sh\` + \`node migration/bin/tag-tests.mjs\` first if
that file is stale):

\`\`\`sh
node migration/ledger/build-ledger.js
node migration/ledger/extract-members.js --check migration/ledger/SEAM_LEDGER.tsv
\`\`\`

The first command writes \`SEAM_LEDGER.tsv\` and this file. The second extracts
every constructor, method, static method, accessor and top-level function
(including \`const f = () => ...\`) from the TS AST and diffs them against the
ledger, checking that each non-RUST row has a reason, that every RUST row
makes an engine call and that no PARTIAL row does (the engine-call scan in
\`engine-calls.js\`, accordproject/concerto-rust#261). CI runs it in
\`migration-guardrails.yml\`, so a view that gains or loses its engine call
without a ledger rebuild fails the build.

## Method

* **Scope.** ${ledger.length} members in ${files.length} files. Nested closures count
  as part of the member that encloses them. \`index.ts\`, \`types.ts\` and
  \`dayjs-setup.ts\` have no members: they hold re-exports, types and a dayjs
  plugin setup only.
* **loc** is the member's source lines, including its signature and closing brace
  but not its JSDoc.
* **weight** is loc multiplied by the category factor: glue x0.5, pure logic x1,
  validation logic x1.5. The category is set automatically, and
  \`classification.js\` can override it:
  * **validation**: names like \`validate*\`, \`check*\` or \`_resolveSuperType\`, or
    bodies longer than 6 lines that throw IllegalModelException, ValidationException
    or MetamodelException or call \`reportError\`/\`report*\`;
  * **glue**: 5 lines or fewer, or constructors that do not throw;
  * **logic**: everything else.
* **Classification** follows plan section 3: Rust owns the graph, and the TS classes become views.
  * **RUST**: the logic runs in Rust. The TS member becomes a one-line delegation on the view.
  * **HYBRID**: part of the member stays in JS, and the reason says which part. The member
    still calls Rust for its model logic: since P5-11 (accordproject/concerto-rust#276) no
    HYBRID row lacks an engine call by the scan below (of the 64 that did, 6 are counted by the
    scan's one-hop rule, 57 were reclassified TS and \`updateExternalModels\` is PARTIAL).
    
  * **PARTIAL** (accordproject/concerto-rust#261): the rules put the member in Rust, but
    its own body makes no engine call: no reference to the module's \`rust\` binding, a
    \`rustHandle\`/\`_rust*\` handle or \`loadEngine(...)\` (nested closures included;
    \`engine-calls.js\`). Since P5-11 (accordproject/concerto-rust#276) the scan also counts
    an engine call one hop away in the same source file: a call to a top-level helper of
    that file whose own body crosses (directly or through another such helper, e.g.
    \`beginModelFile\` -> \`computeBatch\`), and a method call on a local handle initialised
    from such a helper (\`const handle = handleFor(mm); handle.serializerFromJson(...)\`).
    Imported functions and \`this.x()\` methods are not followed. It is set automatically,
    never by hand: a RUST row that fails the scan becomes PARTIAL. Two kinds, by the same
    scan:
    * *logic*: the body has a branch, loop, \`throw\`, \`try\` or conditional and spans more
      than 4 lines. The TS body still decides the result and which exception is thrown; it
      was never converted.
    * *read*: a straight-line body: a snapshot getter or field read, a fixed-data builder
      or a forward to other members. PORTING 1.5's snapshot design allows these on a view,
      but the member itself runs no Rust.

    PARTIAL rows keep their planned task (so the oracle's owner attribution is unchanged)
    and are **not** counted as Rust in D1. P5-11 (accordproject/concerto-rust#276) evaluated
    every PARTIAL row: the ones recommended to move to Rust stayed PARTIAL as *port candidates,
    deferred* by maintainer decision (2026-09-28; the \`deferred\` marker in
    \`classification.js\`), and the rest were reclassified TS (section 4). The pause was
    lifted the same day, and accordproject/concerto-rust#287 ported the 14 port candidates,
    so they are RUST now.
  * **TS**: the member stays in TS with no Rust involvement.
* **Automatic TS rules**, which an explicit override can reverse:
  * \`accept()\` visitor entry points;
  * bodies that are a single \`return <literal>\`, i.e. constant type/kind markers;
  * abstract \`throw new Error('not implemented')\` stubs;
  * empty bodies.
* **coupled_tests_grep** is the original heuristic: grepping \`test/**/*.js\` (excluding
  \`test/data\`, \`test/scripts\` and \`test/models\`) by member *name*, whole file at a time.
  It has three parts, kept only for comparison against the real evidence below:
  * \`W:\` files that stub or spy on a member of this name, via \`stub/spy/replace(obj,'name')\`
    or \`.name.returns/.callsFake/.calledWith...\`;
  * \`S:\` (constructor rows only) files that \`createStubInstance(ThisClass)\`;
  * \`B:\` files that call \`.name(\` directly. The counterpart test file is listed first,
    at most 3 are shown, and \`+N\` counts the rest.

  The match is by name only, so a common name like \`getType\` over-reports, and it can't
  tell *which* test in a file is responsible.
* **w_tests / direct_tests / needs_fallback** (the re-derived columns, task: re-derive
  \`coupled_tests\` from per-test evidence, accordproject/concerto-rust#32) come from
  \`migration/ledger/test-evidence.js\`, joined against \`migration/tags/test-tags.tsv\`'s
  per-\`it()\` B/W/M tags and reasons (the sinon runtime trace + a static acorn pass,
  already reconciled there) plus a fresh acorn walk of each test file to recover, per
  test, its own body and in-scope \`beforeEach\`/\`before\` hook text:
  * \`w_tests\`: W-tagged tests that stub/spy/\`createStubInstance\` this member or its
    class (including whole-class stubs, and the generic "internal-only member" reason
    resolved via source scan to \`visitX\`, \`getAst()\` and \`_resolveSuperType\` hits).
    Format \`n=<count> <file>:<count>,...\` (top 3 files, \`+Nfiles\` for the rest), \`-\` if none.
  * \`direct_tests\`: any test (B or W) whose own text calls this member directly
    (\`.member(\`, \`Class.member(\` or \`new Class(\`), same format.
  * \`needs_fallback\`: \`true\` when a W test builds this member's class with \`new\`
    while a *different* class is stubbed in the same test (a collaborator-context
    fallback, plan section 3), or stubs the whole class via \`createStubInstance\`
    (which replaces every prototype method for that test).

  This is still name-based call-site matching (no cross-file type inference) and the
  \`visitX\` receiver is not resolved (so a visitX hit attributes to every ledger member
  of that name, across \`ResourceValidator\`/\`JSONGenerator\`/\`JSONPopulator\`/
  \`InstanceGenerator\`) — real per-test evidence, but still an approximation where the
  source itself is ambiguous; see sections 9-11 below for what it drives.
* **planned_task**: the Rust implementation task, then the view-conversion task
  (\`P2-xx+P4-xx\`, or \`P3-xx+P4-xx\` for instance and metamodel validation). Exception classes
  point at P1-05 (error contract) and P4-02 (the error mapper that instantiates them).

## 1. Headline: D1 weighted share

| | members | loc | weight | share of weight |
|---|---|---|---|---|
${cls.map(x => `| ${x.c} | ${x.n} | ${x.loc} | ${x.w} | ${pct(x.w, totW)} |`).join('\n')}
| **total** | ${ledger.length} | ${totLoc} | ${totW} | 100% |

* **RUST+HYBRID weighted share (new D1 denominator): ${d1Pct}**, HYBRID at full weight
  (confirmed, accordproject/concerto-rust#32). D1 target: >= 70%. ${(wR + wH) / d1TotW >= 0.7 ? '**Met.**' : '**NOT met.**'}
  PARTIAL rows (section 5b) are not in the numerator.
  Denominator excludes constant markers and \`accept()\` visitor entry points
  (${d1Excluded.length} members, weight ${d1ExcludedW}) as not-logic, per the maintainer's
  decision on open question 2 below. New total weight: ${d1TotW} (was ${totW}).
  D1 stays as defined, with the 70% bar, by maintainer decision (accordproject/concerto-rust#276,
  2026-09-28): the proposed D1′ was not adopted, and the gate reports §0.4 as FAIL at this figure.
* **Old figure (previous denominator, all ${ledger.length} members): ${oldPct}.**
* RUST only (new denominator): ${pct(wR, d1TotW)}.
* For comparison only, not the D1 figure: counting PARTIAL *read* rows (${paRead.length} members,
  weight ${wPRead}) as Rust gives ${d1PctWithReads}; counting every PARTIAL row (${paItems.length} members,
  weight ${wP}) gives ${d1PctWithPartial}. That is how the ledger counted them before
  accordproject/concerto-rust#261 (then 78.9%, which also counted three \`rustHandle\`
  plumbing helpers as RUST; they are now TS, engine shim). After #261 and before P5-11 the
  figure was 57.4% (61.5% at #261 itself): P5-11 reclassified TS 128 PARTIAL rows and 57 HYBRID
  rows that make no engine call (accordproject/concerto-rust#276).
* P5-64 re-audit (accordproject/concerto-rust#401, integration head 2a6a71754): the figure was
  45.3% at the P5-12c rebuild (28 Sep). The R1 changes since then deleted or shortened TS bodies
  of RUST/HYBRID rows that already delegated (-301 weight in the numerator, most of it
  ModelFile.validate, P5-34), added 47 TS members (+653, chiefly the engine shim and the fast-path
  codec) and 5 HYBRID entry points (+101), and the re-audit moved 6 rows RUST -> TS (-78: the P5-32
  field-backed ModelFile getters and rustHandle id/flag plumbing), the serializer handle cache
  (handleFor, cachedHandleFor) HYBRID -> TS (-1.5 for handleFor; cachedHandleFor is new; neither
  calls the engine since P5-34) and StringValidator.validate HYBRID -> RUST. The rules are the P5-64 block of \`classification.js\`.

By weight category:

| category | members | loc | weight | RUST w | HYBRID w | PARTIAL w | TS w |
|---|---|---|---|---|---|---|---|
${catRows.join('\n')}

## 2. By planned task

| task | members | weight | of which HYBRID |
|---|---|---|---|
${taskRows.join('\n')}

TS members have \`planned_task = -\` and need no migration work, with two exceptions. The exception classes list P1-05 and P4-02 because the error mapper instantiates them. The rows P5-11 reclassified TS (reason ending "Stays TS by maintainer decision (accordproject/concerto-rust#276, 2026-09-28)") keep the planned task they had, so the oracle's owner attribution is unchanged. The table counts a member once per task it lists, so the rows do not sum to the total.

## 3. By file

Columns: members; count RUST / HYBRID / PARTIAL / TS; total weight; weight RUST / HYBRID / PARTIAL / TS; RUST+HYBRID share; tasks.

| file | n | R / H / P / T | weight | weight R / H / P / T | R+H | tasks |
|---|---|---|---|---|---|---|
${fileRows.join('\n')}

## 4. TS items (stay in TypeScript) with reasons

${tsItems.length} members, weight ${wT} (${pct(wT, totW)}).

### 4a. Grouped by reason

| reason | n | weight | members |
|---|---|---|---|
${tsGroups.join('\n')}

### 4b. Full list

| file | class | member | kind | loc | weight | reason |
|---|---|---|---|---|---|---|
${tsFull.join('\n')}

## 5. HYBRID items with reasons

${hyItems.length} members, weight ${wH} (${pct(wH, totW)}).

| file | class | member | weight | what stays in JS |
|---|---|---|---|---|
${hyFull.join('\n')}

## 5b. PARTIAL items (no engine call)

${paItems.length} members, weight ${wP} (${pct(wP, totW)}). Set automatically by the engine-call
scan (see Method); accordproject/concerto-rust#261. ${paDeferred.length} of them (weight
${sum(paDeferred, l => l.weight)}) are **port candidates, deferred by maintainer decision**
(accordproject/concerto-rust#276, 2026-09-28). The P5-11 evaluation recommended moving 14 rows
to Rust (resolution and validation primitives, and throw sites that re-derive a Rust verdict);
the maintainer first deferred them, then lifted the pause the same day, and
accordproject/concerto-rust#287 ported all 14 (they are RUST now). The evaluation, with the
evidence for each row, is on #276; option F is superseded by accordproject/concerto-rust#293.
A row marked **undecided** has not been evaluated.

### PARTIAL *logic*: unconverted TS bodies

${paLogic.length} members, weight ${wPLogic}. The TS body is still the live path, including which
exception is thrown.

| file | class | member | loc | weight | planned task | P5-11 |
|---|---|---|---|---|---|---|
${paLogic.map(paRow).join('\n') || '(none)'}

### PARTIAL *read*: straight-line reads and forwards

${paRead.length} members, weight ${wPRead}.

| file | class | member | loc | weight | planned task | P5-11 |
|---|---|---|---|---|---|---|
${paRead.map(paRow).join('\n') || '(none)'}

## 6. White-box coupling seen in tests

### 6a. Members that tests stub or spy on by name (\`W:\`)

These are name matches, so treat them as leads. They show where a view must still
expose a stubbable TS method. The \`visitX\` shells are the certain cases: tests spy on
\`visitField\`, \`visitClassDeclaration\`, \`visitEnumDeclaration\`,
\`visitRelationshipDeclaration\` and \`visit\`.

| file | member | classification | W files |
|---|---|---|---|
${wCoupledRows.join('\n')}

### 6b. Classes that tests replace with \`createStubInstance\` (\`S:\`)

A class stubbed wholesale must keep its method set on the TS prototype, because sinon
stubs prototype methods. Views keep every public method as a TS method that delegates,
so this holds. It is also why constructors taking a stubbed parent keep the context
fallback (plan section 3): \`ModelFile\`'s is HYBRID, and the others are TS view glue (P5-11).

| class | ctor classification | S files |
|---|---|---|
${stubbedClasses.join('\n')}

## 7. Notable classification calls

* **Constructors of introspect classes that tests build directly**
  (\`ModelFile\`, \`Declaration\`, \`Decorated\`, \`Property\`, \`Field\`, \`MapDeclaration\`)
  keep the collaborator-context fallback from plan section 3: the test files construct them
  over sinon-stubbed parents (36 ModelFile and 42 Field stub instances, and
  \`new Field(mockClassDeclaration, ...)\`). \`ModelFile\`'s constructor stages the file in
  Rust, so it is HYBRID. The others make no engine call of their own (their \`process()\` is
  counted separately), so P5-11 reclassified them TS as view glue, and the subclass
  constructors that only call \`super\`/\`process()\` likewise.
* **Serializer and visitors (P3-01, P4-10).** \`Serializer.toJSON\`/\`fromJSON\` are HYBRID:
  the fast path validates and populates or generates the whole document in one Rust call.
  In the visitor classes, the members that call Rust per value are HYBRID
  (\`ResourceValidator.checkItem\`, \`JSONPopulator.convertToObject\`,
  \`JSONGenerator.convertToJSON\`). The rest of the visitor shells make no engine call and are
  TS (P5-11, accordproject/concerto-rust#276): the JSONPopulator/JSONGenerator \`visitX\`
  and \`getAssignableProperties\`/\`validateProperties\` run only on the fast path's
  fallback, and the ResourceValidator \`visitX\`/\`checkX\`/\`reportX\` shell is the main path
  of \`Resource.validate\` (moving its entry point to Rust, option F, was declined).
  \`visit()\` dispatchers and visitor constructors are TS.
* **Factory, \`model/*\`, InstanceGenerator and ValueGenerator** stay TS under D7.
  \`ResourceId\` is the exception: plan P4-03 converts it, so its URI parsing is RUST;
  its value-object constructor makes no engine call and is TS (P5-11).
  \`InstanceGenerator.findConcreteSubclass\` stays TS with the rest of InstanceGenerator
  (P5-11); the ordering it uses comes from the RUST \`getAssignableClassDeclarations\`.
* **DCS (D7: the ledger decides).**
  * DecoratorManager command application and extraction are RUST
    (\`concerto_core::dcs\`). \`DecoratorExtractor\` was deleted by P5-02 (BC-37): the
    \`extract*\` methods delegate straight to the engine.
  * \`assignDeep\`, which merges the result of the Rust \`decoratorManagerMigrateTo\` into the
    caller's object in place to keep JS object identity, stays TS (P5-11).
  * The CTO-compiled DCS model validation entry point (\`DecoratorManager.validate\`) is HYBRID.
  * \`dcsconverter.ts\` stays TS, because it is YAML via the \`yaml\` npm lib, and so do the
    \`jsonToYaml\`/\`yamlToJson\` forwards to it (P5-11).
* **CTO parsing seam.**
  * The \`processFile\` callbacks (default, AST, CTO) and the ModelManager/AstModelManager
    constructors stay TS.
  * Methods that accept CTO strings and call Rust themselves are HYBRID: \`addModelFiles\`
    and \`updateModelFile\`. \`addModel\`, \`validateModelFile\` and \`addCTOModel\` only parse
    and forward to RUST members, so they are TS (P5-11).
  * ModelLoader stays TS because it is I/O orchestration.
* **Exceptions** stay TS classes. Rust returns \`{kind, code, params, location}\` and the
  P4-02 mapper builds these classes. \`Globalize\` stays as a TS helper, and its templates
  are duplicated into the Rust catalogue (P1-05).

## 8. Open questions for the human reviewer — all settled (accordproject/concerto-rust#32)

Kept for history; every question below has a maintainer decision now, linked from each item.

1. **Does HYBRID count toward D1? Settled: yes, at full weight.** New D1 figure: ${d1Pct}
   (old figure, previous denominator: ${oldPct}). See section 1.
2. **Constant markers and \`accept()\` count as TS. Settled: excluded from the D1
   denominator.** They are not "logic". ${d1Excluded.length} members, weight ${d1ExcludedW},
   removed from the denominator (section 1).
3. **Where do DCS operations get a Rust implementation task?** The plan has P4-09
   (view conversion) but no P2/P3 task that implements \`concerto_core::dcs\` in Rust.
   Options: add a P2-12 "DCS in Rust", or fold it into P4-09.
4. **Should the Factory ever move?** D7 keeps Factory TS. But \`Factory.newResource\` contains
   model validation: abstract type, identifier type, empty identifier and identifier regex.
   Should those checks call a Rust helper, which would make it HYBRID, or stay as view
   queries?
5. **The \`yaml\` quoting in \`DecoratorExtractor.quoteStringValue\`.** Should Rust port the
   \`yaml\` plain-scalar rule, which needs golden tests, or call back into JS? A call-back
   makes the extractor round-trip across the WASM boundary per string.
6. **\`Serializer\` fast path vs visitor path.** When does \`toJSON\`/\`fromJSON\` take the
   single-call Rust path? When no spies are installed? Always, with the visitor path only
   reachable via the visitor classes? This decides whether \`jsonpopulator.js\` and
   \`resourcevalidator.js\` W tests still exercise the Rust checks.
7. **Should \`StringValidator.getRegex()\`** keep returning a live JS \`RegExp\`, as the API
   requires? It stays TS here, so the regex is compiled twice: \`regress\` in Rust and
   \`RegExp\` in JS. Is that acceptable?
8. **\`ModelLoader\`, \`writeModelsToFileSystem\` and \`updateExternalModels\`** stay TS or
   HYBRID for I/O reasons. Confirm that the browser/WASM build does not need a Rust
   loader.
9. **Name-based coupling. Settled: re-derived from \`test-tags.tsv\` (this task).**
   \`coupled_tests\` is replaced by \`w_tests\`/\`direct_tests\`/\`needs_fallback\`, computed
   per-\`it()\` from real evidence; the old grep is kept as \`coupled_tests_grep\` for
   comparison. See the Method section above and sections 9-11 below.

Items 3-8 remain open for a follow-up decision; they are unrelated to test coupling
and outside this task's scope (accordproject/concerto-rust#32 covers items 1, 2 and 9).

## 9. Members needing a collaborator-context fallback (\`needs_fallback\`), by class

Drives the P4 view-conversion work: each of these classes' listed members must keep
(or gain) a fallback path for when a W test has stubbed a collaborator, per plan section 3.
${nfRows.length} members across ${nfByClass.size} classes.

${nfSections.join("\n\n") || "(none)"}

## 10. W tests to lift to fixtures, by test file

Drives P2-10: replacing these sinon stubs/spies with real fixtures once the classes
they stub are Rust-backed views. ${wLiftTotal} W tests across ${evidence.wLiftByFile.size} files.

${wLiftSections.join("\n\n")}

## 11. Unmapped W tests

Every W test in \`test-tags.tsv\` is accounted for: it is either attributed to at least
one ledger member (rolled up in section 9's \`w_tests\` and listed per test file in
section 10), or listed here with why it could not be routed to one specific ledger
member (verification step 4) — never silently dropped.
${unmappedRows.length} of ${wLiftTotal} W tests fall in the second group: a bare internal-field
read (\`.ast\`, \`modelFiles[..]\`) or an internal-only member name (\`_resolveInternal\`) that
has no corresponding *method* row in this ledger (methods/functions only, no fields).

| file | test | reason |
|---|---|---|
${unmappedRows.join("\n") || "(none)"}
`;
fs.writeFileSync(path.join(outDir, 'SUMMARY.md'), md);
console.log(`members=${ledger.length} RUST=${cls[0].n} HYBRID=${cls[1].n} PARTIAL=${cls[2].n} (logic=${paLogic.length} w=${wPLogic}, read=${paRead.length} w=${wPRead}) TS=${cls[3].n} weight=${totW} R+H+Pread=${d1PctWithReads} R+H+P=${d1PctWithPartial} R+H(new denom)=${d1Pct} R+H(old denom)=${oldPct} needs_fallback=${nfRows.length} unmapped_W=${unmappedRows.length}`);
