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

const pkg = path.join(repo, 'packages', 'concerto-core');
const outDir = __dirname;
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
function memberKey(row) {
    return row.cls ? `${row.cls}.${row.member}` : row.member;
}

const rows = extract();
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
    if (!cat) { cat = autoCategory(row); }
    if (c === 'TS' && t !== '-') { t = '-'; }
    const cp = coupling(row);
    return {
        file: row.file, cls: row.cls, member: row.member, kind: row.kind, loc: row.loc,
        weight: +(row.loc * FACTOR[cat]).toFixed(1), category: cat, classification: c, reason: r,
        coupled_tests: cp.text, target: t, planned: p, line: row.line, cw: cp.w, cs: cp.s, cb: cp.b,
    };
});
for (const f of Object.keys(rules)) {
    for (const k of Object.keys(rules[f].m || {})) {
        if (!usedOverrides.has(f + '|' + k)) { throw new Error(`Override ${f} ${k} matches no member`); }
    }
}
for (const l of ledger) {
    if (l.classification !== 'RUST' && !l.reason) { throw new Error('Missing reason: ' + l.file + ' ' + l.cls + '.' + l.member); }
    if (/\t|\n/.test(l.reason)) { throw new Error('Bad reason text: ' + l.member); }
}

// ---------------------------------------------------------------- TSV
const header = ['file', 'class', 'member', 'kind', 'loc', 'weight', 'classification', 'reason', 'coupled_tests', 'target_rust_module', 'planned_task', 'category', 'line'];
const tsv = [header.join('\t')].concat(ledger.map(l => [
    l.file, l.cls, l.member, l.kind, l.loc, l.weight, l.classification, l.reason, l.coupled_tests, l.target, l.planned, l.category, l.line,
].join('\t'))).join('\n') + '\n';
fs.writeFileSync(path.join(outDir, 'SEAM_LEDGER.tsv'), tsv);

// ---------------------------------------------------------------- SUMMARY
const sum = (arr, f) => +arr.reduce((a, x) => a + f(x), 0).toFixed(1);
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) : '0.0') + '%';
const CL = ['RUST', 'HYBRID', 'TS'];
const totW = sum(ledger, l => l.weight);
const totLoc = sum(ledger, l => l.loc);
const by = (k) => CL.map(c => {
    const xs = ledger.filter(l => l.classification === c);
    return { c, n: xs.length, loc: sum(xs, l => l.loc), w: sum(xs, l => l.weight) };
});
const cls = by();
const wR = cls[0].w; const wH = cls[1].w; const wT = cls[2].w;
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
const hyFull = hyItems.map(l => `| ${l.file.replace(/^src\//, '')} | ${l.cls || '(function)'} | ${l.member} | ${l.weight} | ${l.reason} |`);
const wCoupled = ledger.filter(l => l.cw > 0);
const wCoupledRows = wCoupled.map(l => `| ${l.file.replace(/^src\//, '')} | ${l.cls ? l.cls + '.' : ''}${l.member} | ${l.classification} | ${l.coupled_tests.split(' ').filter(s => s.startsWith('W:')).join('')} |`);
const stubbedClasses = ledger.filter(l => l.cs > 0).map(l => `| ${l.cls} | ${l.classification} | ${l.coupled_tests.split(' ').filter(s => s.startsWith('S:')).join('')} |`);

const md = `# Seam ledger summary (P0-03)

Generated by \`migration/ledger/build-ledger.js\` from the TypeScript AST of
\`packages/concerto-core/src/**/*.ts\` and the rules in
\`migration/ledger/classification.js\`. The row-level data is in
[\`SEAM_LEDGER.tsv\`](SEAM_LEDGER.tsv). Do not hand-edit the TSV: change
\`classification.js\` and re-run the builder.

## How to review

1. Start with the **TS items** below (section 4). Each one needs a reason you accept.
2. Then read the **HYBRID items** (section 5). The reason says which part stays in JS.
3. Answer the **open questions** in section 8. Several classifications depend on them.
4. RUST rows need no reason. Spot-check them by file in section 3.

Verify completeness with:

\`\`\`sh
node migration/ledger/extract-members.js --check migration/ledger/SEAM_LEDGER.tsv
\`\`\`

This extracts every constructor, method, static method, accessor and
top-level function (including \`const f = () => ...\`) from the TS AST. It then
diffs them against the ledger and checks that each TS or HYBRID row has a reason.

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
    still calls Rust for its model logic.
  * **TS**: the member stays in TS with no Rust involvement.
* **Automatic TS rules**, which an explicit override can reverse:
  * \`accept()\` visitor entry points;
  * bodies that are a single \`return <literal>\`, i.e. constant type/kind markers;
  * abstract \`throw new Error('not implemented')\` stubs;
  * empty bodies.
* **coupled_tests** comes from grepping \`test/**/*.js\` (excluding \`test/data\`, \`test/scripts\` and
  \`test/models\`). It has three parts:
  * \`W:\` files that stub or spy on a member of this name, via \`stub/spy/replace(obj,'name')\`
    or \`.name.returns/.callsFake/.calledWith...\`. This is the white-box signal;
  * \`S:\` (constructor rows only) files that \`createStubInstance(ThisClass)\`;
  * \`B:\` files that call \`.name(\` directly. The counterpart test file is listed first,
    at most 3 are shown, and \`+N\` counts the rest.

  The match is by name, so a common name like \`getType\` over-reports. P0-02's
  \`migration/test-tags.tsv\` will give per-\`it()\` B/W/M tags. Join on test file
  once it lands.
* **planned_task**: the Rust implementation task, then the view-conversion task
  (\`P2-xx+P4-xx\`, or \`P3-xx+P4-xx\` for instance and metamodel validation). Exception classes
  point at P1-05 (error contract) and P4-02 (the error mapper that instantiates them).

## 1. Headline: D1 weighted share

| | members | loc | weight | share of weight |
|---|---|---|---|---|
${cls.map(x => `| ${x.c} | ${x.n} | ${x.loc} | ${x.w} | ${pct(x.w, totW)} |`).join('\n')}
| **total** | ${ledger.length} | ${totLoc} | ${totW} | 100% |

* **RUST+HYBRID weighted share: ${pct(wR + wH, totW)}**. D1 target: >= 70%. ${(wR + wH) / totW >= 0.7 ? '**Met.**' : '**NOT met.**'}
* Conservative reading, counting HYBRID at half weight: ${pct(wR + wH / 2, totW)}.
* RUST only: ${pct(wR, totW)}.

By weight category:

| category | members | loc | weight | RUST w | HYBRID w | TS w |
|---|---|---|---|---|---|---|
${catRows.join('\n')}

## 2. By planned task

| task | members | weight | of which HYBRID |
|---|---|---|---|
${taskRows.join('\n')}

TS members have \`planned_task = -\` and need no migration work. The exception is the exception classes: they list P1-05 and P4-02 because the error mapper instantiates them. The table counts a member once per task it lists, so the rows do not sum to the total.

## 3. By file

Columns: members; count RUST / HYBRID / TS; total weight; weight RUST / HYBRID / TS; RUST+HYBRID share; tasks.

| file | n | R / H / T | weight | weight R / H / T | R+H | tasks |
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
so this holds. It is also why constructors taking a stubbed parent are HYBRID (context fallback).

| class | ctor classification | S files |
|---|---|---|
${stubbedClasses.join('\n')}

## 7. Notable classification calls

* **Constructors of introspect classes that tests build directly**
  (\`ModelFile\`, \`Declaration\`, \`Decorated\`, \`Property\`, \`Field\`, \`MapDeclaration\`)
  are HYBRID. The test files construct them over sinon-stubbed parents: 36 ModelFile and
  42 Field stub instances, and \`new Field(mockClassDeclaration, ...)\`. So these
  constructors keep the collaborator-context fallback from plan section 3. Subclass
  constructors that no test builds directly are RUST.
* **Serializer and visitors (P3-01, P4-10).** \`Serializer.toJSON\`/\`fromJSON\` and every \`visitX\`/\`checkX\`
  are HYBRID: the TS visitor shell stays, and each per-field check, coercion and message
  goes to Rust. \`visit()\` dispatchers and visitor constructors are TS.
  \`getAssignableProperties\`/\`validateProperties\` are RUST.
* **Factory, \`model/*\`, InstanceGenerator and ValueGenerator** stay TS under D7.
  \`ResourceId\` is the exception: plan P4-03 converts it, so its URI parsing is RUST
  and only its value-object constructor is HYBRID.
  \`InstanceGenerator.findConcreteSubclass\` is a pure graph query, so it is RUST.
* **DCS (D7: the ledger decides).**
  * DecoratorManager command application and DecoratorExtractor are RUST
    (\`concerto_core::dcs\`).
  * The CTO-compiled DCS model validation entry points are HYBRID.
  * \`dcsconverter.ts\` stays TS, because it is YAML via the \`yaml\` npm lib.
  * \`DecoratorExtractor.quoteStringValue\` is HYBRID, because its quoting follows
    the \`yaml\` library's rules.
* **CTO parsing seam.**
  * The \`processFile\` callbacks (default, AST, CTO) and the ModelManager/AstModelManager
    constructors stay TS.
  * Methods that accept CTO strings are HYBRID: \`addModel\`, \`addModelFiles\`,
    \`updateModelFile\`, \`validateModelFile\` and \`addCTOModel\`.
  * ModelLoader stays TS because it is I/O orchestration.
* **Exceptions** stay TS classes. Rust returns \`{kind, code, params, location}\` and the
  P4-02 mapper builds these classes. \`Globalize\` stays as a TS helper, and its templates
  are duplicated into the Rust catalogue (P1-05).

## 8. Open questions for the human reviewer

1. **Does HYBRID count toward D1?** The task counts RUST+HYBRID. The conservative figure,
   with HYBRID at half weight, is ${pct(wR + wH / 2, totW)}. Confirm which figure the gate (P5-02) uses.
2. **Constant markers and \`accept()\` count as TS.** They add ${sum(tsItems.filter(l => /constant-return|visitor dispatch entry|abstract stub|empty no-op|returns \`this\`/.test(l.reason)), l => l.weight)} weight.
   Should they be excluded from the D1 denominator instead? They are not "logic".
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
9. **Name-based coupling.** Coupling here is a heuristic grep. Once P0-02's
   \`test-tags.tsv\` lands, should P2-10 re-derive \`coupled_tests\` from the per-\`it()\` tags?
`;
fs.writeFileSync(path.join(outDir, 'SUMMARY.md'), md);
console.log(`members=${ledger.length} RUST=${cls[0].n} HYBRID=${cls[1].n} TS=${cls[2].n} weight=${totW} R+H=${pct(wR + wH, totW)} conservative=${pct(wR + wH / 2, totW)}`);
