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
 */

process.env.TZ = 'UTC';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { replayCorpus, listFixtures, judgeFile } = require('../lib/judge');
const { blobStore } = require('../lib/store');
const { referenceAdapter } = require('../lib/adapter');
const { M } = require('../lib/codec');

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
            return { outcome: rewrite(op, JSON.parse(JSON.stringify(res.outcome))), window: res.window };
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
            try {
                return ref.run(op, inputs);
            } finally {
                uninstall();
            }
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
];

const report = { fixtures: path.relative(ORACLE_DIR, fixtures), baseline: null, mutants: [], harness_checks: [] };

// Baseline: the unmutated reference must agree on everything.
const base = replayCorpus(fixtures, ref, store);
report.baseline = { total: base.total, pass: base.pass, fail: base.fail, harness_error: base.harness_error };
out(`baseline reference: ${base.pass}/${base.total} pass, ${base.fail} fail, ${base.harness_error} harness errors`);

for (const m of MUTANTS) {
    const s = replayCorpus(fixtures, m.adapter, store);
    const detected = s.fail > 0;
    const firstOps = {};
    for (const f of s.failures) {
        firstOps[f.op] = (firstOps[f.op] || 0) + 1;
    }
    report.mutants.push({
        name: m.name,
        description: m.description,
        detected,
        failing_fixtures: s.fail,
        harness_errors: s.harness_error,
        by_op: firstOps,
        example: s.failures[0] ? { file: s.failures[0].file, detail: s.failures[0].detail } : null,
    });
    out(`${detected ? 'DETECTED' : 'ERROR MISSED'} ${m.name}: ${s.fail} fixtures fail`);
}

// Harness checks: missing blob and missing inputs must be harness errors.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'oracle-selfcheck-'));
try {
    const all = listFixtures(fixtures);
    const withBlob = all.find((f) => fs.readFileSync(f, 'utf8').includes('"@@oracle":"blob"') && JSON.parse(fs.readFileSync(f, 'utf8')).inputs && JSON.stringify(JSON.parse(fs.readFileSync(f, 'utf8')).inputs).includes('"@@oracle":"blob"'));
    const emptyStore = blobStore(path.join(tmp, 'no-blobs'));
    if (withBlob) {
        const v = judgeFile(withBlob, ref, emptyStore);
        report.harness_checks.push({ check: 'fixture input blob missing', fixture: path.relative(fixtures, withBlob), verdict: v.status, ok: v.status === 'harness-error' });
    }
    const fx = JSON.parse(fs.readFileSync(all[0], 'utf8'));
    delete fx.inputs;
    const noInputs = path.join(tmp, 'no-inputs.json');
    fs.writeFileSync(noInputs, JSON.stringify(fx));
    const v2 = judgeFile(noInputs, ref, store);
    report.harness_checks.push({ check: 'fixture without inputs', verdict: v2.status, ok: v2.status === 'harness-error' });
    const v3 = judgeFile(path.join(tmp, 'does-not-exist.json'), ref, store);
    report.harness_checks.push({ check: 'fixture file missing', verdict: v3.status, ok: v3.status === 'harness-error' });
    const fx4 = JSON.parse(fs.readFileSync(all[0], 'utf8'));
    fx4.inputs = { args: [{ [M]: 'blob', sha256: '0'.repeat(64) }] };
    const badRef = path.join(tmp, 'bad-ref.json');
    fs.writeFileSync(badRef, JSON.stringify(fx4));
    const v4 = judgeFile(badRef, ref, store);
    report.harness_checks.push({ check: 'fixture references unknown blob', verdict: v4.status, ok: v4.status === 'harness-error' });
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
