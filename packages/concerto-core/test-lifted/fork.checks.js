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
 * P5-97 lifted checks (accordproject/concerto-rust#448): server reuse of
 * one base ModelManager.
 *
 * - `FORK-*`: `ModelManager.fork()`, new and additive (its shape awaits the
 *   maintainer's sign-off), so v5.0.0 has none: every such check's
 *   `reference` is `'no fork'`, and `expect` is the workspace outcome. The
 *   `FORK-ISO-*` checks are the scope's isolation tests: two forks of one
 *   base, each adding a conflicting user namespace, interleaved across
 *   awaits; neither sees the other's types, and the base sees neither.
 * - `FILTER-*`: `filter`'s fast path (a file kept whole is shared with the
 *   base, not rebuilt, and is not validated again when that cannot change
 *   the outcome) must be observably identical to v5.0.0's filter: the same
 *   files, ASTs, definitions, file names, errors and order. Each `expect`
 *   is v5.0.0's own outcome, except where BC-53 (P5-108,
 *   accordproject/concerto-rust#466) changes it: FILTER-04 and FILTER-05
 *   record v5.0.0's outcome as `reference` (filter-builtins.checks.js has
 *   the rest of BC-53's checks).
 * - `CLEAR-*`: a manager's replaced engine handle is released inside the
 *   library (`clearModelFiles`, `fromAst`); the manager behaves as before.
 *
 * Run by fallbacks.spec.js.
 */

const NO_FORK = 'no fork';

const BASE_NS = 'org.acme.p597.base@1.0.0';
const USER_NS = 'org.acme.p597.user@1.0.0';

const BASE = `namespace ${BASE_NS}
abstract concept Shape { o String name }
concept Address {
  o String city
  o String zip regex=/^[0-9]{5}$/ optional
}
enum Colour { o RED o GREEN }
@Term("A person")
participant Person identified by email {
  o String email
  o Address address
  o Colour colour optional
  --> Person friend optional
}
asset Car identified by vin { o String vin o Integer seats default=4 }
`;

const OTHER = `namespace org.acme.p597.other@1.0.0
import ${BASE_NS}.{Address,Person}
concept Office { o Address address --> Person manager optional }
`;

const EMPTY = 'namespace org.acme.p597.empty@1.0.0\n';

// The filter checks' models declare no asset, participant, transaction or
// event without a super type: v5.0.0's filter writes such a declaration's
// AST with the default super type `fromAst` gave its view, and the engine's
// filter (before P5-97 too) writes the AST as loaded, without it.
const FILTER_BASE = `namespace ${BASE_NS}
abstract concept Shape { o String name }
@Term("An address")
concept Address {
  o String city
  o String zip regex=/^[0-9]{5}$/ optional
}
enum Colour { o RED o GREEN }
scalar Code extends String regex=/^[A-Z]+$/
map Labels { o String o String }
concept Person extends Shape {
  o Address address
  o Colour colour optional
  o Code code optional
  o Labels labels optional
}
concept Car { o String vin o Integer seats default=4 }
`;

const FILTER_OTHER = `namespace org.acme.p597.other@1.0.0
import ${BASE_NS}.{Address as Addr,Person}
concept Office { o Addr address o Person manager optional }
`;

/**
 * The filter checks' base manager: FILTER_BASE, FILTER_OTHER and EMPTY.
 * @param {object} core the core
 * @returns {object} the model manager
 */
function filterBase(core) {
    const mm = new core.ModelManager();
    mm.addCTOModel(FILTER_BASE, 'base.cto');
    mm.addCTOModel(FILTER_OTHER, 'other.cto');
    mm.addCTOModel(EMPTY, 'empty.cto');
    return mm;
}

/**
 * A user model for the filter checks: a concept extending Person.
 * @returns {string} the CTO
 */
function filterUserModel() {
    return `namespace ${USER_NS}
import ${BASE_NS}.{Person}
concept FromA extends Person { o String extra optional }
`;
}

/**
 * A user model in USER_NS: a participant `name` extending the base's
 * Person.
 * @param {string} name the participant's name
 * @returns {string} the CTO
 */
function userModel(name) {
    return `namespace ${USER_NS}
import ${BASE_NS}.{Person}
participant ${name} extends Person { o String ${name.toLowerCase()}Only optional }
`;
}

/**
 * The base manager: BASE, OTHER and EMPTY.
 * @param {object} core the core
 * @param {object} [options] the ModelManager options
 * @returns {object} the model manager
 */
function base(core, options) {
    const mm = new core.ModelManager(options);
    mm.addCTOModel(BASE, 'base.cto');
    mm.addCTOModel(OTHER, 'other.cto');
    mm.addCTOModel(EMPTY, 'empty.cto');
    return mm;
}

/**
 * The predicate that keeps every declaration but the decorator model's
 * (v5.0.0's `filter(() => true)` throws, adding that model twice; BC-53
 * fixes that, and these checks keep v5.0.0's predicate so that their
 * outcomes stay comparable with it).
 * @param {object} d the declaration
 * @returns {boolean} true to keep it
 */
function keepUserModels(d) {
    return !d.getFullyQualifiedName().startsWith('concerto.decorator@');
}

/**
 * Whether `mm` resolves `fqn`.
 * @param {object} mm the model manager
 * @param {string} fqn the type
 * @returns {boolean} true if it does
 */
function has(mm, fqn) {
    try {
        mm.getType(fqn);
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * What a manager holds: its user namespaces, and which of the two user
 * types it resolves.
 * @param {object} mm the model manager
 * @returns {object} the summary
 */
function holds(mm) {
    return {
        namespaces: mm.getNamespaces().filter((n) => n.startsWith('org.')),
        fromA: has(mm, `${USER_NS}.FromA`),
        fromB: has(mm, `${USER_NS}.FromB`),
    };
}

/**
 * Each model file of `mm` as `[namespace, file name, definitions?, AST]`.
 * @param {object} mm the model manager
 * @returns {Array} the files
 */
function files(mm) {
    return mm.getModelFiles(true).map((mf) => [
        mf.getNamespace(), mf.getName() ?? null, mf.getDefinitions() === undefined ? '<undefined>' : typeof mf.getDefinitions(),
        mf.isExternal(), JSON.stringify(mf.getAst()),
    ]);
}

/**
 * A short digest of `value`'s JSON text.
 * @param {*} value the value
 * @returns {string} the digest
 */
function digest(value) {
    return require('crypto').createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
}

/**
 * What `run` throws, as `[class, message]`, or `'ok'`.
 * @param {Function} run the call
 * @returns {Array|string} the outcome
 */
function thrown(run) {
    try {
        run();
        return 'ok';
    } catch (e) {
        return [e.constructor.name, e.message];
    }
}

/**
 * Lets other queued work run.
 * @returns {Promise<void>} a promise settled on a later macrotask
 */
function tick() {
    return new Promise((resolve) => setImmediate(resolve));
}

/**
 * One request of a server: forks `mm`, waits, adds its own user model,
 * waits, then validates an instance of its own type and of the other
 * request's.
 * @param {object} mm the base
 * @param {string} name the request's participant name
 * @param {string} other the other request's participant name
 * @returns {Promise<object>} what the request saw
 */
async function request(mm, name, other) {
    const fork = mm.fork();
    await tick();
    fork.addCTOModel(userModel(name), `${name}.cto`);
    await tick();
    const instance = (type) => ({
        $class: `${USER_NS}.${type}`,
        email: 'ada@example.com',
        address: { $class: `${BASE_NS}.Address`, city: 'Paris' },
    });
    const own = fork.validateInstance(instance(name));
    await tick();
    const theirs = fork.validateInstance(instance(other));
    return {
        fork: holds(fork),
        own: own.valid,
        theirs: theirs.valid ? 'valid' : theirs.errors[0].code,
        properties: fork.getType(`${USER_NS}.${name}`).getProperties().map((p) => p.getName()),
    };
}

const checks = [
    {
        id: 'FORK-ISO-01',
        covers: 'two forks of one base each add a conflicting user namespace, interleaved across awaits',
        async: true,
        run: async (core) => {
            const mm = base(core);
            if (typeof mm.fork !== 'function') {
                return NO_FORK;
            }
            const [a, b] = await Promise.all([request(mm, 'FromA', 'FromB'), request(mm, 'FromB', 'FromA')]);
            return { a, b, base: holds(mm) };
        },
        expect: {
            ok: {
                a: {
                    fork: { namespaces: [BASE_NS, 'org.acme.p597.other@1.0.0', 'org.acme.p597.empty@1.0.0', USER_NS], fromA: true, fromB: false },
                    own: true,
                    theirs: 'TYPE_NOT_FOUND',
                    properties: ['fromaOnly', 'email', 'address', 'colour', 'friend', '$identifier'],
                },
                b: {
                    fork: { namespaces: [BASE_NS, 'org.acme.p597.other@1.0.0', 'org.acme.p597.empty@1.0.0', USER_NS], fromA: false, fromB: true },
                    own: true,
                    theirs: 'TYPE_NOT_FOUND',
                    properties: ['frombOnly', 'email', 'address', 'colour', 'friend', '$identifier'],
                },
                base: { namespaces: [BASE_NS, 'org.acme.p597.other@1.0.0', 'org.acme.p597.empty@1.0.0'], fromA: false, fromB: false },
            },
        },
        reference: { ok: NO_FORK },
    },
    {
        id: 'FORK-ISO-02',
        covers: 'later changes to the base never reach a fork, and a fork\'s never reach the base',
        run: (core) => {
            const mm = base(core);
            if (typeof mm.fork !== 'function') {
                return NO_FORK;
            }
            const fork = mm.fork();
            mm.addCTOModel(userModel('FromA'), 'a.cto');
            mm.deleteModelFile('org.acme.p597.empty@1.0.0');
            mm.updateModelFile(`namespace ${BASE_NS}\nconcept Address { o String street }\n`, 'base2.cto', true);
            fork.addCTOModel(userModel('FromB'), 'b.cto');
            fork.deleteModelFile('org.acme.p597.other@1.0.0');
            return {
                base: holds(mm),
                fork: holds(fork),
                baseAddress: mm.getType(`${BASE_NS}.Address`).getProperties().map((p) => p.getName()),
                forkAddress: fork.getType(`${BASE_NS}.Address`).getProperties().map((p) => p.getName()),
                forkPerson: has(fork, `${BASE_NS}.Person`),
                basePerson: has(mm, `${BASE_NS}.Person`),
            };
        },
        expect: {
            ok: {
                base: { namespaces: [BASE_NS, 'org.acme.p597.other@1.0.0', USER_NS], fromA: true, fromB: false },
                fork: { namespaces: [BASE_NS, 'org.acme.p597.empty@1.0.0', USER_NS], fromA: false, fromB: true },
                baseAddress: ['street'],
                forkAddress: ['city', 'zip'],
                forkPerson: true,
                basePerson: false,
            },
        },
        reference: { ok: NO_FORK },
    },
    {
        id: 'FORK-01',
        covers: 'a fork holds every model file of the base (an empty one too), as the base reads them',
        run: (core) => {
            const mm = base(core);
            if (typeof mm.fork !== 'function') {
                return NO_FORK;
            }
            const fork = mm.fork();
            const filtered = mm.filter(keepUserModels);
            return {
                sameFiles: JSON.stringify(files(fork)) === JSON.stringify(files(mm)),
                sameAst: JSON.stringify(fork.getAst(true, true)) === JSON.stringify(mm.getAst(true, true)),
                namespaces: fork.getNamespaces(),
                filterNamespaces: filtered.getNamespaces(),
                kind: [fork instanceof core.ModelManager, fork.constructor === mm.constructor, typeof fork.addCTOModel],
                views: mm.getModelFiles().map((mf) => fork.getModelFile(mf.getNamespace()) !== mf &&
                    fork.getModelFile(mf.getNamespace()).getModelManager() === fork),
                decorators: fork.getType(`${BASE_NS}.Person`).getDecorators().map((d) => [d.getName(), d.getArguments()]),
                defaults: fork.getFactory().newResource(BASE_NS, 'Car', 'V1').seats,
                json: fork.getSerializer().toJSON(fork.getFactory().newResource(BASE_NS, 'Car', 'V2')),
                definitions: fork.getModels().map((m) => [m.name, typeof m.content]),
                metamodelCopy: fork.metamodelModelFile !== mm.metamodelModelFile &&
                    fork.metamodelModelFile.getModelManager() === fork &&
                    fork.metamodelModelFile.getNamespace(),
                metamodelDeclarations: fork.metamodelModelFile.getAllDeclarations().length ===
                    mm.metamodelModelFile.getAllDeclarations().length,
            };
        },
        expect: {
            ok: {
                sameFiles: true,
                sameAst: true,
                namespaces: ['concerto.decorator@1.0.0', 'concerto@1.0.0', BASE_NS, 'org.acme.p597.other@1.0.0', 'org.acme.p597.empty@1.0.0'],
                filterNamespaces: ['concerto.decorator@1.0.0', 'concerto@1.0.0', BASE_NS, 'org.acme.p597.other@1.0.0'],
                kind: [true, true, 'function'],
                views: [true, true, true],
                decorators: [['Term', ['A person']]],
                defaults: 4,
                json: { $class: `${BASE_NS}.Car`, vin: 'V2', seats: 4, $identifier: 'V2' },
                definitions: [['base.cto', 'string'], ['other.cto', 'string'], ['empty.cto', 'string']],
                metamodelCopy: 'concerto.metamodel@1.0.0',
                metamodelDeclarations: true,
            },
        },
        reference: { ok: NO_FORK },
    },
    {
        id: 'FORK-02',
        covers: 'a fork has the base\'s options: decorator validation and the metamodel copy it registered',
        run: (core) => {
            const mm = new core.ModelManager({ decoratorValidation: { missingDecorator: 'error' } });
            mm.addCTOModel(FILTER_OTHER.replace(/import[^\n]*\n/, '').replace(/Addr/g, 'String').replace('o Person manager optional', ''), 'o.cto');
            if (typeof mm.fork !== 'function') {
                return NO_FORK;
            }
            const fork = mm.fork();
            const model = `namespace ${USER_NS}\n@Undeclared\nconcept X { o String y }\n`;
            const withMetamodel = new core.ModelManager({ addMetamodel: true }).fork();
            const forkOfAst = new core.AstModelManager().fork();
            return {
                base: thrown(() => mm.addCTOModel(model, 'x.cto'))[0],
                fork: thrown(() => fork.addCTOModel(model, 'x.cto'))[0],
                plain: thrown(() => base(core).fork().addCTOModel(model, 'x.cto')),
                metamodel: withMetamodel.metamodelModelFile === withMetamodel.getModelFile('concerto.metamodel@1.0.0'),
                astKind: forkOfAst instanceof core.AstModelManager,
            };
        },
        expect: { ok: { base: 'IllegalModelException', fork: 'IllegalModelException', plain: 'ok', metamodel: true, astKind: true } },
        reference: { ok: NO_FORK },
    },
    {
        id: 'FORK-03',
        covers: 'a fork of a base with decorator factories builds its views with them',
        run: (core) => {
            /** A decorator a factory builds. */
            class Tagged extends core.Decorator {}
            /** The factory. */
            class Factory extends core.DecoratorFactory {
                /**
                 * @param {object} parent the decorated element
                 * @param {object} ast the decorator's AST
                 * @returns {object} the decorator
                 */
                newDecorator(parent, ast) {
                    return new Tagged(parent, ast);
                }
            }
            const mm = new core.ModelManager();
            mm.addDecoratorFactory(new Factory());
            mm.addCTOModel(BASE, 'base.cto');
            if (typeof mm.fork !== 'function') {
                return NO_FORK;
            }
            const fork = mm.fork();
            const decorator = fork.getType(`${BASE_NS}.Person`).getDecorators()[0];
            return [decorator instanceof Tagged, decorator.getName(), fork.getDecoratorFactories().length];
        },
        expect: { ok: [true, 'Term', 1] },
        reference: { ok: NO_FORK },
    },
    {
        id: 'FORK-04',
        covers: 'a fork and its base each answer from their own models after the other changes a shared file (model epochs are per manager)',
        run: (core) => {
            const mm = base(core);
            if (typeof mm.fork !== 'function') {
                return NO_FORK;
            }
            const names = (m) => m.getType(`${BASE_NS}.Address`).getProperties().map((p) => p.getName());
            const office = (m) => m.getType('org.acme.p597.other@1.0.0.Office').getProperty('address')
                .getParent().getModelFile().getModelManager() === m;
            const identifier = (m) => m.getType(`${BASE_NS}.Person`).getIdentifierFieldName();
            const fork = mm.fork();
            // Warm both managers' cached answers first.
            const warm = [names(mm), names(fork), identifier(mm), identifier(fork)];
            fork.updateModelFile(BASE.replace('o String city', 'o String city\n  o String street'), 'base.cto');
            const afterForkUpdate = [names(mm), names(fork), mm.getType(`${BASE_NS}.Address`).getProperty('street')];
            mm.updateModelFile(BASE.replace('o String city', 'o String city\n  o String country'), 'base.cto');
            const afterBaseUpdate = [names(mm), names(fork)];
            fork.deleteModelFile('org.acme.p597.other@1.0.0');
            return {
                warm,
                afterForkUpdate,
                afterBaseUpdate,
                afterForkDelete: [office(mm), fork.getModelFile('org.acme.p597.other@1.0.0') === undefined, identifier(mm), identifier(fork)],
            };
        },
        expect: {
            ok: {
                warm: [['city', 'zip'], ['city', 'zip'], 'email', 'email'],
                afterForkUpdate: [['city', 'zip'], ['city', 'street', 'zip'], null],
                afterBaseUpdate: [['city', 'country', 'zip'], ['city', 'street', 'zip']],
                afterForkDelete: [true, true, 'email', 'email'],
            },
        },
        reference: { ok: NO_FORK },
    },
    {
        id: 'FILTER-01',
        covers: 'filter keeping every user declaration: the same files, ASTs, definitions and names as v5.0.0',
        run: (core) => {
            const mm = filterBase(core);
            const filtered = mm.filter(keepUserModels);
            filtered.addModel(filterUserModel(), undefined, 'a.cto');
            return {
                files: digest(files(filtered)),
                base: holds(mm),
                filtered: holds(filtered),
                types: filtered.getType('org.acme.p597.other@1.0.0.Office').getProperties().map((p) => [p.getName(), p.getFullyQualifiedTypeName()]),
                decorators: filtered.getType(`${BASE_NS}.Address`).getDecorators().map((d) => [d.getName(), d.getArguments()]),
                instance: filtered.getSerializer().toJSON(filtered.getSerializer().fromJSON({
                    $class: `${USER_NS}.FromA`, name: 'n', address: { $class: `${BASE_NS}.Address`, city: 'X' }, code: 'AB',
                })),
            };
        },
        expect: {
            ok: {
                files: 'f407f635612973a7',
                base: {
                    namespaces: ['org.acme.p597.base@1.0.0', 'org.acme.p597.other@1.0.0', 'org.acme.p597.empty@1.0.0'],
                    fromA: false,
                    fromB: false,
                },
                filtered: {
                    namespaces: ['org.acme.p597.base@1.0.0', 'org.acme.p597.other@1.0.0', 'org.acme.p597.user@1.0.0'],
                    fromA: true,
                    fromB: false,
                },
                types: [
                    ['address', 'org.acme.p597.base@1.0.0.Address'],
                    ['manager', 'org.acme.p597.base@1.0.0.Person'],
                ],
                decorators: [['Term', ['An address']]],
                instance: {
                    $class: 'org.acme.p597.user@1.0.0.FromA',
                    address: { $class: 'org.acme.p597.base@1.0.0.Address', city: 'X' },
                    code: 'AB',
                    name: 'n',
                },
            },
        },
    },
    {
        id: 'FILTER-02',
        covers: 'filter dropping one declaration: the file is rebuilt, the others kept, as v5.0.0',
        run: (core) => {
            const mm = filterBase(core);
            const filtered = mm.filter((d) => keepUserModels(d) && d.getName() !== 'Car');
            const office = mm.filter((d) => keepUserModels(d) && d.getName() !== 'Office');
            return {
                files: digest(files(filtered)),
                namespaces: office.getNamespaces(),
                office: digest(files(office)),
                broken: thrown(() => mm.filter((d) => keepUserModels(d) && d.getName() !== 'Colour')),
            };
        },
        expect: {
            ok: {
                files: 'ddb47100b435e558',
                namespaces: ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.acme.p597.base@1.0.0'],
                office: '465a7f827afa86c0',
                broken: [
                    'IllegalModelException',
                    'Undeclared type "Colour" in "property org.acme.p597.base@1.0.0.Person.colour". File \'base.cto\': ',
                ],
            },
        },
    },
    {
        id: 'FILTER-03',
        covers: 'filter of a base holding a file never validated validates it, and throws what v5.0.0 throws',
        run: (core) => {
            const mm = filterBase(core);
            mm.addCTOModel('namespace org.acme.p597.bad@1.0.0\nconcept Bad extends Nowhere { o String x }\n', 'bad.cto', true);
            return {
                keepAll: thrown(() => mm.filter(keepUserModels)),
                noValidation: mm.filter(keepUserModels, { disableValidation: true }).getNamespaces(),
                withoutBad: mm.filter((d) => keepUserModels(d) && d.getName() !== 'Bad').getNamespaces(),
            };
        },
        expect: {
            ok: {
                keepAll: ['IllegalModelException', 'Could not find super type Nowhere File \'bad.cto\': '],
                noValidation: [
                    'concerto.decorator@1.0.0',
                    'concerto@1.0.0',
                    'org.acme.p597.base@1.0.0',
                    'org.acme.p597.other@1.0.0',
                    'org.acme.p597.bad@1.0.0',
                ],
                withoutBad: [
                    'concerto.decorator@1.0.0',
                    'concerto@1.0.0',
                    'org.acme.p597.base@1.0.0',
                    'org.acme.p597.other@1.0.0',
                ],
            },
        },
    },
    {
        id: 'FILTER-04',
        covers: 'BC-53: filter(() => true) keeps every model file (v5.0.0 threw, adding the decorator model twice)',
        run: (core) => thrown(() => base(core).filter(() => true)),
        expect: { ok: 'ok' },
        reference: {
            ok: [
                'Error',
                'Namespace concerto.decorator@1.0.0 specified in file concerto_decorator_1.0.0.cto is already declared in file concerto_decorator_1.0.0.cto',
            ],
        },
    },
    {
        id: 'FILTER-05',
        covers: 'filter\'s predicate is called on the same user declarations, in the same order, as v5.0.0; BC-53: not on the built-in models\' declarations',
        run: (core) => {
            const mm = filterBase(core);
            const seen = [];
            mm.filter((d) => {
                seen.push(d.getFullyQualifiedName());
                return keepUserModels(d);
            });
            return seen;
        },
        expect: {
            ok: [
                'org.acme.p597.base@1.0.0.Shape',
                'org.acme.p597.base@1.0.0.Address',
                'org.acme.p597.base@1.0.0.Colour',
                'org.acme.p597.base@1.0.0.Code',
                'org.acme.p597.base@1.0.0.Labels',
                'org.acme.p597.base@1.0.0.Person',
                'org.acme.p597.base@1.0.0.Car',
                'org.acme.p597.other@1.0.0.Office',
                'org.acme.p597.base@1.0.0.Address',
                'org.acme.p597.base@1.0.0.Person',
            ],
        },
        // BC-53: v5.0.0 also called the predicate on the decorator model's
        // declarations.
        reference: {
            ok: [
                'concerto.decorator@1.0.0.Decorator',
                'concerto.decorator@1.0.0.DotNetNamespace',
                'org.acme.p597.base@1.0.0.Shape',
                'org.acme.p597.base@1.0.0.Address',
                'org.acme.p597.base@1.0.0.Colour',
                'org.acme.p597.base@1.0.0.Code',
                'org.acme.p597.base@1.0.0.Labels',
                'org.acme.p597.base@1.0.0.Person',
                'org.acme.p597.base@1.0.0.Car',
                'org.acme.p597.other@1.0.0.Office',
                'org.acme.p597.base@1.0.0.Address',
                'org.acme.p597.base@1.0.0.Person',
            ],
        },
    },
    {
        id: 'CLEAR-01',
        covers: 'clearModelFiles and fromAst replace the engine handle (the old one released) and the manager works as before',
        run: (core) => {
            const mm = filterBase(core);
            const ast = mm.getAst();
            mm.clearModelFiles();
            const cleared = mm.getNamespaces();
            mm.fromAst(ast);
            mm.fromAst(ast);
            const resource = mm.getSerializer().fromJSON({ $class: `${BASE_NS}.Car`, vin: 'V', seats: 2 });
            return { cleared, namespaces: mm.getNamespaces(), json: mm.getSerializer().toJSON(resource) };
        },
        expect: {
            ok: {
                cleared: ['concerto.decorator@1.0.0', 'concerto@1.0.0'],
                namespaces: [
                    'concerto.decorator@1.0.0',
                    'concerto@1.0.0',
                    'org.acme.p597.base@1.0.0',
                    'org.acme.p597.other@1.0.0',
                    'org.acme.p597.empty@1.0.0',
                ],
                json: { $class: 'org.acme.p597.base@1.0.0.Car', vin: 'V', seats: 2 },
            },
        },
    },
];

module.exports = checks;
