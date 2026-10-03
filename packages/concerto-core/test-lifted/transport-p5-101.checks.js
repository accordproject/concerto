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
 * P5-101 lifted checks (accordproject/concerto-rust#455): the transport and
 * serializer consistency changes, each against concerto-core@5.0.0.
 *
 * - D-9: `addModelFile` with `metamodelValidation` runs the metamodel check
 *   and the validation of a staged file in one engine call: the same
 *   outcomes, the same classes, and the metamodel registered (or not)
 *   afterwards as before.
 * - D-10, M5: `addModelFiles` registers its staged files in one engine
 *   call: the same namespaces, the same types, the same rollback on an
 *   error.
 * - D-3, E-7: `toJSON` reuses the options' wire text and the engine's
 *   serializer for them; `validateMetaModel` runs through the engine's
 *   validate-only binding: the same results and error classes.
 * - D-4: a DecoratorManager result's header is read in the one header
 *   format: the same imports and namespaces.
 * - D-10, M5: a DecoratorManager result (decorateModels, every extract)
 *   registers its staged files in one engine call: the same namespaces,
 *   types and decorators.
 * - D-10: `setPropertyValue`/`addArrayValue` validate by the declaration's
 *   and property's slot, with a validation error's message in the same
 *   call: the same outcomes and classes, also after the model changes.
 * - E-7: `fromJSON`/`toJSON` send the document in the compact binary
 *   layout: the same results and classes, for maps, dates, relationships,
 *   `undefined`, `NaN`, `-0`, array holes and a document nested past the
 *   binary writer's depth.
 *
 * Only error classes are compared, never messages (error parity, P5-09).
 */

const MM = 'concerto.metamodel@1.0.0';

/**
 * The class of the error `fn` throws, or `'ok'`.
 * @param {Function} fn the body
 * @returns {string} the outcome
 */
function probe(fn) {
    try {
        fn();
        return 'ok';
    } catch (e) {
        return e && e.constructor ? e.constructor.name : typeof e;
    }
}

const BASE = `namespace org.p5101.base@1.0.0
concept Base identified by id {
  o String id
}`;

const USER = `namespace org.p5101.user@1.0.0
import org.p5101.base@1.0.0.{Base}
@Term("A user")
concept User extends Base {
  o String name optional
  o DateTime when optional
  o Double score optional
}`;

const BROKEN = `namespace org.p5101.broken@1.0.0
concept Broken extends Missing {
}`;

/**
 * A ModelFile of `cto`, built by a parser manager, in `mm`.
 * @param {object} core the core under test
 * @param {object} mm the manager
 * @param {string} cto the CTO text
 * @returns {object} the ModelFile
 */
function modelFile(core, mm, cto) {
    const ast = new core.ModelManager({ strict: true }).addCTOModel(cto, undefined, true).getAst();
    return new core.ModelFile(mm, JSON.parse(JSON.stringify(ast)), cto, 'x.cto');
}

const SHAPES = `namespace org.p5101.shapes@1.0.0
concept Address {
  o String street regex=/^[a-z]+$/ length=[1,10]
}
asset Thing identified by id {
  o String id
  o String code regex=/^A/
  o Address addr optional
  o Integer[] nums optional
  o Double ratio optional
  o DateTime when optional
  --> Thing other optional
  o Tags tags optional
}
map Tags {
  o String
  o String
}`;

/**
 * A manager holding `SHAPES`.
 * @param {object} core the core under test
 * @returns {object} the manager
 */
function shapesManager(core) {
    const mm = new core.ModelManager();
    mm.addModelFile(modelFile(core, mm, SHAPES));
    return mm;
}

/**
 * A nested plain object `depth` levels deep.
 * @param {number} depth the depth
 * @returns {object} the object
 */
function deep(depth) {
    let v = { leaf: 1 };
    for (let i = 0; i < depth; i++) {
        v = { v };
    }
    return v;
}

const THING_JSON = {
    $class: 'org.p5101.shapes@1.0.0.Thing', id: 't1', code: 'A1',
    addr: { $class: 'org.p5101.shapes@1.0.0.Address', street: 'main' },
    nums: [1, -2, 2147483648], ratio: 0.5, when: '2024-01-02T01:04:05.000Z',
    other: 'resource:org.p5101.shapes@1.0.0.Thing#t2',
    tags: { a: 'b', 'ü': 'ß' },
    $identifier: 't1',
};

/**
 * P5101-SER-002's outcomes, with the class a failing validator throws.
 * @param {string} validatorClass the class
 * @returns {Array} the outcomes
 */
function SER_002(validatorClass) {
    const { ratio, ...noRatio } = THING_JSON; // eslint-disable-line no-unused-vars
    return [
        THING_JSON,
        { ...THING_JSON, when: '2024-01-01T23:04:05.000-02:00' },
        'ValidationException',
        true,
        noRatio,
        'ValidationException',
        'ok',
        'ValidationException',
        'ok',
        validatorClass,
        'ValidationException',
        'ValidationException',
        'ok',
    ];
}

module.exports = [
    {
        id: 'P5101-ADD-001',
        covers: 'P5-101 D-9: addModelFile with metamodelValidation validates and registers in one call: a valid file, an invalid one, then the valid one again',
        run: (core) => {
            const mm = new core.ModelManager({ metamodelValidation: true });
            const outcomes = [
                probe(() => mm.addModelFile(modelFile(core, mm, BASE))),
                probe(() => mm.addModelFile(modelFile(core, mm, BROKEN))),
                probe(() => mm.addModelFile(modelFile(core, mm, USER))),
            ];
            return [outcomes, mm.getNamespaces().sort(), !!mm.getModelFile(`${MM}`),
                mm.getType('org.p5101.user@1.0.0.User').getSuperType()];
        },
        expect: { ok: [['ok', 'IllegalModelException', 'ok'],
            ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.p5101.base@1.0.0', 'org.p5101.user@1.0.0'],
            false, 'org.p5101.base@1.0.0.Base'] },
    },
    {
        id: 'P5101-ADDS-001',
        covers: 'P5-101 D-10/M5: addModelFiles registers a batch of staged files in one call: the same namespaces and types, and a failing batch rolls back',
        run: (core) => {
            const mm = new core.ModelManager();
            mm.addModelFiles([modelFile(core, mm, USER), modelFile(core, mm, BASE)], null);
            const ok = [mm.getNamespaces().sort(), mm.getType('org.p5101.user@1.0.0.User').getProperties().map((p) => p.getName())];
            const second = new core.ModelManager();
            const failed = probe(() => second.addModelFiles([modelFile(core, second, BASE), modelFile(core, second, BROKEN)], null));
            const after = [second.getNamespaces().sort(), probe(() => second.addModelFiles([modelFile(core, second, BASE), modelFile(core, second, USER)], null))];
            return [ok, failed, after, second.getType('org.p5101.user@1.0.0.User').getSuperType()];
        },
        expect: { ok: [
            [['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.p5101.base@1.0.0', 'org.p5101.user@1.0.0'], ['name', 'when', 'score', 'id']],
            'IllegalModelException',
            [['concerto.decorator@1.0.0', 'concerto@1.0.0'], 'ok'],
            'org.p5101.base@1.0.0.Base',
        ] },
    },
    {
        id: 'P5101-SER-001',
        covers: 'P5-101 D-3/E-7: toJSON with the default options, the same options again and other options gives what 5.0.0 gives, and an invalid resource throws the same class',
        run: (core) => {
            const mm = new core.ModelManager();
            mm.addModelFiles([modelFile(core, mm, BASE), modelFile(core, mm, USER)], null);
            const factory = new core.Factory(mm);
            const serializer = new core.Serializer(factory, mm);
            const json = { $class: 'org.p5101.user@1.0.0.User', id: 'a', name: 'n', when: '2024-01-02T03:04:05.000Z', score: -0 };
            const resource = serializer.fromJSON(json);
            const out = [
                serializer.toJSON(resource),
                serializer.toJSON(resource),
                serializer.toJSON(resource, { utcOffset: 60 }),
                serializer.toJSON(resource, { validate: false }),
                Object.is(serializer.toJSON(resource).score, -0),
            ];
            resource.name = 3;
            out.push(probe(() => serializer.toJSON(resource)));
            out.push(probe(() => serializer.toJSON(resource, { validate: false })));
            return out;
        },
        expect: { ok: [
            { $class: 'org.p5101.user@1.0.0.User', name: 'n', when: '2024-01-02T03:04:05.000Z', score: 0, id: 'a' },
            { $class: 'org.p5101.user@1.0.0.User', name: 'n', when: '2024-01-02T03:04:05.000Z', score: 0, id: 'a' },
            { $class: 'org.p5101.user@1.0.0.User', name: 'n', when: '2024-01-02T04:04:05.000+01:00', score: 0, id: 'a' },
            { $class: 'org.p5101.user@1.0.0.User', name: 'n', when: '2024-01-02T03:04:05.000Z', score: 0, id: 'a' },
            true,
            'ValidationException',
            'ok',
        ] },
    },
    {
        id: 'P5101-META-001',
        covers: 'P5-101 D-3/E-7: validateMetaModel through the validate-only binding accepts a valid model set and rejects an invalid one with the same class, repeatedly',
        run: (core) => {
            const { validateMetaModel } = core.metaModelModule;
            const parser = new core.ModelManager({ strict: true });
            parser.addCTOModel(BASE, undefined, true);
            const models = parser.getAst();
            const bad = { $class: `${MM}.Models`, models: [{ $class: `${MM}.Model`, namespace: 1, declarations: [] }] };
            const unknown = { $class: `${MM}.Nope` };
            return [probe(() => validateMetaModel(models)), probe(() => validateMetaModel(models)),
                probe(() => validateMetaModel(bad)), probe(() => validateMetaModel(unknown)), probe(() => validateMetaModel({}))];
        },
        expect: { ok: ['ok', 'ok', 'ValidationException', 'TypeNotFoundException', 'Error'] },
    },
    {
        id: 'P5101-DCS-001',
        covers: 'P5-101 D-4: a DecoratorManager result is built from headers in the one format: the same namespaces, imports and decorators',
        run: (core) => {
            const mm = new core.ModelManager();
            mm.addModelFiles([modelFile(core, mm, BASE), modelFile(core, mm, USER)], null);
            const out = [];
            for (const remove of [true, false]) {
                const result = core.DecoratorManager.extractDecorators(mm, { removeDecoratorsFromModel: remove, locale: 'en' });
                const m = result.modelManager;
                out.push([m.getNamespaces().sort(), m.getModelFile('org.p5101.user@1.0.0').getImports(),
                    m.getType('org.p5101.user@1.0.0.User').getDecorators().map((d) => d.getName()),
                    m.getType('org.p5101.user@1.0.0.User').getSuperType()]);
            }
            return out;
        },
        expect: { ok: [
            [['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.p5101.base@1.0.0', 'org.p5101.user@1.0.0'],
                ['org.p5101.base@1.0.0.Base', 'concerto@1.0.0.Concept', 'concerto@1.0.0.Asset', 'concerto@1.0.0.Transaction', 'concerto@1.0.0.Participant', 'concerto@1.0.0.Event'],
                [], 'org.p5101.base@1.0.0.Base'],
            [['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.p5101.base@1.0.0', 'org.p5101.user@1.0.0'],
                ['org.p5101.base@1.0.0.Base', 'concerto@1.0.0.Concept', 'concerto@1.0.0.Asset', 'concerto@1.0.0.Transaction', 'concerto@1.0.0.Participant', 'concerto@1.0.0.Event'],
                ['Term'], 'org.p5101.base@1.0.0.Base'],
        ] },
    },
    {
        id: 'P5101-DCS-002',
        covers: 'P5-101 D-10/M5: a decorateModels result and an extract result register their staged files in one call: the same namespaces, types and decorators',
        run: (core) => {
            const mm = new core.ModelManager();
            mm.addModelFiles([modelFile(core, mm, BASE), modelFile(core, mm, USER)], null);
            const dcs = {
                $class: 'org.accordproject.decoratorcommands@0.4.0.DecoratorCommandSet',
                name: 'p5101', version: '1.0.0',
                commands: [{
                    $class: 'org.accordproject.decoratorcommands@0.4.0.Command',
                    type: 'UPSERT',
                    target: { $class: 'org.accordproject.decoratorcommands@0.4.0.CommandTarget', namespace: 'org.p5101.base@1.0.0', declaration: 'Base' },
                    decorator: { $class: `${MM}.Decorator`, name: 'Tagged', arguments: [] },
                }],
            };
            const decorated = core.DecoratorManager.decorateModels(mm, [dcs]);
            const extracted = core.DecoratorManager.extractDecorators(decorated, { removeDecoratorsFromModel: true, locale: 'en' }).modelManager;
            return [decorated, extracted].map((m) => [m.getNamespaces().sort(),
                m.getType('org.p5101.base@1.0.0.Base').getDecorators().map((d) => d.getName()),
                m.getType('org.p5101.user@1.0.0.User').getDecorators().map((d) => d.getName()),
                m.getType('org.p5101.user@1.0.0.User').getSuperType(),
                probe(() => m.validateModelFiles())]);
        },
        expect: { ok: [
            [['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.p5101.base@1.0.0', 'org.p5101.user@1.0.0'], ['Tagged'], ['Term'], 'org.p5101.base@1.0.0.Base', 'ok'],
            [['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.p5101.base@1.0.0', 'org.p5101.user@1.0.0'], [], [], 'org.p5101.base@1.0.0.Base', 'ok'],
        ] },
    },
    {
        id: 'P5101-PROP-001',
        covers: 'P5-101 D-10: setPropertyValue/addArrayValue validated by slot: valid and invalid values give the same outcomes and classes, before and after the model changes',
        run: (core) => {
            const mm = shapesManager(core);
            const factory = new core.Factory(mm);
            const round = () => {
                const thing = factory.newResource('org.p5101.shapes@1.0.0', 'Thing', 't1');
                const good = factory.newConcept('org.p5101.shapes@1.0.0', 'Address');
                good.street = 'abc';
                const bad = factory.newConcept('org.p5101.shapes@1.0.0', 'Address');
                bad.street = 'ABC';
                return [
                    probe(() => thing.setPropertyValue('code', 'Abc')),
                    probe(() => thing.setPropertyValue('code', 'xyz')),
                    probe(() => thing.setPropertyValue('code', 'Abc')),
                    probe(() => thing.setPropertyValue('addr', good)),
                    probe(() => thing.setPropertyValue('addr', bad)),
                    probe(() => thing.setPropertyValue('addr', 'nope')),
                    probe(() => thing.setPropertyValue('nums', [1, 2])),
                    probe(() => thing.addArrayValue('nums', 3)),
                    probe(() => thing.addArrayValue('nums', 'x')),
                    probe(() => thing.setPropertyValue('tags', new Map([['a', 'b']]))),
                    probe(() => thing.setPropertyValue('tags', new Map([['a', 1]]))),
                    probe(() => thing.setPropertyValue('missing', 1)),
                ];
            };
            const before = round();
            const again = round();
            mm.updateModelFile(modelFile(core, mm, SHAPES.replace('regex=/^A/', 'regex=/^B/')));
            const after = round();
            return [before, again, after];
        },
        // BC-39 (P5-53): a value failing a validator (here `regex`) is a
        // ValidationException; v5.0.0 threw a BaseException.
        expect: { ok: [
            ['ok', 'ValidationException', 'ok', 'ok', 'ValidationException', 'ValidationException', 'ok', 'ok', 'ValidationException', 'ok', 'Error', 'Error'],
            ['ok', 'ValidationException', 'ok', 'ok', 'ValidationException', 'ValidationException', 'ok', 'ok', 'ValidationException', 'ok', 'Error', 'Error'],
            ['ValidationException', 'ValidationException', 'ValidationException', 'ok', 'ValidationException', 'ValidationException', 'ok', 'ok', 'ValidationException', 'ok', 'Error', 'Error'],
        ] },
        reference: { ok: [
            ['ok', 'BaseException', 'ok', 'ok', 'BaseException', 'ValidationException', 'ok', 'ok', 'ValidationException', 'ok', 'Error', 'Error'],
            ['ok', 'BaseException', 'ok', 'ok', 'BaseException', 'ValidationException', 'ok', 'ok', 'ValidationException', 'ok', 'Error', 'Error'],
            ['BaseException', 'BaseException', 'BaseException', 'ok', 'BaseException', 'ValidationException', 'ok', 'ok', 'ValidationException', 'ok', 'Error', 'Error'],
        ] },
    },
    {
        id: 'P5101-SER-002',
        covers: 'P5-101 E-7: fromJSON and toJSON through the binary layout: maps, dates, relationships, undefined, NaN, -0 and array holes round-trip as in 5.0.0, and invalid or deep documents throw the same classes',
        run: (core) => {
            const mm = shapesManager(core);
            const factory = new core.Factory(mm);
            const serializer = new core.Serializer(factory, mm);
            const json = {
                $class: 'org.p5101.shapes@1.0.0.Thing', id: 't1', code: 'A1',
                addr: { $class: 'org.p5101.shapes@1.0.0.Address', street: 'main' },
                nums: [1, -2, 2147483648], ratio: 0.5, when: '2024-01-02T03:04:05.000+02:00',
                other: 'resource:org.p5101.shapes@1.0.0.Thing#t2',
                tags: { a: 'b', 'ü': 'ß' },
            };
            const resource = serializer.fromJSON(json);
            const out = [serializer.toJSON(resource), serializer.toJSON(resource, { utcOffset: -120 })];
            resource.ratio = NaN;
            out.push(probe(() => serializer.toJSON(resource)));
            resource.ratio = -0;
            out.push(Object.is(serializer.toJSON(resource).ratio, -0));
            resource.ratio = undefined;
            out.push(serializer.toJSON(resource));
            resource.nums = [1, , 3]; // eslint-disable-line no-sparse-arrays
            out.push(probe(() => serializer.toJSON(resource)));
            out.push(probe(() => serializer.toJSON(resource, { validate: false })));
            out.push(probe(() => serializer.fromJSON({ ...json, nums: [1, , 3] }))); // eslint-disable-line no-sparse-arrays
            out.push(probe(() => serializer.fromJSON({ ...json, ratio: undefined })));
            out.push(probe(() => serializer.fromJSON({ ...json, code: 'B' })));
            out.push(probe(() => serializer.fromJSON({ ...json, extra: deep(120) })));
            out.push(probe(() => serializer.fromJSON({ ...json, extra: deep(20) })));
            out.push(probe(() => serializer.fromJSON({ ...json, tags: new Map([['a', 'b']]) })));
            return out;
        },
        // BC-39 (P5-53): `code: 'B'` fails its `regex` validator: a
        // ValidationException; v5.0.0 threw a BaseException.
        expect: { ok: SER_002('ValidationException') },
        reference: { ok: SER_002('BaseException') },
    },
];
