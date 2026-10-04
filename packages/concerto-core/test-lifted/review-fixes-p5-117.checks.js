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
 * P5-117 lifted checks (accordproject/concerto-rust#487): consistency
 * follow-ups from the second end-to-end review.
 *
 * - R2E-2: `DecoratorManager.executePropertyCommand` changes only the
 *   property's `decorators` array, in place, pushing the command's own
 *   decorator object, as TS 5.0.0 did.
 * - R2E-4: the members that moved back to TS give TS 5.0.0's answers
 *   (`toString`s, the duplicate-decorator scan, `capitalizeFirstLetter`,
 *   `removeNamespaceVersionFromFullyQualifiedName`).
 * - R2D-5: a ModelFile staged in a handle `clearModelFiles` released still
 *   builds its declarations.
 * - R2E-5: a value whose getter validates another value mid-write is
 *   validated as TS 5.0.0 validates it.
 * - R2E-10: `validateInstance` and `validateInstanceOrThrow` give the same
 *   verdicts over the compact layout.
 * - R2E-3: a fork keeps the base's serializer defaults, and its metamodel
 *   copy is its own; v5.0.0 has no `fork` (`reference` is `'no fork'`).
 * - The filter of a file into its own manager (no scratch handle).
 *
 * Only public members are used. A throw is reduced to its class (error
 * parity: messages may differ). `expect` is the frozen v5.0.0 reference's
 * outcome, which src matches, except where a check has its own
 * `reference`. Run by fallbacks.spec.js.
 */

/**
 * The outcome of `fn`: its value, or the class of the error it threw.
 * @param {Function} fn the body
 * @returns {Array} `['ok', value]` or `['throws', name]`
 */
function probe(fn) {
    try {
        return ['ok', fn()];
    } catch (e) {
        return ['throws', e && e.constructor ? e.constructor.name : typeof e];
    }
}

const NO_FORK = 'no fork';
const MM = 'concerto.metamodel@1.0.0';
const NS = 'org.acme.p5117@1.0.0';

const MODEL = `namespace ${NS}
concept Address {
  o String city
  o Integer zip range=[0,99999] optional
}
scalar Code extends String default="X"
participant Person identified by email {
  o String email
  o Address address optional
  o String nickname optional
  o Integer age optional
}
`;

/**
 * A ModelManager holding MODEL.
 * @param {object} core a loaded core
 * @returns {object} the manager
 */
function manager(core) {
    const mm = new core.ModelManager();
    mm.addCTOModel(MODEL, 'p5117.cto');
    return mm;
}

const checks = [
    {
        id: 'R2E-2-01',
        covers: 'executePropertyCommand pushes the decorator itself onto the property\'s own decorators array',
        run: (core) => {
            const decorator = { $class: `${MM}.Decorator`, name: 'Dec', arguments: [] };
            const type = { $class: `${MM}.TypeIdentifier`, name: 'T' };
            const property = { $class: `${MM}.StringProperty`, name: 'p', decorators: [], type };
            const decorators = property.decorators;
            core.DecoratorManager.executePropertyCommand(property, {
                type: 'UPSERT', target: { property: 'p' }, decorator,
            });
            const pushedItself = property.decorators[0] === decorator;
            const other = { $class: `${MM}.Decorator`, name: 'Other', arguments: [] };
            const bare = { $class: `${MM}.StringProperty`, name: 'p', type };
            core.DecoratorManager.executePropertyCommand(bare, { type: 'UPSERT', target: { type: `${MM}.StringProperty` }, decorator: other });
            core.DecoratorManager.executePropertyCommand(bare, { type: 'UPSERT', target: { properties: ['p'] }, decorator });
            const bareAppend = { $class: `${MM}.StringProperty`, name: 'p', type };
            core.DecoratorManager.executePropertyCommand(bareAppend, { type: 'APPEND', target: { property: 'p' }, decorator });
            const unmatched = { $class: `${MM}.StringProperty`, name: 'q', decorators: [], type };
            const before = [unmatched.decorators, unmatched.type];
            core.DecoratorManager.executePropertyCommand(unmatched, {
                type: 'UPSERT', target: { property: 'p' }, decorator,
            });
            core.DecoratorManager.executePropertyCommand(property, {
                type: 'UPSERT', target: { property: 'p' }, decorator: { ...decorator, arguments: [1] },
            });
            const appended = probe(() => core.DecoratorManager.executePropertyCommand(property, {
                type: 'APPEND', target: { property: 'p' }, decorator,
            }));
            const unknown = probe(() => core.DecoratorManager.executePropertyCommand(property, {
                type: 'NOPE', target: { property: 'p' }, decorator,
            }));
            return {
                pushedItself,
                bare: bare.decorators.map((d) => d === decorator || d === other),
                bareAppend: bareAppend.decorators[0] === decorator,
                sameArray: property.decorators === decorators,
                sameDecorator: property.decorators[0] === decorator,
                sameType: property.type === type,
                untouched: unmatched.decorators === before[0] && unmatched.type === before[1] && unmatched.decorators.length === 0,
                count: property.decorators.length,
                appended,
                unknown,
            };
        },
        expect: {
            ok: {
                pushedItself: true,
                bare: [true, true],
                bareAppend: true,
                sameArray: true,
                sameDecorator: false,
                sameType: true,
                untouched: true,
                count: 2,
                appended: ['throws', 'IllegalModelException'],
                unknown: ['throws', 'Error'],
            },
        },
    },
    {
        id: 'R2E-4-01',
        covers: 'the toStrings, the duplicate-decorator scan and the ModelUtil string members give TS 5.0.0\'s answers',
        run: (core) => {
            const mm = manager(core);
            const person = mm.getType(`${NS}.Person`);
            const address = mm.getType(`${NS}.Address`);
            const duplicate = new core.ModelManager();
            const twice = probe(() => duplicate.addCTOModel(`namespace org.acme.dup@1.0.0
@Term("a") @Term("b")
concept C { o String s }
`, 'dup.cto'));
            const { ModelUtil } = core;
            return {
                field: person.getProperty('email').toString(),
                optional: person.getProperty('address').toString(),
                scalar: mm.getType(`${NS}.Code`).toString(),
                number: String(address.getProperty('zip').getValidator()),
                twice,
                capitalized: ['', 'abc', 'ßa', '\u{1D11E}x'].map((s) => ModelUtil.capitalizeFirstLetter(s)),
                capitalizeNonString: probe(() => ModelUtil.capitalizeFirstLetter(3)),
                unversioned: [
                    'org.acme@1.0.0.Person', 'String', '@1.0.0.X', 'org.acme@1.0.0-rc.1.Y',
                    'org.acme@01.0.0.Z',
                ].map((fqn) => probe(() => ModelUtil.removeNamespaceVersionFromFullyQualifiedName(fqn))),
            };
        },
        expect: {
            ok: {
                field: 'Field {name=email, type=String, array=false, optional=false}',
                optional: `Field {name=address, type=${NS}.Address, array=false, optional=true}`,
                scalar: `ScalarDeclaration {id=${NS}.Code}`,
                number: 'NumberValidator lower: 0 upper: 99999',
                twice: ['throws', 'IllegalModelException'],
                capitalized: ['', 'Abc', 'SSa', '\u{1D11E}x'],
                capitalizeNonString: ['throws', 'TypeError'],
                unversioned: [
                    ['ok', 'org.acme.Person'],
                    ['ok', 'String'],
                    ['ok', 'X'],
                    ['ok', 'org.acme.Y'],
                    ['throws', 'Error'],
                ],
            },
        },
    },
    {
        id: 'R2D-5-01',
        covers: 'a ModelFile staged before clearModelFiles still builds its declarations',
        run: (core) => {
            const mm = manager(core);
            const ast = mm.getModelFile(NS).getAst();
            const other = { ...ast, namespace: 'org.acme.p5117.other@1.0.0' };
            const mf = new core.ModelFile(mm, other);
            mm.clearModelFiles();
            return {
                names: mf.getAllDeclarations().map((d) => d.getName()),
                validator: String(mf.getType('Address').getProperty('zip').getValidator()),
            };
        },
        expect: {
            ok: {
                names: ['Address', 'Code', 'Person'],
                validator: 'NumberValidator lower: 0 upper: 99999',
            },
        },
    },
    {
        id: 'R2E-5-01',
        covers: 'a getter that validates another value while a value is written is validated as in TS 5.0.0',
        run: (core) => {
            const mm = manager(core);
            const factory = new core.Factory(mm);
            const other = factory.newResource(NS, 'Person', 'b@x');
            const person = factory.newResource(NS, 'Person', 'a@x');
            const address = factory.newConcept(NS, 'Address');
            const inner = [];
            Object.defineProperty(address, 'city', {
                enumerable: true,
                get() {
                    const bad = factory.newConcept(NS, 'Address');
                    bad.city = 3;
                    const good = factory.newConcept(NS, 'Address');
                    good.city = 'Lyon';
                    inner.push(probe(() => other.setPropertyValue('address', bad)));
                    inner.push(probe(() => other.setPropertyValue('address', good)));
                    inner.push(probe(() => other.validate()));
                    return 'Paris';
                },
            });
            const outer = probe(() => person.setPropertyValue('address', address));
            const whole = probe(() => person.validate());
            return { outer, whole, inner, city: other.address.city };
        },
        expect: {
            ok: {
                outer: ['ok', '<undefined>'],
                whole: ['ok', '<undefined>'],
                inner: [
                    ['throws', 'ValidationException'], ['ok', '<undefined>'], ['ok', '<undefined>'],
                    ['throws', 'ValidationException'], ['ok', '<undefined>'], ['ok', '<undefined>'],
                ],
                city: 'Lyon',
            },
        },
    },
    {
        id: 'R2E-10-01',
        covers: 'validateInstance and validateInstanceOrThrow verdicts, as the compact layout carries the document',
        run: (core) => {
            const mm = manager(core);
            if (typeof mm.validateInstance !== 'function') {
                return 'no validateInstance';
            }
            const good = { $class: `${NS}.Person`, email: 'a@x', age: 3, address: { $class: `${NS}.Address`, city: 'P' } };
            const bad = { ...good, age: 'x' };
            const result = mm.validateInstance(bad);
            return {
                good: mm.validateInstance(good).valid,
                bad: [result.valid, result.errors.map((e) => [e.code, e.path])],
                text: mm.validateInstance(JSON.stringify(good)).valid,
                orThrow: probe(() => mm.validateInstanceOrThrow(bad, { hydrate: false })),
                resource: mm.validateInstanceOrThrow(good).getIdentifier(),
                // Options the fast path cannot encode (a lone surrogate) route
                // the document to fromJSON, after the engine's `$class` check.
                unencodableOptions: mm.getType(`${NS}.Address`).validateInstance(good, { extra: '\uD800' }).errors.map((e) => e.code),
                // A document the fast path cannot carry, with options whose
                // getter throws: the error, from the `$class` check.
                throwingOptions: probe(() => mm.getType(`${NS}.Address`).validateInstance(
                    { ...good, nickname: '\uD800' },
                    { extra: { get value() { throw new TypeError('no value'); } } },
                )),
                // A document nested past the binary writer's depth whose
                // getter throws: the error, from the text encoding.
                deepThrow: probe(() => {
                    const doc = { ...good, address: { $class: `${NS}.Address`, city: 'P' } };
                    let node = doc.address;
                    for (let i = 0; i < 110; i++) {
                        node.next = {};
                        node = node.next;
                    }
                    Object.defineProperty(node, 'boom', { enumerable: true, get() { throw new RangeError('deep'); } });
                    return mm.validateInstance(doc);
                }),
            };
        },
        expect: {
            ok: {
                good: true,
                bad: [false, [['TYPE_VIOLATION', '/age']]],
                text: true,
                orThrow: ['throws', 'ValidationException'],
                resource: 'a@x',
                unencodableOptions: ['NOT_ASSIGNABLE'],
                throwingOptions: ['throws', 'TypeError'],
                deepThrow: ['throws', 'RangeError'],
            },
        },
        reference: { ok: 'no validateInstance' },
    },
    {
        id: 'R2E-3-01',
        covers: 'a fork keeps the base\'s serializer defaults and builds its own metamodel copy',
        run: (core) => {
            const mm = manager(core);
            if (typeof mm.fork !== 'function') {
                return NO_FORK;
            }
            mm.getSerializer().setDefaultOptions({ validate: false, utcOffset: 60 });
            const fork = mm.fork();
            const forkOfFork = fork.fork();
            const copy = forkOfFork.metamodelModelFile;
            return {
                defaults: [fork.getSerializer().defaultOptions.validate, fork.getSerializer().defaultOptions.utcOffset],
                ownCopy: copy.getModelManager() === forkOfFork && copy !== mm.metamodelModelFile,
                declarations: copy.getAllDeclarations().length === mm.metamodelModelFile.getAllDeclarations().length,
            };
        },
        expect: { ok: { defaults: [false, 60], ownCopy: true, declarations: true } },
        reference: { ok: NO_FORK },
    },
    {
        id: 'R2E-5-03',
        covers: 'a value the engine cannot carry, or whose getter throws, is validated as in TS 5.0.0',
        run: (core) => {
            const mm = manager(core);
            const factory = new core.Factory(mm);
            const lone = factory.newResource(NS, 'Person', '\uD800');
            const address = factory.newConcept(NS, 'Address');
            address.city = 'Paris';
            const throwing = factory.newConcept(NS, 'Address');
            Object.defineProperty(throwing, 'city', { enumerable: true, get() { throw new TypeError('no city'); } });
            const person = factory.newResource(NS, 'Person', 'p@x');
            return {
                loneRoot: probe(() => lone.setPropertyValue('address', address)),
                loneValidate: probe(() => lone.validate()),
                throwingGetter: probe(() => person.setPropertyValue('address', throwing)),
            };
        },
        expect: {
            ok: {
                loneRoot: ['ok', '<undefined>'],
                loneValidate: ['ok', '<undefined>'],
                throwingGetter: ['throws', 'TypeError'],
            },
        },
    },
    {
        id: 'R2E-5-04',
        covers: 'an AST getter that throws, and the engine memo of the ModelUtil string members past its limit',
        run: (core) => {
            const mm = new core.ModelManager();
            const ast = { $class: `${MM}.Model`, namespace: 'org.acme.throws@1.0.0', imports: [] };
            Object.defineProperty(ast, 'declarations', { enumerable: true, get() { throw new TypeError('no declarations'); } });
            const names = [];
            for (let i = 0; i < 4200; i++) {
                names.push(core.ModelUtil.getFullyQualifiedName('org.acme@1.0.0', `T${i}`));
            }
            return {
                getter: probe(() => new core.ModelFile(mm, ast)),
                memo: [names.length, names[0], names[4199], core.ModelUtil.getFullyQualifiedName('org.acme@1.0.0', 'T0')],
            };
        },
        expect: {
            ok: {
                getter: ['throws', 'TypeError'],
                memo: [4200, 'org.acme@1.0.0.T0', 'org.acme@1.0.0.T4199', 'org.acme@1.0.0.T0'],
            },
        },
    },
    {
        id: 'R2E-5-02',
        covers: 'an AST getter that builds another ModelFile of the same manager while the AST is read',
        run: (core) => {
            const mm = new core.ModelManager();
            const plain = (namespace) => ({
                $class: `${MM}.Model`, namespace, imports: [],
                declarations: [{ $class: `${MM}.ConceptDeclaration`, name: 'A', isAbstract: false, properties: [] }],
            });
            const nested = [];
            const outer = plain('org.acme.outer@1.0.0');
            const declarations = outer.declarations;
            let reads = 0;
            Object.defineProperty(outer, 'declarations', {
                enumerable: true,
                get() {
                    if (reads++ === 0) {
                        nested.push(probe(() => new core.ModelFile(mm, plain('org.acme.inner@1.0.0')).getAllDeclarations().length));
                    }
                    return declarations;
                },
            });
            const built = probe(() => new core.ModelFile(mm, outer).getAllDeclarations().map((d) => d.getName()));
            return { built, nested };
        },
        expect: { ok: { built: ['ok', ['A']], nested: [['ok', 1]] } },
    },
    {
        id: 'FILTER-SELF-01',
        covers: 'ModelFile.filter into its own manager returns the filtered file, unregistered',
        run: (core) => {
            const mm = manager(core);
            const mf = mm.getModelFile(NS);
            const kept = mf.filter((d) => d.getName() !== 'Code', mm);
            const all = mf.filter(() => true, mm);
            const none = mf.filter(() => false, mm);
            return {
                kept: kept.getAllDeclarations().map((d) => d.getName()),
                all: [all !== mf, all.getAllDeclarations().map((d) => d.getName())],
                none,
                registered: mm.getModelFile(NS) === mf,
            };
        },
        expect: {
            ok: {
                kept: ['Address', 'Person'],
                all: [true, ['Address', 'Code', 'Person']],
                none: null,
                registered: true,
            },
        },
    },
];

module.exports = checks;
