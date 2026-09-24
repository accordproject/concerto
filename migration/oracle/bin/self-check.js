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
 * Judge self-check (plan §2.6): the judge must flag every seeded mutant of
 * the reference behaviour, and must report broken fixtures as harness errors.
 *
 *   TZ=UTC node bin/self-check.js [--fixtures <dir>] [--report <file.json>]
 *
 * Mutants are either adapter wrappers (they alter what the reference
 * returns) or in-engine patches (they change one rule inside the reference
 * build and let its real code run). Exit status 0 only when every mutant is
 * detected by at least one fixture and every harness check holds.
 *
 * Task accordproject/concerto-rust#94 adds one mutant per new kind of call
 * (filter predicates, async ops, decorator-factory steps, the
 * ScalarDeclaration constructor). Each names the fixtures that must catch it
 * (`mustFlag`): it counts as detected only when at least one failing fixture
 * is of that kind.
 */

process.env.TZ = 'UTC';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { replayCorpus, listFixtures, judgeFile } = require('../lib/judge');
const { blobStore } = require('../lib/store');
const { referenceAdapter } = require('../lib/adapter');
const { M } = require('../lib/codec');
const { ASYNC_OPS } = require('../lib/ops');

const out = console.log.bind(console);
for (const k of ['log', 'info', 'warn', 'error', 'debug']) {
    console[k] = () => {};
}

const ORACLE_DIR = path.resolve(__dirname, '..');
let fixtures = path.join(ORACLE_DIR, 'fixtures');
let reportFile = null;
for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--fixtures') {
        fixtures = path.resolve(process.argv[++i]);
    } else if (process.argv[i] === '--report') {
        reportFile = path.resolve(process.argv[++i]);
    }
}
const store = blobStore(path.join(fixtures, 'blobs'));
const ref = referenceAdapter();
const core = ref.core;

/**
 * Adapter wrapper that rewrites outcomes.
 * @param {string} name mutant name
 * @param {function} rewrite (op, outcome) -> outcome
 * @returns {object} adapter
 */
function wrapOutcome(name, rewrite) {
    return {
        name,
        run(op, inputs) {
            const res = ref.run(op, inputs);
            const apply = (r) => ({ outcome: rewrite(op, JSON.parse(JSON.stringify(r.outcome))), window: r.window });
            return res && typeof res.then === 'function' ? res.then(apply) : apply(res);
        },
    };
}

/**
 * Adapter that runs the reference with one rule patched inside the engine.
 * @param {string} name mutant name
 * @param {function} install () -> uninstall function
 * @returns {object} adapter
 */
function patchEngine(name, install) {
    return {
        name,
        run(op, inputs) {
            const uninstall = install();
            let res;
            try {
                res = ref.run(op, inputs);
            } catch (e) {
                uninstall();
                throw e;
            }
            // an async op: keep the patch until its promise settles
            if (res && typeof res.then === 'function') {
                return res.then((r) => {
                    uninstall();
                    return r;
                }, (e) => {
                    uninstall();
                    throw e;
                });
            }
            uninstall();
            return res;
        },
    };
}

/**
 * Replace a property for the duration of one op.
 * @param {object} obj holder
 * @param {string} key property
 * @param {function} make (original) -> replacement
 * @returns {function} install
 */
const replace = (obj, key, make) => () => {
    const orig = obj[key];
    obj[key] = make(orig);
    return () => {
        obj[key] = orig;
    };
};

const MUTANTS = [
    {
        name: 'error-message-changed',
        description: 'IllegalModelException messages gain a trailing full stop',
        adapter: wrapOutcome('error-message-changed', (op, o) => {
            if (o.error && o.error.class === 'IllegalModelException') {
                o.error.message += '.';
            }
            return o;
        }),
    },
    {
        name: 'verdict-flipped',
        description: 'validateModelFiles reports success when the reference throws, and vice versa',
        adapter: wrapOutcome('verdict-flipped', (op, o) => {
            if (op !== 'ModelManager.validateModelFiles') {
                return o;
            }
            return o.error ? { ok: { [M]: 'undefined' } } : { error: { class: 'IllegalModelException', message: 'mutant', location: null, component: '@accordproject/concerto-core' } };
        }),
    },
    {
        name: 'identifier-check-dropped',
        description: 'in-engine: ModelUtil.isValidIdentifier always returns true',
        adapter: patchEngine('identifier-check-dropped', replace(core.ModelUtil, 'isValidIdentifier', () => () => true)),
    },
    {
        name: 'abstract-check-dropped',
        description: 'in-engine: ClassDeclaration.isAbstract always returns false',
        adapter: patchEngine('abstract-check-dropped', replace(core.ClassDeclaration.prototype, 'isAbstract', () => function () {
            return false;
        })),
    },
    {
        name: 'canonical-result-altered',
        description: 'Serializer.toJSON results lose their $class key',
        adapter: wrapOutcome('canonical-result-altered', (op, o) => {
            if (op === 'Serializer.toJSON' && o.ok && typeof o.ok === 'object') {
                delete o.ok.$class;
            }
            return o;
        }),
    },
    {
        name: 'error-class-swapped',
        description: 'TypeNotFoundException is reported as a plain Error',
        adapter: wrapOutcome('error-class-swapped', (op, o) => {
            if (o.error && o.error.class === 'TypeNotFoundException') {
                o.error.class = 'Error';
            }
            return o;
        }),
    },
    {
        name: 'optional-field-rule-dropped',
        description: 'in-engine: Property.isOptional always returns true (missing required fields accepted)',
        adapter: patchEngine('optional-field-rule-dropped', replace(core.Property.prototype, 'isOptional', () => function () {
            return true;
        })),
    },
    {
        name: 'datetime-shifted',
        description: 'in-engine: DateTime values are serialised one millisecond late',
        adapter: patchEngine('datetime-shifted', replace(core.req('serializer/jsongenerator').default.prototype, 'convertToJSON', (orig) => function (field, obj) {
            if (field.getType() === 'DateTime' && obj && typeof obj.add === 'function') {
                return orig.call(this, field, obj.add(1, 'millisecond'));
            }
            return orig.call(this, field, obj);
        })),
    },
    // task accordproject/concerto-rust#94: one mutant per new kind of call.
    {
        name: 'filter-imports-unpruned',
        description: 'in-engine: ModelManager.filter keeps every import, whatever the predicate says about the imported type',
        adapter: patchEngine('filter-imports-unpruned', replace(core.ModelFile.prototype, 'filter', (orig) => function (predicate, modelManager) {
            const own = new Set(this.getAllDeclarations());
            return orig.call(this, (d) => (own.has(d) ? predicate(d) : true), modelManager);
        })),
        mustFlag: { what: 'a ModelManager.filter fixture', test: (fx) => fx.op === 'ModelManager.filter' },
    },
    {
        name: 'offline-flag-inverted',
        description: 'in-engine: ModelLoader resolves external models when offline, and only validates when online',
        adapter: patchEngine('offline-flag-inverted', () => {
            const undo = ['loadModelManager', 'loadModelManagerFromModelFiles'].map((f) => replace(core.ModelLoader, f, (orig) => function (...args) {
                const i = f === 'loadModelManager' ? 1 : 2;
                const opts = args[i];
                args[i] = Object.assign({}, opts || {}, { offline: !(opts && opts.offline) });
                return orig.apply(this, args);
            })());
            return () => undo.forEach((u) => u());
        }),
        mustFlag: { what: 'a ModelLoader fixture', test: (fx) => fx.op.startsWith('ModelLoader.') },
    },
    {
        name: 'async-rejection-swallowed',
        description: 'an async op whose promise rejects is reported as resolving to undefined',
        adapter: wrapOutcome('async-rejection-swallowed', (op, o) => (ASYNC_OPS.has(op) && o.error ? { ok: { [M]: 'undefined' } } : o)),
        mustFlag: { what: 'a ModelManager.updateExternalModels fixture', test: (fx) => fx.op === 'ModelManager.updateExternalModels' },
    },
    {
        name: 'decorator-factories-ignored',
        description: 'in-engine: a model manager reports no decorator factories, so addDecoratorFactory has no effect',
        adapter: patchEngine('decorator-factories-ignored', replace(core.BaseModelManager.prototype, 'getDecoratorFactories', () => function () {
            return [];
        })),
        mustFlag: { what: 'a fixture with an addDecoratorFactory step', test: (fx) => JSON.stringify(fx.inputs).includes('"decoratorfactory"') },
    },
    {
        name: 'scalar-type-fallback-changed',
        description: 'in-engine: a ScalarDeclaration whose AST has no scalar $class gets type String instead of null',
        adapter: patchEngine('scalar-type-fallback-changed', replace(core.ScalarDeclaration.prototype, 'process', (orig) => function (...args) {
            const r = orig.apply(this, args);
            if (this.type === null) {
                this.type = 'String';
            }
            return r;
        })),
        mustFlag: { what: 'a ScalarDeclaration.new fixture or one built on its result', test: (fx) => fx.op === 'ScalarDeclaration.new' || JSON.stringify(fx.inputs).includes('"declnew"') },
    },
];

(async () => {
    const report = { fixtures: path.relative(ORACLE_DIR, fixtures), baseline: null, mutants: [], harness_checks: [] };

    // Baseline: the unmutated reference must agree on everything.
    const base = await replayCorpus(fixtures, ref, store);
    report.baseline = { total: base.total, pass: base.pass, fail: base.fail, harness_error: base.harness_error };
    out(`baseline reference: ${base.pass}/${base.total} pass, ${base.fail} fail, ${base.harness_error} harness errors`);

    for (const m of MUTANTS) {
        const s = await replayCorpus(fixtures, m.adapter, store);
        let flagged = null;
        if (m.mustFlag) {
            flagged = s.failures.filter((f) => {
                if (f.status !== 'fail') {
                    return false;
                }
                try {
                    return m.mustFlag.test(JSON.parse(fs.readFileSync(path.join(fixtures, f.file), 'utf8')));
                } catch (e) {
                    return false;
                }
            }).length;
        }
        const detected = s.fail > 0 && (flagged === null || flagged > 0);
        const firstOps = {};
        for (const f of s.failures) {
            firstOps[f.op] = (firstOps[f.op] || 0) + 1;
        }
        report.mutants.push({
            name: m.name,
            description: m.description,
            detected,
            failing_fixtures: s.fail,
            must_flag: m.mustFlag ? { what: m.mustFlag.what, failing: flagged } : undefined,
            harness_errors: s.harness_error,
            by_op: firstOps,
            example: s.failures[0] ? { file: s.failures[0].file, detail: s.failures[0].detail } : null,
        });
        out(`${detected ? 'DETECTED' : 'ERROR MISSED'} ${m.name}: ${s.fail} fixtures fail` + (m.mustFlag ? ` (${flagged} of them ${m.mustFlag.what})` : ''));
    }

    // Harness checks: missing blob and missing inputs must be harness errors.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'oracle-selfcheck-'));
    try {
        const all = listFixtures(fixtures);
        const withBlob = all.find((f) => fs.readFileSync(f, 'utf8').includes('"@@oracle":"blob"') && JSON.parse(fs.readFileSync(f, 'utf8')).inputs && JSON.stringify(JSON.parse(fs.readFileSync(f, 'utf8')).inputs).includes('"@@oracle":"blob"'));
        const emptyStore = blobStore(path.join(tmp, 'no-blobs'));
        if (withBlob) {
            const v = await judgeFile(withBlob, ref, emptyStore);
            report.harness_checks.push({ check: 'fixture input blob missing', fixture: path.relative(fixtures, withBlob), verdict: v.status, ok: v.status === 'harness-error' });
        }
        const fx = JSON.parse(fs.readFileSync(all[0], 'utf8'));
        delete fx.inputs;
        const noInputs = path.join(tmp, 'no-inputs.json');
        fs.writeFileSync(noInputs, JSON.stringify(fx));
        const v2 = await judgeFile(noInputs, ref, store);
        report.harness_checks.push({ check: 'fixture without inputs', verdict: v2.status, ok: v2.status === 'harness-error' });
        const v3 = await judgeFile(path.join(tmp, 'does-not-exist.json'), ref, store);
        report.harness_checks.push({ check: 'fixture file missing', verdict: v3.status, ok: v3.status === 'harness-error' });
        const fx4 = JSON.parse(fs.readFileSync(all[0], 'utf8'));
        fx4.inputs = { args: [{ [M]: 'blob', sha256: '0'.repeat(64) }] };
        const badRef = path.join(tmp, 'bad-ref.json');
        fs.writeFileSync(badRef, JSON.stringify(fx4));
        const v4 = await judgeFile(badRef, ref, store);
        report.harness_checks.push({ check: 'fixture references unknown blob', verdict: v4.status, ok: v4.status === 'harness-error' });
        // task accordproject/concerto-rust#94: an async fixture whose network
        // response is malformed must not replay at all.
        const withNet = all.find((f) => {
            const x = JSON.parse(fs.readFileSync(f, 'utf8'));
            return x.inputs && x.inputs.net && typeof x.inputs.net === 'object' && !x.inputs.net[M] && Object.keys(x.inputs.net).length > 0;
        });
        if (withNet) {
            const fx5 = JSON.parse(fs.readFileSync(withNet, 'utf8'));
            fx5.inputs.net[Object.keys(fx5.inputs.net)[0]] = { status: 200 };
            const noNet = path.join(tmp, 'no-net.json');
            fs.writeFileSync(noNet, JSON.stringify(fx5));
            const v5 = await judgeFile(noNet, ref, store);
            report.harness_checks.push({ check: 'async fixture with a malformed network response', fixture: path.relative(fixtures, withNet), verdict: v5.status, ok: v5.status === 'harness-error' });
        }
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
    for (const h of report.harness_checks) {
        out(`${h.ok ? 'OK' : 'ERROR'} harness check: ${h.check} -> ${h.verdict}`);
    }

    report.all_mutants_detected = report.mutants.every((m) => m.detected);
    report.harness_checks_ok = report.harness_checks.length >= 3 && report.harness_checks.every((h) => h.ok);
    if (reportFile) {
        fs.writeFileSync(reportFile, JSON.stringify(report, null, 1) + '\n');
    }
    process.exitCode = report.all_mutants_detected && report.harness_checks_ok && base.pass === base.total ? 0 : 1;
})().catch((e) => {
    out('ERROR self-check: ' + (e && e.stack || e));
    process.exitCode = 1;
});
