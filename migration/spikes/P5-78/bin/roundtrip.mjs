#!/usr/bin/env node
// P5-78 spike (accordproject/concerto-rust#420), items 2 and 7.
//
//   node migration/spikes/P5-78/bin/roundtrip.mjs [--out FILE]
//
// Model corpora: the three benchmark model sets (migration/bench/fixtures/p515:
// concerto-core test data, concerto-conformance, synthetic-large), every
// concerto-core test/data .cto file that loads on its own in R1, and every
// concerto-conformance model that loads on its own (semantic specification
// ASTs, validate/models CTO).
//
// For each model set:
//  1. resolver check (item 2): resolveModels(parser ASTs) against R1's
//     ModelManager.getAst(true), structurally (locations dropped);
//  2. round trip (item 7): resolved AST -> Concertino -> AST, with the
//     published converter (packages/concertino) and the cleaned one (spike
//     src/concertino), every difference listed by path pattern.
import fs from 'fs';
import path from 'path';
import url from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const SPIKE = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(SPIKE, '..', '..', '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const OUT = opt('--out', path.join(SPIKE, 'results', 'roundtrip.json'));
const CONF = path.resolve(opt('--conformance', path.resolve(REPO, '..', 'conformance-ro')));

const core = require(path.join(REPO, 'packages', 'concerto-core'));
const { Parser } = require(path.join(REPO, 'packages', 'concerto-cto'));
const published = require(path.join(REPO, 'packages', 'concertino'));
const S = require(path.join(SPIKE, 'build', 'node-all.cjs'));

const strip = (x) => JSON.parse(JSON.stringify(x, (k, v) => (k === 'location' ? undefined : v)));

// Feature probes the corpora above do not exercise: aliased imports, scalar
// defaults that are falsy, one-sided ranges, map keys and values of every
// kind, relationship maps, enum value decorators, model-level decorators.
const PROBES = [
    [`namespace probe.base@1.0.0
abstract concept Thing identified { o String label optional }
concept Point { o Double x o Double y }
enum Colour { o RED o GREEN }
participant Person identified by email { o String email }`,
    `@ModelLevel("m")
namespace probe.main@1.0.0
import probe.base@1.0.0.{Thing as BaseThing, Point, Colour, Person}
scalar Zero extends Integer default=0 range=[0,]
scalar Off extends Boolean default=false
scalar Empty extends String default=""
scalar Code extends String regex=/^[A-Z]{3}$/u length=[3,3]
scalar When extends DateTime
map ByCode { o Code o Point }
map ByWhen { o When o Colour }
map People { o String --> Person }
map Flags { o String o Boolean }
enum Size { @Term("Small") o S @Ignore o M o L }
@Term("A widget") @Term_description("Widgets") @Other(1, true, "x", Point, Point[])
asset Widget extends BaseThing {
  o Zero count
  o Off enabled
  o Empty note
  o Code code optional
  o When at optional
  o ByCode points optional
  o ByWhen colours optional
  o People owners optional
  o Flags flags optional
  o Size size
  o Colour[] palette size=[1,] optional
  o Double ratio range=[,1.0] optional
  o Long big range=[-5,] optional
  --> Person maker optional
  --> Person[] fans optional
}
event Ping { o String why optional }`],
];

function sets() {
    const out = [];
    PROBES.forEach((ctos, i) => out.push({ corpus: 'probes', name: `probe-${i}`, asts: ctos.map((c) => Parser.parse(c)) }));
    for (const set of ['concerto-core-test-data', 'conformance', 'synthetic-large']) {
        const d = JSON.parse(fs.readFileSync(path.join(REPO, 'migration', 'bench', 'fixtures', 'p515', `${set}.json`), 'utf8'));
        out.push({ corpus: 'bench', name: set, asts: d.models.map((m) => {
            for (const decl of m.ast.declarations || []) {
                if (decl.$class === 'concerto.metamodel@1.0.0.EnumDeclaration') {
                    delete decl.isAbstract; // as p515-sweep.mjs (P5-56)
                }
            }
            return m.ast;
        }) });
    }
    const walk = (dir, ext, acc = []) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) {
                walk(p, ext, acc);
            } else if (e.name.endsWith(ext)) {
                acc.push(p);
            }
        }
        return acc;
    };
    for (const f of walk(path.join(REPO, 'packages', 'concerto-core', 'test', 'data'), '.cto').sort()) {
        try {
            out.push({ corpus: 'concerto-core test/data', name: path.relative(REPO, f), asts: [Parser.parse(fs.readFileSync(f, 'utf8'))] });
        } catch (e) {
            // does not parse: not a model for this check
        }
    }
    for (const f of walk(path.join(CONF, 'semantic', 'specifications'), '.json').sort()) {
        try {
            const ast = JSON.parse(fs.readFileSync(f, 'utf8'));
            if (ast.$class === 'concerto.metamodel@1.0.0.Model') {
                out.push({ corpus: 'conformance', name: path.relative(CONF, f), asts: [ast] });
            }
        } catch (e) {
            // not an AST
        }
    }
    for (const f of walk(path.join(CONF, 'validate', 'models'), '.cto').sort()) {
        try {
            out.push({ corpus: 'conformance', name: path.relative(CONF, f), asts: [Parser.parse(fs.readFileSync(f, 'utf8'))] });
        } catch (e) {
            // does not parse
        }
    }
    return out;
}

function diff(a, b, p, acc) {
    if (JSON.stringify(a) === JSON.stringify(b)) {
        return acc;
    }
    if (a && b && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b)) {
        if (Array.isArray(a)) {
            for (let i = 0; i < Math.max(a.length, b.length); i++) {
                diff(a[i], b[i], `${p}[${i}]`, acc);
            }
        } else {
            for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
                diff(a[k], b[k], `${p}.${k}`, acc);
            }
        }
        return acc;
    }
    acc.push({ path: p, before: a, after: b });
    return acc;
}
const pattern = (p) => p.replace(/\[\d+\]/g, '[]');
const kindOf = (d) => (d.before === undefined ? 'added' : d.after === undefined ? 'dropped' : 'changed');

function roundTrip(conv, resolved) {
    const doc = conv.convertToConcertino(JSON.parse(JSON.stringify(resolved)));
    const back = conv.convertToMetamodel(JSON.parse(JSON.stringify(doc)));
    // Compare model by model, declaration by declaration, by name (Concertino keys declarations by FQN).
    const diffs = [];
    for (const m of resolved.models) {
        const bm = back.models.find((x) => x.namespace === m.namespace);
        if (!bm) {
            diffs.push({ path: `models[${m.namespace}]`, before: 'model', after: undefined });
            continue;
        }
        const { declarations: da = [], ...ma } = m;
        const { declarations: db = [], ...mb } = bm;
        diff(ma, mb, 'model', diffs);
        da.forEach((d, i) => {
            const e = db.find((x) => x.name === d.name);
            if ((db[i] || {}).name !== d.name && e) {
                diffs.push({ path: 'model.declarations[order]', before: d.name, after: (db[i] || {}).name });
            }
            diff(d, e, `decl(${d.$class.split('.').pop()})`, diffs);
        });
        for (const e of db) {
            if (!da.find((x) => x.name === e.name)) {
                diffs.push({ path: 'decl(extra)', before: undefined, after: e.name });
            }
        }
    }
    return { doc, diffs };
}

const report = { tool: 'roundtrip', sets: 0, loaded: 0, resolver: { equal: 0, differs: [], diagnosticsOnLoadable: [] }, converters: {} };
const conv = { published, cleaned: S };
for (const k of Object.keys(conv)) {
    report.converters[k] = { converted: 0, throws: [], lossless: 0, withDiffs: 0, patterns: {}, schemaInvalid: 0 };
}
for (const set of sets()) {
    report.sets++;
    let mm;
    try {
        mm = new core.ModelManager({ importAliasing: true, enableMapType: true });
        set.asts.forEach((ast, i) => mm.addModelFile(new core.ModelFile(mm, ast, undefined, `m${i}.cto`), undefined, `m${i}.cto`, true));
        mm.validateModelFiles();
    } catch (e) {
        continue; // not loadable on its own in R1: out of scope here
    }
    report.loaded++;
    const res = S.resolver.resolveModels(set.asts);
    if (res.diagnostics.length) {
        report.resolver.diagnosticsOnLoadable.push({ set: set.name, diagnostics: res.diagnostics.map((d) => d.message) });
    }
    let ref = null;
    try {
        ref = strip(mm.getAst(true));
    } catch (e) {
        report.resolver.differs.push({ set: set.name, note: `R1 getAst(true) throws: ${e.message}` });
    }
    if (ref) {
        const order = (x) => ({ ...x, models: [...x.models].sort((p, q) => (p.namespace < q.namespace ? -1 : 1)) });
        const d = diff(order(ref), order(strip(res.models)), '$', []);
        if (d.length) {
            report.resolver.differs.push({ set: set.name, diffs: d.slice(0, 5) });
        } else {
            report.resolver.equal++;
        }
    }
    const resolved = strip(res.models);
    // The cleanup must not change the converter's output (beyond the alias fix).
    try {
        const a = JSON.stringify(published.convertToConcertino(JSON.parse(JSON.stringify(resolved))));
        const b = JSON.stringify(S.convertToConcertino(JSON.parse(JSON.stringify(resolved))));
        report.sameOutputAsPublished = report.sameOutputAsPublished || { same: 0, differs: [] };
        if (a === b) {
            report.sameOutputAsPublished.same++;
        } else {
            report.sameOutputAsPublished.differs.push(set.name);
        }
    } catch (e) {
        // reported by the round trip below
    }
    for (const [k, c] of Object.entries(conv)) {
        const r = report.converters[k];
        let out;
        try {
            out = roundTrip(c, resolved);
        } catch (e) {
            r.throws.push({ set: set.name, error: e.message });
            continue;
        }
        r.converted++;
        if (S.checkSchema(out.doc)) {
            r.schemaInvalid++;
            (r.schemaInvalidSets = r.schemaInvalidSets || []).push({ set: set.name, errors: S.checkSchema(out.doc).slice(0, 2) });
        }
        // Dangling references: a type Concertino names that it does not declare
        // (the system model and the decorator model excepted).
        const known = (t) => !t || /^(String|Boolean|DateTime|Double|Integer|Long)$/.test(t) || t in out.doc.declarations || /^concerto(\.decorator)?@1\.0\.0\./.test(t);
        const dangling = [];
        for (const [fqn, d] of Object.entries(out.doc.declarations)) {
            for (const t of d.extends || []) {
                if (!known(t)) dangling.push(`${fqn} extends ${t}`);
            }
            for (const p of Object.values(d.properties || {})) {
                if (!known(p.type)) dangling.push(`${fqn}.${p.name}: ${p.type}`);
            }
            if (d.key && !known(d.key.type)) dangling.push(`${fqn} key ${d.key.type}`);
            if (d.value && !known(d.value.type)) dangling.push(`${fqn} value ${d.value.type}`);
        }
        if (dangling.length) {
            (r.dangling = r.dangling || []).push({ set: set.name, refs: dangling });
        }
        if (!out.diffs.length) {
            r.lossless++;
            continue;
        }
        r.withDiffs++;
        const seen = new Set();
        for (const d of out.diffs) {
            const key = `${kindOf(d)} ${pattern(d.path)}`;
            const slot = (r.patterns[key] = r.patterns[key] || { sets: 0, occurrences: 0, example: { set: set.name, path: d.path, before: d.before, after: d.after } });
            slot.occurrences++;
            if (!seen.has(key)) {
                slot.sets++;
                seen.add(key);
            }
        }
    }
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
const brief = { sameOutputAsPublished: report.sameOutputAsPublished, sets: report.sets, loaded: report.loaded, resolverEqual: report.resolver.equal, resolverDiffers: report.resolver.differs.length,
    resolverDiagnosticsOnLoadable: report.resolver.diagnosticsOnLoadable.length };
for (const [k, r] of Object.entries(report.converters)) {
    brief[k] = { dangling: (r.dangling || []).map((x) => `${x.set}: ${x.refs.join('; ')}`), converted: r.converted, throws: r.throws.length, lossless: r.lossless, withDiffs: r.withDiffs, schemaInvalid: r.schemaInvalid,
        patterns: Object.fromEntries(Object.entries(r.patterns).sort((a, b) => b[1].sets - a[1].sets).map(([p, v]) => [p, v.sets])) };
}
console.log(JSON.stringify(brief, null, 1));
