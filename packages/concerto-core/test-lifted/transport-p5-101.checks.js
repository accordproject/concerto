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
 * - D-10, M5: `addModelFiles` (and the DecoratorManager results it adds)
 *   registers its staged files in one engine call: the same namespaces, the
 *   same types, the same rollback on an error.
 * - D-3, E-7: `toJSON` reuses the options' wire text and the engine's
 *   serializer for them; `validateMetaModel` runs through the engine's
 *   validate-only binding: the same results and error classes.
 * - D-4: a DecoratorManager result's header is read in the one header
 *   format: the same imports and namespaces.
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
];
