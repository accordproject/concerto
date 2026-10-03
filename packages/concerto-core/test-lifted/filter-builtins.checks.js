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
 * P5-108 lifted checks (accordproject/concerto-rust#466, BC-53):
 * `ModelManager.filter` keeps the models the filtered manager holds from its
 * constructor (the decorator and root models, and the metamodel under
 * `addMetamodel`) whole, and never adds the source's copies again.
 *
 * v5.0.0 skipped only the root model, so any predicate that kept a
 * declaration of the decorator model, `filter(() => true)` included, threw
 * `Namespace concerto.decorator@1.0.0 … is already declared`. Each check
 * that v5.0.0 fails has that outcome as its `reference`; `expect` is the
 * workspace outcome. Every check runs with `strict: true` and
 * `strict: false`.
 *
 * Run by fallbacks.spec.js.
 */

const DECORATOR_NS = 'concerto.decorator@1.0.0';
const ROOT_NS = 'concerto@1.0.0';
const METAMODEL_NS = 'concerto.metamodel@1.0.0';
const USER_NS = 'org.acme.p5108@1.0.0';
const OTHER_NS = 'org.acme.p5108.other@1.0.0';

const USER = `namespace ${USER_NS}
import ${DECORATOR_NS}.Decorator
concept Tag extends Decorator { o String label optional }
@Tag("x")
concept Thing { o String name }
`;

const OTHER = `namespace ${OTHER_NS}
import ${USER_NS}.Thing
concept Other { o Thing thing }
`;

/** v5.0.0's outcome for a filter that keeps a decorator-model declaration. */
const DUPLICATE = {
    throws: {
        name: 'Error',
        message: `Namespace ${DECORATOR_NS} specified in file concerto_decorator_1.0.0.cto is already declared in file concerto_decorator_1.0.0.cto`,
    },
};

/** The decorator model's declarations, in order. */
const DECORATOR_DECLS = ['Decorator', 'DotNetNamespace'];

/** The root model's declarations, in order. */
const ROOT_DECLS = ['Concept', 'Asset', 'Participant', 'Transaction', 'Event'];

/**
 * A manager holding USER and OTHER.
 * @param {object} core the core under test
 * @param {object} options the model manager options
 * @returns {object} the model manager
 */
function base(core, options) {
    const mm = new core.ModelManager(options);
    mm.addCTOModel(USER, 'user.cto');
    mm.addCTOModel(OTHER, 'other.cto');
    return mm;
}

/**
 * Each model file's namespace and declaration names, in order.
 * @param {object} mm the model manager
 * @returns {Array} `[namespace, names]` pairs
 */
function shape(mm) {
    return mm.getModelFiles(true).map((mf) => [mf.getNamespace(), mf.getAllDeclarations().map((d) => d.getName())]);
}

/**
 * Whether two managers hold the same model files: namespaces, declarations,
 * ASTs (built-in models included) and file names. (A filtered user file has
 * no definitions, as in v5.0.0, so they are not compared.)
 * @param {object} a a model manager
 * @param {object} b a model manager
 * @returns {boolean} true if they do
 */
function same(a, b) {
    const files = (mm) => mm.getModelFiles(true).map((mf) => [mf.getNamespace(), mf.getName(), mf.getAst()]);
    return JSON.stringify(shape(a)) === JSON.stringify(shape(b)) &&
        JSON.stringify(files(a)) === JSON.stringify(files(b)) &&
        JSON.stringify(a.getAst(false, true)) === JSON.stringify(b.getAst(false, true));
}

const checks = [];

for (const strict of [true, false]) {
    const tag = strict ? 'strict' : 'nonstrict';
    const options = { strict };
    checks.push(
        {
            id: `FILTER-BI-01-${tag}`,
            covers: `BC-53: filter(() => true) returns a manager with the source's namespaces, declarations and ASTs (strict: ${strict})`,
            run: (core) => {
                const mm = base(core, options);
                const filtered = mm.filter(() => true);
                filtered.validateModelFiles();
                return {
                    same: same(mm, filtered),
                    namespaces: filtered.getNamespaces(),
                    other: filtered.getType(`${OTHER_NS}.Other`).getProperty('thing').getFullyQualifiedTypeName(),
                };
            },
            expect: {
                ok: {
                    same: true,
                    namespaces: [DECORATOR_NS, ROOT_NS, USER_NS, OTHER_NS],
                    other: `${USER_NS}.Thing`,
                },
            },
            reference: DUPLICATE,
        },
        {
            id: `FILTER-BI-02-${tag}`,
            covers: `BC-53: a predicate keeping a user type that extends Decorator works (strict: ${strict})`,
            run: (core) => {
                const mm = base(core, options);
                const filtered = mm.filter((d) => d.getNamespace() !== OTHER_NS);
                const instance = filtered.getSerializer().fromJSON({ $class: `${USER_NS}.Tag`, label: 'l' });
                return {
                    shape: shape(filtered),
                    superType: filtered.getType(`${USER_NS}.Tag`).getSuperType(),
                    decorators: filtered.getType(`${USER_NS}.Thing`).getDecorators().map((d) => [d.getName(), d.getArguments()]),
                    instance: filtered.getSerializer().toJSON(instance),
                };
            },
            expect: {
                ok: {
                    shape: [[DECORATOR_NS, DECORATOR_DECLS], [ROOT_NS, ROOT_DECLS], [USER_NS, ['Tag', 'Thing']]],
                    superType: `${DECORATOR_NS}.Decorator`,
                    decorators: [['Tag', ['x']]],
                    instance: { $class: `${USER_NS}.Tag`, label: 'l' },
                },
            },
            reference: DUPLICATE,
        },
        {
            id: `FILTER-BI-03-${tag}`,
            covers: `BC-53: a predicate that drops everything returns just the built-in models, kept whole, as v5.0.0 does (strict: ${strict})`,
            run: (core) => {
                const mm = base(core, options);
                const seen = [];
                const filtered = mm.filter((d) => {
                    seen.push(d.getNamespace());
                    return false;
                });
                return { shape: shape(filtered), userOnly: seen.every((ns) => ns === USER_NS || ns === OTHER_NS) };
            },
            expect: {
                ok: {
                    shape: [[DECORATOR_NS, DECORATOR_DECLS], [ROOT_NS, ROOT_DECLS]],
                    userOnly: true,
                },
            },
            // v5.0.0 also calls the predicate on the decorator model's
            // declarations.
            reference: {
                ok: {
                    shape: [[DECORATOR_NS, DECORATOR_DECLS], [ROOT_NS, ROOT_DECLS]],
                    userOnly: false,
                },
            },
        },
        {
            id: `FILTER-BI-04-${tag}`,
            covers: `BC-53: the decorator model is kept whole whatever the predicate says about its declarations (strict: ${strict})`,
            run: (core) => {
                const mm = base(core, options);
                return {
                    decoratorOnly: shape(mm.filter((d) => d.getNamespace() === DECORATOR_NS)),
                    oneDecl: shape(mm.filter((d) => d.getFullyQualifiedName() === `${DECORATOR_NS}.DotNetNamespace`)),
                };
            },
            expect: {
                ok: {
                    decoratorOnly: [[DECORATOR_NS, DECORATOR_DECLS], [ROOT_NS, ROOT_DECLS]],
                    oneDecl: [[DECORATOR_NS, DECORATOR_DECLS], [ROOT_NS, ROOT_DECLS]],
                },
            },
            reference: DUPLICATE,
        },
        {
            id: `FILTER-BI-05-${tag}`,
            covers: `BC-53: the filtered manager keeps metamodelValidation (strict: ${strict})`,
            run: (core) => [true, false, undefined].map((metamodelValidation) => {
                const mm = base(core, { ...options, metamodelValidation });
                const filtered = mm.filter(() => true);
                // An AST with a key the metamodel does not declare: the
                // metamodel check rejects it unless `metamodelValidation` is
                // `false`, when the loader's own read rejects it instead.
                // Loading it in the filtered manager must fail exactly as in
                // the source.
                const load = (manager) => {
                    const ast = JSON.parse(JSON.stringify(mm.getModelFile(USER_NS).getAst()));
                    ast.namespace = 'org.acme.p5108.mmv@1.0.0';
                    ast.declarations[1].unknownKey = 1;
                    try {
                        manager.addModelFile(new core.ModelFile(manager, ast, undefined, 'mmv.json'), undefined, 'mmv.json');
                        return 'loaded';
                    } catch (e) {
                        return [e.constructor.name, e.message];
                    }
                };
                const outcome = load(filtered);
                return [filtered.options.metamodelValidation ?? '<unset>', outcome !== 'loaded', JSON.stringify(outcome) === JSON.stringify(load(mm))];
            }),
            expect: { ok: [[true, true, true], [false, true, true], ['<unset>', true, true]] },
            reference: DUPLICATE,
        },
        {
            id: `FILTER-BI-06-${tag}`,
            covers: `BC-53: under addMetamodel the filtered manager's own metamodel is kept and the source's is not added again (strict: ${strict})`,
            run: (core) => {
                const mm = new core.ModelManager({ ...options, addMetamodel: true });
                mm.addCTOModel(`namespace ${OTHER_NS}\nconcept Plain { o String s }\n`, 'plain.cto');
                const metamodel = (manager) => shape(manager).find(([ns]) => ns === METAMODEL_NS)[1];
                const kept = mm.filter((d) => d.getNamespace() !== DECORATOR_NS);
                return {
                    namespaces: kept.getNamespaces(),
                    metamodelWhole: JSON.stringify(metamodel(kept)) === JSON.stringify(metamodel(mm)),
                    none: mm.filter(() => false).getNamespaces(),
                };
            },
            expect: {
                ok: {
                    namespaces: [DECORATOR_NS, ROOT_NS, METAMODEL_NS, OTHER_NS],
                    metamodelWhole: true,
                    none: [DECORATOR_NS, ROOT_NS, METAMODEL_NS],
                },
            },
            reference: {
                throws: {
                    name: 'Error',
                    message: `Namespace ${METAMODEL_NS} specified in file ${METAMODEL_NS} is already declared in file ${METAMODEL_NS}`,
                },
            },
        },
    );
}

module.exports = checks;
