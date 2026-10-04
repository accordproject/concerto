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
 * Corpus driver (c): every AST / model / instance fixture of
 * concerto-conformance, driven through concerto-core src/ with the recorder
 * active (ORACLE_SOURCE=conformance).
 *
 * 1. Each semantic scenario is replayed exactly as the JavaScript step
 *    definitions do it (semantic/features/support/Javascript/steps.ts):
 *    new ModelManager(); new ModelFile(mm, ast, undefined, path);
 *    addModelFile(mf, null, name, true); and validateModelFiles() for
 *    "When I validate the models". Every scenario is then also validated.
 * 2. Every AST JSON and CTO file under semantic/specifications is loaded on
 *    its own with validation.
 * 3. Each instance scenario of validate/features runs the step definition
 *    flow (validate/validateSteps.js): ModelLoader, fromJSON, toJSON.
 *
 * CONFORMANCE_DIR overrides the checkout location.
 */

const fs = require('fs');
const path = require('path');
const { SRC_ROOT } = require('../lib/core');

const S = (m) => require(path.join(SRC_ROOT, m));
const { ModelManager } = S('modelmanager');
const { ModelFile } = S('introspect/modelfile');
const { Factory } = S('factory');
const { Serializer } = S('serializer');
const { ModelLoader } = S('modelloader');

const ROOT = process.env.CONFORMANCE_DIR || '/home/user/concerto-conformance';
const SPEC_DIR = path.join(ROOT, 'semantic', 'specifications');

const attempt = (f) => {
    try {
        return f();
    } catch (e) {
        return undefined;
    }
};

/**
 * @param {string} dir directory
 * @returns {string[]} files, sorted
 */
function walk(dir) {
    const out = [];
    for (const f of fs.readdirSync(dir).sort()) {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) {
            out.push(...walk(p));
        } else {
            out.push(p);
        }
    }
    return out;
}

/**
 * Minimal Gherkin reader for the step shapes used by concerto-conformance.
 * @param {string} file feature file
 * @returns {object[]} scenarios {name, steps: [{text, table}]}
 */
function readFeature(file) {
    const scenarios = [];
    let cur = null;
    let lastStep = null;
    for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        const line = raw.trim();
        if (line.startsWith('Scenario')) {
            cur = { name: line.replace(/^Scenario( Outline)?:\s*/, ''), steps: [] };
            scenarios.push(cur);
            lastStep = null;
        } else if (cur && /^(Given|When|Then|And|But)\b/.test(line)) {
            lastStep = { text: line.replace(/^(Given|When|Then|And|But)\s+/, ''), table: [] };
            cur.steps.push(lastStep);
        } else if (cur && lastStep && line.startsWith('|')) {
            lastStep.table.push(line.split('|').slice(1, -1).map((c) => c.trim()));
        }
    }
    return scenarios;
}

describe('oracle conformance driver', function () {
    this.timeout(600000);

    describe('semantic scenarios', () => {
        const features = walk(path.join(ROOT, 'semantic', 'features')).filter((f) => f.endsWith('.feature'));
        for (const feature of features) {
            for (const sc of readFeature(feature)) {
                it(`${path.basename(feature)}: ${sc.name}`, () => {
                    const mm = new ModelManager();
                    for (const step of sc.steps) {
                        if (step.text.startsWith('I load the following models')) {
                            const [header, ...rows] = step.table;
                            const col = header.indexOf('model_file');
                            for (const row of rows) {
                                const file = path.join(SPEC_DIR, row[col]);
                                if (!fs.existsSync(file)) {
                                    break;
                                }
                                const ast = JSON.parse(fs.readFileSync(file, 'utf8'));
                                const mf = attempt(() => new ModelFile(mm, ast, undefined, row[col]));
                                if (!mf || attempt(() => mm.addModelFile(mf, null, mf.getName(), true)) === undefined) {
                                    break;
                                }
                            }
                        } else if (step.text.startsWith('I validate the models')) {
                            attempt(() => mm.validateModelFiles());
                        }
                    }
                    attempt(() => mm.validateModelFiles());
                });
            }
        }
    });

    describe('specification files', () => {
        for (const f of walk(SPEC_DIR)) {
            const relName = path.relative(SPEC_DIR, f);
            if (f.endsWith('.json')) {
                it(relName, () => {
                    const ast = attempt(() => JSON.parse(fs.readFileSync(f, 'utf8')));
                    if (!ast) {
                        return;
                    }
                    attempt(() => new ModelManager().addModel(ast, undefined, relName));
                    attempt(() => new ModelManager({ metamodelValidation: true }).addModel(ast, undefined, relName));
                });
            } else if (f.endsWith('.cto')) {
                it(relName, () => {
                    const cto = fs.readFileSync(f, 'utf8');
                    attempt(() => new ModelManager().addCTOModel(cto, relName));
                    const mm = new ModelManager();
                    if (attempt(() => mm.addCTOModel(cto, relName, true))) {
                        attempt(() => mm.validateModelFiles());
                    }
                });
            }
        }
    });

    describe('instance validation scenarios', () => {
        const feature = path.join(ROOT, 'validate', 'features', 'validate.feature');
        const scenarios = fs.existsSync(feature) ? readFeature(feature) : [];
        for (const sc of scenarios) {
            for (const step of sc.steps) {
                const m = step.text.match(/^I validate "([^"]+)" with models "([^"]+)"( and options:)?/);
                if (!m) {
                    continue;
                }
                it(`validate.feature: ${sc.name}`, async () => {
                    const json = JSON.parse(fs.readFileSync(path.join(ROOT, m[1]), 'utf8'));
                    let modelManager;
                    try {
                        modelManager = await ModelLoader.loadModelManager([path.join(ROOT, m[2])], { offline: true });
                    } catch (e) {
                        return;
                    }
                    const factory = new Factory(modelManager);
                    const serializer = new Serializer(factory, modelManager);
                    const options = {};
                    if (m[3]) {
                        for (const [k, v] of step.table) {
                            options[k] = isNaN(v) ? v : Number(v);
                        }
                    }
                    const object = attempt(() => serializer.fromJSON(json, options));
                    if (object) {
                        attempt(() => serializer.toJSON(object, options));
                    }
                });
            }
        }
    });

    describe('instance files against every model of their directory', () => {
        const dir = path.join(ROOT, 'validate', 'models');
        const files = fs.existsSync(dir) ? walk(dir) : [];
        const ctos = files.filter((f) => f.endsWith('.cto'));
        for (const jf of files.filter((f) => f.endsWith('.json'))) {
            it(path.relative(ROOT, jf), () => {
                const json = attempt(() => JSON.parse(fs.readFileSync(jf, 'utf8')));
                if (!json) {
                    return;
                }
                for (const cto of ctos.filter((c) => path.dirname(c) === path.dirname(jf))) {
                    const mm = new ModelManager();
                    if (!attempt(() => mm.addCTOModel(fs.readFileSync(cto, 'utf8'), path.relative(ROOT, cto)))) {
                        continue;
                    }
                    const serializer = new Serializer(new Factory(mm), mm);
                    const r = attempt(() => serializer.fromJSON(json));
                    if (r) {
                        attempt(() => serializer.toJSON(r));
                    }
                }
                if (json.$class && String(json.$class).startsWith('concerto.metamodel@1.0.0.Model')) {
                    attempt(() => new ModelManager().addModel(json));
                }
            });
        }
    });
});
