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
 * P5-114 lifted checks (accordproject/concerto-rust#484): the fixes from
 * the second end-to-end review that are visible from JS.
 *
 * - R2C-1: `decorateModels` with `validate` and `validateCommands` over a
 *   command set that validates as another DCS type (a `CommandTarget`) throws
 *   v5.0.0's `TypeError` (`commandSet.commands.forEach`), and the engine
 *   keeps working: it used to trap the WASM module.
 * - R2D-1: an instance nested past the engine's text-path depth limit is
 *   read and written as v5.0.0 does (`Serializer.fromJSON`, `toJSON`), by
 *   the visitor fallback, where it used to throw a `SyntaxError`; and
 *   `validateInstance` (new API, so `reference` is `'no validateInstance'`)
 *   validates it.
 * - R2C-4: a falsy `target.property` or `target.type` falls through to the
 *   next target field, as v5.0.0's truthiness `switch` does, so the command
 *   decorates the declaration; a truthy `target.properties` that is not an
 *   array is v5.0.0's `TypeError`.
 *
 * Only the exception class is compared, not the message (error parity
 * policy, 2026-09-27). `expect` is the frozen v5.0.0 reference's outcome,
 * which src matches. Run by fallbacks.spec.js.
 */

const NS = 'org.acme.lifted.p5114@1.0.0';

const PERSON = `namespace ${NS}\nconcept Person {\n  o String name\n}\n`;
const NESTED = `namespace ${NS}\nconcept N {\n  o N next optional\n}\n`;

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

/**
 * A manager holding `cto`.
 * @param {object} core the core under test
 * @param {string} cto the model
 * @returns {object} the model manager
 */
function managerOf(core, cto) {
    const mm = new core.ModelManager();
    mm.addCTOModel(cto, 'test.cto');
    return mm;
}

/**
 * A command set with one UPSERT of `@Marked` at `target`.
 * @param {object} target the command target
 * @returns {object} the command set
 */
function upsert(target) {
    return {
        $class: 'org.accordproject.decoratorcommands@0.4.0.DecoratorCommandSet',
        name: 'p5114',
        version: '1.0.0',
        commands: [{
            $class: 'org.accordproject.decoratorcommands@0.4.0.Command',
            type: 'UPSERT',
            target: Object.assign({ $class: 'org.accordproject.decoratorcommands@0.4.0.CommandTarget' }, target),
            decorator: { $class: 'concerto.metamodel@1.0.0.Decorator', name: 'Marked', arguments: [] },
        }],
    };
}

/**
 * The decorator names on `Person` and its `name` property.
 * @param {object} mm the decorated model manager
 * @returns {object} the names
 */
function personDecorators(mm) {
    const person = mm.getType(`${NS}.Person`);
    return {
        person: person.getDecorators().map((d) => d.getName()),
        name: person.getProperty('name').getDecorators().map((d) => d.getName()),
    };
}

/**
 * `{ $class: N, next: { ... } }`, `depth` levels below the root.
 * @param {number} depth how many `next` levels
 * @returns {object} the instance JSON
 */
function nested(depth) {
    let value = { $class: `${NS}.N` };
    for (let i = 0; i < depth; i++) {
        value = { $class: `${NS}.N`, next: value };
    }
    return value;
}

/**
 * How many `next` levels `json` has.
 * @param {object} json the instance JSON
 * @returns {number} the depth
 */
function depthOf(json) {
    let depth = 0;
    for (let v = json; v && v.next; v = v.next) {
        depth++;
    }
    return depth;
}

module.exports = [
    {
        id: 'P5114-R2C1-001',
        covers: 'R2C-1: decorateModels validating a CommandTarget-typed command set throws a TypeError, and the engine keeps working',
        run: (core) => {
            const mm = managerOf(core, PERSON);
            const options = { validate: true, validateCommands: true };
            const target = { $class: 'org.accordproject.decoratorcommands@0.4.0.CommandTarget' };
            const first = probe(() => core.DecoratorManager.decorateModels(mm, [target], options));
            const again = probe(() => core.DecoratorManager.decorateModels(mm, target, options));
            const decorated = core.DecoratorManager.decorateModels(mm, upsert({ namespace: NS, declaration: 'Person' }), options);
            const serializer = new core.Serializer(new core.Factory(mm), mm);
            const person = serializer.toJSON(serializer.fromJSON({ $class: `${NS}.Person`, name: 'x' }));
            return { first, again, after: personDecorators(decorated), person };
        },
        expect: { ok: {
            first: ['throws', 'TypeError'],
            again: ['throws', 'TypeError'],
            after: { person: ['Marked'], name: [] },
            person: { $class: `${NS}.Person`, name: 'x' },
        } },
    },
    {
        id: 'P5114-R2D1-001',
        covers: 'R2D-1: Serializer.fromJSON and toJSON read and write an instance nested past the engine text-path depth limit',
        run: (core) => {
            const mm = managerOf(core, NESTED);
            const serializer = new core.Serializer(new core.Factory(mm), mm);
            return [99, 100, 127, 130, 200, 600].map((depth) => probe(() => {
                const resource = serializer.fromJSON(nested(depth));
                return depthOf(serializer.toJSON(resource));
            }));
        },
        expect: { ok: [['ok', 99], ['ok', 100], ['ok', 127], ['ok', 130], ['ok', 200], ['ok', 600]] },
    },
    {
        id: 'P5114-R2D1-002',
        covers: 'R2D-1: validateInstance validates an instance nested past the engine text-path depth limit (new API)',
        run: (core) => {
            const mm = managerOf(core, NESTED);
            if (typeof mm.validateInstance !== 'function') {
                return 'no validateInstance';
            }
            return [130, 200].map((depth) => {
                const result = mm.validateInstance(nested(depth));
                return [result.valid, depthOf(new core.Serializer(new core.Factory(mm), mm).toJSON(result.resource))];
            });
        },
        expect: { ok: [[true, 130], [true, 200]] },
        reference: { ok: 'no validateInstance' },
    },
    {
        id: 'P5114-R2C4-001',
        covers: 'R2C-4: an empty target.property or target.type falls through, so the command decorates the declaration',
        run: (core) => {
            const mm = managerOf(core, PERSON);
            return ['property', 'type'].map((key) => {
                const decorated = core.DecoratorManager.decorateModels(mm, upsert({ namespace: NS, declaration: 'Person', [key]: '' }));
                return personDecorators(decorated);
            });
        },
        expect: { ok: [{ person: ['Marked'], name: [] }, { person: ['Marked'], name: [] }] },
    },
    {
        id: 'P5114-R2C4-002',
        covers: 'R2C-4: a truthy target.properties that is not an array throws a TypeError (validation off)',
        run: (core) => {
            const mm = managerOf(core, PERSON);
            return probe(() => core.DecoratorManager.decorateModels(mm, upsert({ declaration: 'Person', properties: 'name' })));
        },
        expect: { ok: ['throws', 'TypeError'] },
    },
];
