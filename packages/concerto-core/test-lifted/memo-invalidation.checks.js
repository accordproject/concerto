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
 * P5-104 lifted checks (accordproject/concerto-rust#458, F-13): the
 * engine's memos follow model changes.
 *
 * The engine's memos (the manager's read memo for `getType` and
 * `resolveType`, the views' property and identifier lookups, the
 * serializer's validation plan) sit in src/engine/, which the coverage gate
 * leaves out. Each check first reads every memoised fact once, so the memos
 * are warm, then changes the models and reads them again:
 * - `MEMO-01`: a super type's model file is updated; a subclass declared in
 *   another file must see the new identifier, properties and super types,
 *   and instances must validate against them.
 * - `MEMO-02`: two managers load the same models; changing one must not
 *   change what the other answers, in either direction.
 * - `MEMO-03`: forks of one base (`ModelManager.fork()`, P5-97, new: v5.0.0
 *   has none, so its `reference` is `'no fork'`); changing a fork must not
 *   change the base or a sibling fork, and changing the base must not
 *   change a fork made before.
 *
 * `expect` is the frozen v5.0.0 reference's outcome, which src matches.
 * Run by fallbacks.spec.js.
 */

const NO_FORK = 'no fork';

const A_NS = 'org.acme.memo.a@1.0.0';
const B_NS = 'org.acme.memo.b@1.0.0';

const A_ID = `namespace ${A_NS}
participant Base identified by id {
  o String id
  o String name optional
}
`;

const A_VIN = `namespace ${A_NS}
participant Base identified by vin {
  o String vin
  o Integer seats optional
}
`;

const B = `namespace ${B_NS}
import ${A_NS}.{Base}
participant Car extends Base {
  o String model optional
}
concept Garage {
  --> Car car optional
  o Base keeper optional
}
`;

/**
 * A manager with A_ID in `a.cto` and B in `b.cto`.
 * @param {object} core the core
 * @returns {object} the model manager
 */
function load(core) {
    const mm = new core.ModelManager();
    mm.addCTOModel(A_ID, 'a.cto');
    mm.addCTOModel(B, 'b.cto');
    return mm;
}

/**
 * Whether `json` deserializes (and so validates) through `mm`'s serializer,
 * or the class of the error it throws.
 * @param {object} mm the model manager
 * @param {object} json the instance
 * @returns {string} `'valid'` or the error class
 */
function verdict(mm, json) {
    try {
        mm.getSerializer().fromJSON(json);
        return 'valid';
    } catch (e) {
        return e && e.constructor ? e.constructor.name : typeof e;
    }
}

/**
 * The memoised facts about `Car` that a change to `Base` moves.
 * @param {object} mm the model manager
 * @returns {object} the facts
 */
function facts(mm) {
    const car = mm.getType(`${B_NS}.Car`);
    const typeOf = (name) => {
        const property = car.getProperty(name);
        return property ? property.getType() : null;
    };
    const keeper = mm.getType(`${B_NS}.Garage`).getProperty('keeper');
    return {
        identifier: car.getIdentifierFieldName(),
        properties: car.getProperties().map((p) => p.getName()),
        name: typeOf('name'),
        seats: typeOf('seats'),
        superTypes: car.getAllSuperTypeDeclarations().map((d) => d.getFullyQualifiedName()),
        keeper: mm.getType(keeper.getFullyQualifiedTypeName()).getIdentifierFieldName(),
        resolved: mm.resolveType('memo', `${A_NS}.Base`),
        byId: verdict(mm, { $class: `${B_NS}.Car`, id: 'C1' }),
        byVin: verdict(mm, { $class: `${B_NS}.Car`, vin: 'V1', seats: 4 }),
    };
}

const BY_ID = {
    identifier: 'id',
    properties: ['model', 'id', 'name', '$identifier'],
    name: 'String',
    seats: null,
    superTypes: [`${A_NS}.Base`, 'concerto@1.0.0.Participant', 'concerto@1.0.0.Concept'],
    keeper: 'id',
    resolved: `${A_NS}.Base`,
    byId: 'valid',
    byVin: 'Error',
};

const BY_VIN = {
    identifier: 'vin',
    properties: ['model', 'vin', 'seats', '$identifier'],
    name: null,
    seats: 'Integer',
    superTypes: [`${A_NS}.Base`, 'concerto@1.0.0.Participant', 'concerto@1.0.0.Concept'],
    keeper: 'vin',
    resolved: `${A_NS}.Base`,
    byId: 'Error',
    byVin: 'valid',
};

const checks = [
    {
        id: 'MEMO-01',
        covers: 'a super type updated in another file reaches a warm subclass: identifier, properties, super types, field types and validation',
        run: (core) => {
            const mm = load(core);
            const before = facts(mm);
            mm.updateModelFile(A_VIN, 'a.cto');
            const updated = facts(mm);
            mm.updateModelFile(A_ID, 'a.cto');
            const restored = facts(mm);
            return { before, updated, restored };
        },
        expect: { ok: { before: BY_ID, updated: BY_VIN, restored: BY_ID } },
    },
    {
        id: 'MEMO-02',
        covers: 'two managers with the same models: a change to one leaves the other\'s warm answers alone, in both directions',
        run: (core) => {
            const one = load(core);
            const two = load(core);
            const warm = { one: facts(one), two: facts(two) };
            one.updateModelFile(A_VIN, 'a.cto');
            const oneChanged = { one: facts(one), two: facts(two) };
            two.updateModelFile(A_VIN, 'a.cto');
            one.updateModelFile(A_ID, 'a.cto');
            const swapped = { one: facts(one), two: facts(two) };
            two.deleteModelFile(B_NS);
            const deleted = {
                one: facts(one),
                two: two.getNamespaces().filter((n) => n.startsWith('org.')),
            };
            return { warm, oneChanged, swapped, deleted };
        },
        expect: { ok: {
            warm: { one: BY_ID, two: BY_ID },
            oneChanged: { one: BY_VIN, two: BY_ID },
            swapped: { one: BY_ID, two: BY_VIN },
            deleted: { one: BY_ID, two: [A_NS] },
        } },
    },
    {
        id: 'MEMO-03',
        covers: 'forks of one base: a change to a fork leaves the base and a sibling alone; a change to the base leaves an earlier fork alone',
        run: (core) => {
            const base = load(core);
            if (typeof base.fork !== 'function') {
                return NO_FORK;
            }
            const warm = facts(base);
            const changed = base.fork();
            const sibling = base.fork();
            facts(changed);
            facts(sibling);
            changed.updateModelFile(A_VIN, 'a.cto');
            const forkChanged = { base: facts(base), changed: facts(changed), sibling: facts(sibling) };
            base.updateModelFile(A_VIN, 'a.cto');
            const baseChanged = { base: facts(base), changed: facts(changed), sibling: facts(sibling), later: facts(base.fork()) };
            return { warm, forkChanged, baseChanged };
        },
        expect: { ok: {
            warm: BY_ID,
            forkChanged: { base: BY_ID, changed: BY_VIN, sibling: BY_ID },
            baseChanged: { base: BY_VIN, changed: BY_VIN, sibling: BY_ID, later: BY_VIN },
        } },
        reference: { ok: NO_FORK },
    },
];

module.exports = checks;
