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
 * P5-31 lifted checks (accordproject/concerto-rust#341): a metamodel file a
 * user adds to a ModelManager (`newMetaModelManager()`, or `addModelFile` of
 * a `concerto.metamodel@1.0.0` ModelFile) is mirrored into the engine like
 * any other namespace. Before P5-31, `_needsRustWrite` excluded the
 * metamodel namespace, so such a manager's mirror never held it: the
 * namespace-set parity check stayed false for good, and every read on the
 * manager silently ran through the TS bodies.
 *
 * Each check drives the manager through the public API and returns what
 * v5.0.0 returns, plus `engine`: whether the manager's mirror is in parity
 * (`_rustHandleMatchesModelFiles()`, the gate of every manager read) and
 * whether the metamodel ModelFile's own reads go to Rust (`_rustHandleId()`
 * is defined). The frozen v5.0.0 reference has no engine, so there `engine`
 * answers true, which is what `expect` pins: against `src` a manager that
 * falls back to TS fails the check. Run by fallbacks.spec.js.
 */

const METAMODEL = 'concerto.metamodel@1.0.0';
const USER_CTO = `namespace org.acme.p531@1.0.0\nimport ${METAMODEL}.{Model}\nconcept Holder {\n  o Model model\n}\n`;

/**
 * Whether `mm`'s reads go to Rust: its mirror is in parity and, when
 * `file` is given, that file's reads go to Rust too. True on an engine-less
 * core (the v5.0.0 reference).
 * @param {object} mm the ModelManager
 * @param {object} [file] a ModelFile registered in `mm`
 * @returns {boolean} true if the reads go to Rust
 */
function engine(mm, file) {
    if (typeof mm._rustHandleMatchesModelFiles !== 'function') {
        return true;
    }
    const parity = mm._rustHandleMatchesModelFiles();
    if (!file) {
        return parity;
    }
    return parity && file._rustHandleId() !== undefined;
}

/**
 * The outcome of `fn()` as plain data: its value, or `<Class>: <message>`.
 * @param {Function} fn the call
 * @returns {*} the value or the error text
 */
function attempt(fn) {
    try {
        const v = fn();
        return v === undefined ? '<undefined>' : v;
    } catch (e) {
        return `${e.constructor.name}: ${e.message}`;
    }
}

/**
 * Reads over the metamodel namespace that each take the manager's Rust
 * path when its mirror is in parity.
 * @param {object} mm the ModelManager
 * @returns {object} the answers
 */
function reads(mm) {
    return {
        namespaces: mm.getNamespaces(),
        model: attempt(() => mm.getType(`${METAMODEL}.Model`).getFullyQualifiedName()),
        derives: attempt(() => mm.derivesFrom(`${METAMODEL}.ConceptDeclaration`, `${METAMODEL}.Declaration`)),
        assignable: attempt(() => mm.isAssignableTo(`${METAMODEL}.ConceptDeclaration`, `${METAMODEL}.Declaration`)),
        resolved: attempt(() => mm.resolveType('org.acme.p531@1.0.0', `${METAMODEL}.Model`)),
        missing: attempt(() => mm.getType(`${METAMODEL}.Nowhere`)),
    };
}

const checks = [
    {
        id: 'MM-MIRROR-001',
        covers: 'newMetaModelManager(): the metamodel file it adds is mirrored, so its manager and the file answer reads from Rust',
        run: (core) => {
            const mm = core.metaModelModule.newMetaModelManager();
            const file = mm.getModelFile(METAMODEL);
            return {
                namespaces: mm.getNamespaces(),
                model: mm.getType(`${METAMODEL}.Model`).getFullyQualifiedName(),
                byFileName: mm.getModelFileByFileName('concerto.metamodel').getNamespace(),
                fileType: file.getType('Model').getFullyQualifiedName(),
                version: file.getVersion(),
                engine: engine(mm, file),
            };
        },
        expect: {
            ok: {
                namespaces: ['concerto.decorator@1.0.0', 'concerto@1.0.0', METAMODEL],
                model: `${METAMODEL}.Model`,
                byFileName: METAMODEL,
                fileType: `${METAMODEL}.Model`,
                version: '1.0.0',
                engine: true,
            },
        },
    },
    {
        id: 'MM-MIRROR-002',
        covers: 'addModelFile of a user-built metamodel ModelFile on a plain manager: mirrored, a model importing it validates and resolves in Rust, and an update and deletes keep the mirror in parity',
        run: (core) => {
            const source = core.metaModelModule.newMetaModelManager().getModelFile(METAMODEL);
            const mm = new core.ModelManager();
            const file = new core.ModelFile(mm, source.getAst(), source.getDefinitions(), 'metamodel.cto');
            mm.addModelFile(file, source.getDefinitions(), 'metamodel.cto');
            const afterAdd = engine(mm, file);
            mm.addCTOModel(USER_CTO, 'p531.cto');
            const added = reads(mm);
            const holder = mm.getType('org.acme.p531@1.0.0.Holder').getProperty('model').getFullyQualifiedTypeName();
            const afterUser = engine(mm, file);
            const replacement = new core.ModelFile(mm, source.getAst(), source.getDefinitions(), 'metamodel2.cto');
            mm.updateModelFile(replacement, 'metamodel2.cto');
            const updated = {
                fileName: mm.getModelFile(METAMODEL).getName(),
                engine: engine(mm, replacement),
            };
            mm.deleteModelFile('org.acme.p531@1.0.0');
            mm.deleteModelFile(METAMODEL);
            const deleted = {
                namespaces: mm.getNamespaces(),
                model: attempt(() => mm.getType(`${METAMODEL}.Model`)),
                engine: engine(mm),
            };
            return { afterAdd, added, holder, afterUser, updated, deleted };
        },
        expect: {
            ok: {
                afterAdd: true,
                added: {
                    namespaces: ['concerto.decorator@1.0.0', 'concerto@1.0.0', METAMODEL, 'org.acme.p531@1.0.0'],
                    model: `${METAMODEL}.Model`,
                    derives: true,
                    assignable: true,
                    resolved: `${METAMODEL}.Model`,
                    missing: `TypeNotFoundException: Type "Nowhere" is not defined in namespace "${METAMODEL}".`,
                },
                holder: `${METAMODEL}.Model`,
                afterUser: true,
                updated: { fileName: 'metamodel2.cto', engine: true },
                deleted: {
                    namespaces: ['concerto.decorator@1.0.0', 'concerto@1.0.0'],
                    model: `TypeNotFoundException: Namespace is not defined for type "${METAMODEL}.Model".`,
                    engine: true,
                },
            },
        },
    },
    {
        id: 'MM-MIRROR-003',
        covers: 'addMetamodel: true, then deleting the metamodel: the delete reaches the mirror too, so it stays in parity',
        run: (core) => {
            const mm = new core.ModelManager({ addMetamodel: true });
            const before = { namespaces: mm.getNamespaces(), engine: engine(mm, mm.getModelFile(METAMODEL)) };
            mm.deleteModelFile(METAMODEL);
            return {
                before,
                after: { namespaces: mm.getNamespaces(), engine: engine(mm) },
            };
        },
        expect: {
            ok: {
                before: { namespaces: ['concerto.decorator@1.0.0', 'concerto@1.0.0', METAMODEL], engine: true },
                after: { namespaces: ['concerto.decorator@1.0.0', 'concerto@1.0.0'], engine: true },
            },
        },
    },
];

module.exports = checks;
