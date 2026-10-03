#!/usr/bin/env node
// P5-78 spike (accordproject/concerto-rust#420), item 6: the Concertino
// prototype as a third runner over concerto-conformance, next to the TS
// runner (here: R1 concerto-core, this checkout's dist with the WASM engine)
// and the Rust runner (semantic/features/support/rust, not re-run here).
//
//   node migration/spikes/P5-78/bin/conformance.mjs [--conformance DIR] [--out FILE]
//
// - validate/features/validate.feature (instance validation): each scenario
//   through R1 (ModelManager.addCTOModel, Serializer.fromJSON + toJSON, as
//   validate/validateSteps.js does with ModelLoader) and through the
//   browser pipeline (concerto-cto Parser.parse -> resolveModels ->
//   Concertino -> validate). Expected: succeed / fail.
// - semantic/features/*.feature (model validation): not applicable to the
//   instance validator. Run anyway through the resolver alone, to measure
//   option (c) of item 2: which expected model errors parse-level and
//   resolution checks catch, and which need concerto-core's full model
//   validation (option (a) or (b)). Scenarios tagged @skip are reported, not counted.
import fs from 'fs';
import path from 'path';
import url from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const SPIKE = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(SPIKE, '..', '..', '..');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const CONF = path.resolve(opt('--conformance', process.env.CONFORMANCE_DIR || path.resolve(REPO, '..', 'conformance-ro')));
const OUT = opt('--out', path.join(SPIKE, 'results', 'conformance.json'));

const core = require(path.join(REPO, 'packages', 'concerto-core'));
const { Parser } = require(path.join(REPO, 'packages', 'concerto-cto'));
const S = require(path.join(SPIKE, 'build', 'node-all.cjs'));
const { PROBES, PROBE_INSTANCES } = await import('./probes.mjs');

function scenarios(file) {
    const out = [];
    let tags = [];
    let cur = null;
    for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
        const line = raw.trim();
        if (line.startsWith('@')) {
            tags.push(...line.split(/\s+/));
        } else if (line.startsWith('Scenario:')) {
            cur = { name: line.slice(9).trim(), tags, rows: [], validate: false, expect: null };
            out.push(cur);
            tags = [];
        } else if (cur && line.startsWith('|')) {
            const cell = line.split('|').map((x) => x.trim()).filter(Boolean)[0];
            if (cell !== 'model_file') {
                cur.rows.push(cell);
            }
        } else if (cur && line.startsWith('When I validate the models')) {
            cur.validate = true;
        } else if (cur && /^When I validate "/.test(line)) {
            const m = /^When I validate "([^"]+)" with models "([^"]+)"/.exec(line);
            cur.instance = m[1];
            cur.model = m[2];
        } else if (cur && /^Then the validation should (succeed|fail)/.test(line)) {
            cur.expect = /succeed/.test(line) ? 'ok' : 'error';
        } else if (cur && /^Then no error should be thrown/.test(line)) {
            cur.expect = 'ok';
        } else if (cur && /^Then an error should be thrown/.test(line)) {
            cur.expect = 'error';
            cur.message = (/"(.*)"/.exec(line) || [])[1];
        }
    }
    return out;
}

const tryOutcome = (f) => {
    try {
        f();
        return { ok: true };
    } catch (e) {
        return { ok: false, error: (e && (e.errorClass || e.constructor.name)) || 'Error', message: String(e && e.message).slice(0, 200) };
    }
};

// ---- instance validation -----------------------------------------------------------
const inst = [];
for (const sc of scenarios(path.join(CONF, 'validate', 'features', 'validate.feature'))) {
    const cto = fs.readFileSync(path.join(CONF, sc.model), 'utf8');
    const json = JSON.parse(fs.readFileSync(path.join(CONF, sc.instance), 'utf8'));
    const r1 = tryOutcome(() => {
        const mm = new core.ModelManager({ offline: true });
        mm.addCTOModel(cto, path.basename(sc.model));
        const s = new core.Serializer(new core.Factory(mm), mm);
        s.toJSON(s.fromJSON(json, {}), {});
    });
    const proto = tryOutcome(() => {
        const r = S.resolver.resolveModels([Parser.parse(cto)], { failFast: true });
        const m = S.query.load(S.convertToConcertino(r.models));
        S.validator.normalise(m, json);
    });
    const pass = (o) => (o.ok ? 'ok' : 'error') === sc.expect;
    inst.push({ scenario: sc.name, expect: sc.expect, r1: { pass: pass(r1), ...r1 }, prototype: { pass: pass(proto), ...proto },
        sameClass: r1.ok === proto.ok && (r1.ok || r1.error === proto.error) });
}

// ---- probe instances (bin/probes.mjs): the corners the suite does not reach -------------
const probes = [];
{
    const ctos = PROBES[0];
    const mm = new core.ModelManager({ importAliasing: true });
    ctos.forEach((c, i) => mm.addCTOModel(c, `probe${i}.cto`));
    const s = new core.Serializer(new core.Factory(mm), mm);
    const m = S.query.load(S.convertToConcertino(S.resolver.resolveModels(ctos.map((c) => Parser.parse(c)), { failFast: true }).models));
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const canon = (v, now) => (Array.isArray(v) ? v.map((x) => canon(x, now)) : v && typeof v === 'object'
        ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k], now)]))
        : typeof v === 'string' && (UUID.test(v) || (/^\d{4}-\d{2}-\d{2}T/.test(v) && Math.abs(Date.parse(v) - now) < 120000)) ? '<generated>' : v);
    const run = (f) => {
        const now = Date.now();
        try {
            return { ok: true, value: JSON.stringify(canon(f(), now)) };
        } catch (e) {
            return { ok: false, error: (e && (e.errorClass || e.constructor.name)) || 'Error', message: String(e && e.message).slice(0, 160) };
        }
    };
    for (const json of PROBE_INSTANCES) {
        const r1 = run(() => s.toJSON(s.fromJSON(json)));
        const p = run(() => S.validator.normalise(m, json));
        probes.push({ json, r1, prototype: p, same: r1.ok === p.ok && (r1.ok ? r1.value === p.value : r1.error === p.error) });
    }
}

// ---- semantic (model) scenarios through the resolver: option (c) -----------------------
const sem = [];
const specDir = path.join(CONF, 'semantic', 'specifications');
for (const f of fs.readdirSync(path.join(CONF, 'semantic', 'features')).filter((x) => x.endsWith('.feature')).sort()) {
    for (const sc of scenarios(path.join(CONF, 'semantic', 'features', f))) {
        const missing = sc.rows.filter((r) => !fs.existsSync(path.join(specDir, r)));
        if (missing.length) {
            // The TS runner's loadAST throws here, which a scenario expecting an error counts as a pass.
            sem.push({ feature: f, scenario: sc.name, tags: [...sc.tags, '@missing-fixture'], expect: sc.expect, missing });
            continue;
        }
        const asts = sc.rows.map((r) => JSON.parse(fs.readFileSync(path.join(specDir, r), 'utf8')));
        const r1 = tryOutcome(() => {
            const mm = new core.ModelManager({ enableMapType: true });
            for (let i = 0; i < asts.length; i++) {
                const mf = new core.ModelFile(mm, asts[i], undefined, sc.rows[i]);
                mm.addModelFile(mf, null, mf.getName(), true);
            }
            if (sc.validate) {
                mm.validateModelFiles();
            }
        });
        const res = S.resolver.resolveModels(asts);
        let convertError = null;
        if (!res.diagnostics.length) {
            try {
                S.convertToConcertino(res.models);
            } catch (e) {
                convertError = e.message;
            }
        }
        const cCaught = res.diagnostics.length > 0;
        sem.push({
            feature: f, scenario: sc.name, tags: sc.tags, expect: sc.expect, expectMessage: sc.message || null,
            r1: { pass: (r1.ok ? 'ok' : 'error') === sc.expect, ...r1 },
            optionC: {
                verdict: sc.expect === 'error' ? (cCaught ? 'caught' : 'missed (needs full model validation)') : (cCaught ? 'false positive' : 'ok'),
                diagnostics: res.diagnostics.map((d) => `${d.errorClass}: ${d.message}`),
                convertError,
            },
        });
    }
}

const count = (xs, f) => xs.filter(f).length;
const live = sem.filter((s) => !s.tags.includes('@skip') && !s.tags.includes('@missing-fixture'));
const summary = {
    probes: { instances: probes.length, sameOutcomeValueOrClass: count(probes, (x) => x.same), r1Throws: count(probes, (x) => !x.r1.ok) },
    instance: {
        scenarios: inst.length,
        r1Pass: count(inst, (x) => x.r1.pass),
        prototypePass: count(inst, (x) => x.prototype.pass),
        sameOutcomeAndClass: count(inst, (x) => x.sameClass),
    },
    semantic: {
        scenarios: sem.length,
        skipped: count(sem, (x) => x.tags.includes('@skip')),
        missingFixture: count(sem, (x) => x.tags.includes('@missing-fixture')),
        r1Pass: count(live, (x) => x.r1.pass),
        expectError: count(live, (x) => x.expect === 'error'),
        optionCCaught: count(live, (x) => x.optionC.verdict === 'caught'),
        optionCMissed: count(live, (x) => x.optionC.verdict.startsWith('missed')),
        expectOk: count(live, (x) => x.expect === 'ok'),
        optionCFalsePositive: count(live, (x) => x.optionC.verdict === 'false positive'),
        converterErrorsOnValidModels: count(live, (x) => x.expect === 'ok' && x.optionC.convertError),
    },
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ tool: 'conformance', conformance: CONF, summary, instance: inst, probes, semantic: sem }, null, 1));
console.log(JSON.stringify(summary, null, 1));
