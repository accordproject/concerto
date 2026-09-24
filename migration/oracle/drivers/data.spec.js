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
 * Corpus driver (b): every model / instance fixture under
 * packages/concerto-core/test/data and test/1.0.0, driven through the public
 * API of concerto-core src/ while the recorder is active
 * (ORACLE_SOURCE=data). Outcomes are whatever the reference does; this driver
 * never asserts, it only exercises.
 */

const fs = require('fs');
const path = require('path');
const { CORE_PKG_DIR, SRC_ROOT } = require('../lib/core');

const S = (m) => require(path.join(SRC_ROOT, m));
const { ModelManager } = S('modelmanager');
const { Factory } = S('factory');
const { Serializer } = S('serializer');
const { DecoratorManager } = S('decoratormanager');
const MetaModel = S('introspect/metamodel');
const DcsConverter = S('dcsconverter');

const TEST_DIR = path.join(CORE_PKG_DIR, 'test');
const ROOTS = ['data', '1.0.0'].map((d) => path.join(TEST_DIR, d));

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

const rel = (p) => path.relative(CORE_PKG_DIR, p);
const attempt = (f) => {
    try {
        return f();
    } catch (e) {
        return undefined;
    }
};

const files = ROOTS.flatMap(walk);
const ctoFiles = files.filter((f) => f.endsWith('.cto'));
const byDir = new Map();
for (const f of ctoFiles) {
    const d = path.dirname(f);
    byDir.set(d, [...(byDir.get(d) || []), f]);
}
const jsonFiles = files.filter((f) => /\.(json|expect)$/.test(f));
const yamlFiles = files.filter((f) => /\.ya?ml$/.test(f));
const readJson = (f) => attempt(() => JSON.parse(fs.readFileSync(f, 'utf8')));
const text = (f) => fs.readFileSync(f, 'utf8');

/**
 * Exercise instance creation and (de)serialisation for every type of a model manager.
 * @param {object} mm model manager
 */
function exerciseTypes(mm) {
    const factory = new Factory(mm);
    const serializer = new Serializer(factory, mm);
    const decls = attempt(() => mm.getModelFiles().flatMap((mf) => mf.getAllDeclarations())) || [];
    for (const d of decls) {
        const fqn = d.getFullyQualifiedName();
        attempt(() => mm.getType(fqn));
        if (typeof d.isClassDeclaration !== 'function' || !d.isClassDeclaration() || d.isEnum()) {
            continue;
        }
        for (const generate of ['sample', 'empty']) {
            for (const includeOptionalFields of [true, false]) {
                const id = d.isIdentified() && !d.isSystemIdentified() ? 'id1' : undefined;
                const r = attempt(() => factory.newResource(d.getNamespace(), d.getName(), id, { generate, includeOptionalFields }));
                if (!r) {
                    continue;
                }
                const json = attempt(() => serializer.toJSON(r));
                if (json) {
                    attempt(() => serializer.fromJSON(json));
                    attempt(() => serializer.fromJSON(json, { strictQualifiedDateTimes: true }));
                }
                attempt(() => serializer.toJSON(r, { utcOffset: 60 }));
            }
        }
    }
}

describe('oracle data driver', function () {
    this.timeout(600000);

    describe('single CTO files', () => {
        for (const f of ctoFiles) {
            it(`${rel(f)}`, () => {
                const cto = text(f);
                const mm = new ModelManager();
                const mf = attempt(() => mm.addCTOModel(cto, rel(f)));
                if (mf) {
                    attempt(() => mm.getAst(true));
                    attempt(() => mm.getModels());
                    exerciseTypes(mm);
                }
                const mm2 = new ModelManager();
                if (attempt(() => mm2.addCTOModel(cto, rel(f), true))) {
                    attempt(() => mm2.validateModelFiles());
                }
                const mm3 = new ModelManager({ metamodelValidation: true, addMetamodel: true });
                attempt(() => mm3.addCTOModel(cto, rel(f)));
                const mm4 = new ModelManager({ strict: true, enableMapType: true, importAliasing: true });
                attempt(() => mm4.addCTOModel(cto, rel(f)));
            });
        }
    });

    describe('CTO files per directory', () => {
        for (const [dir, list] of byDir) {
            if (list.length < 2) {
                continue;
            }
            it(`${rel(dir)}/*.cto`, () => {
                const mm = new ModelManager();
                const ok = attempt(() => mm.addModelFiles(list.map(text), list.map(rel)));
                if (ok) {
                    attempt(() => mm.getAst(true));
                    exerciseTypes(mm);
                }
                const mm2 = new ModelManager();
                if (attempt(() => mm2.addModelFiles(list.map(text), list.map(rel), true))) {
                    attempt(() => mm2.validateModelFiles());
                }
            });
        }
    });

    describe('JSON files', () => {
        for (const f of jsonFiles) {
            const json = readJson(f);
            if (!json || typeof json !== 'object') {
                continue;
            }
            it(`${rel(f)}`, () => {
                const cls = json.$class || '';
                if (cls === 'concerto.metamodel@1.0.0.Models') {
                    attempt(() => MetaModel.validateMetaModel(json));
                    attempt(() => MetaModel.modelManagerFromMetaModel(json));
                    attempt(() => MetaModel.modelManagerFromMetaModel(json, false));
                    const mm = new ModelManager();
                    attempt(() => mm.fromAst(json));
                    exerciseTypes(mm);
                } else if (cls === 'concerto.metamodel@1.0.0.Model') {
                    attempt(() => MetaModel.validateMetaModel({ $class: 'concerto.metamodel@1.0.0.Models', models: [json] }));
                    const mm = new ModelManager();
                    if (attempt(() => mm.addModel(json))) {
                        exerciseTypes(mm);
                    }
                    const mm2 = new ModelManager({ metamodelValidation: true });
                    attempt(() => mm2.addModel(json));
                } else if (cls.startsWith('org.accordproject.decoratorcommands') || Array.isArray(json)) {
                    attempt(() => DecoratorManager.validate(json));
                    attempt(() => DecoratorManager.jsonToYaml(json));
                    attempt(() => DcsConverter.jsonToYaml(json));
                    for (const cto of byDir.get(path.dirname(f)) || []) {
                        const mm = new ModelManager();
                        if (!attempt(() => mm.addCTOModel(text(cto), rel(cto)))) {
                            continue;
                        }
                        attempt(() => DecoratorManager.decorateModels(mm, json));
                        attempt(() => DecoratorManager.decorateModels(mm, json, { validate: true, validateCommands: true }));
                        attempt(() => DecoratorManager.decorateModels(mm, json, { validate: true, migrate: true }));
                    }
                } else if (cls) {
                    // An instance: try it against the models of its directory and of ../models.
                    const candidates = [path.dirname(f), path.join(path.dirname(f), '..', 'models')]
                        .map((d) => path.resolve(d)).filter((d) => byDir.has(d));
                    for (const d of candidates) {
                        for (const cto of byDir.get(d)) {
                            const mm = new ModelManager();
                            if (!attempt(() => mm.addCTOModel(text(cto), rel(cto)))) {
                                continue;
                            }
                            const serializer = new Serializer(new Factory(mm), mm);
                            for (const options of [undefined, { utcOffset: 0 }, { strictQualifiedDateTimes: true }]) {
                                const r = attempt(() => serializer.fromJSON(json, options));
                                if (r) {
                                    attempt(() => serializer.toJSON(r, options));
                                    attempt(() => r.validate());
                                }
                            }
                        }
                    }
                }
            });
        }
    });

    describe('decorator extraction', () => {
        const dcsDirs = [...byDir.keys()].filter((d) => /decorator/.test(d));
        for (const d of dcsDirs) {
            for (const cto of byDir.get(d)) {
                it(`${rel(cto)}`, () => {
                    const mm = new ModelManager();
                    if (!attempt(() => mm.addCTOModel(text(cto), rel(cto)))) {
                        return;
                    }
                    for (const removeDecoratorsFromModel of [true, false]) {
                        attempt(() => DecoratorManager.extractDecorators(mm, { removeDecoratorsFromModel, locale: 'en' }));
                        attempt(() => DecoratorManager.extractVocabularies(mm, { removeDecoratorsFromModel, locale: 'en' }));
                        attempt(() => DecoratorManager.extractNonVocabDecorators(mm, { removeDecoratorsFromModel, locale: 'en' }));
                    }
                });
            }
        }
    });

    describe('YAML files', () => {
        for (const f of yamlFiles) {
            it(`${rel(f)}`, () => {
                const y = text(f);
                attempt(() => DecoratorManager.yamlToJson(y));
                attempt(() => DcsConverter.yamlToJson(y));
            });
        }
    });
});
