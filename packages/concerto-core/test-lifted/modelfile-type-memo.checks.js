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
 * P5-113 lifted checks (accordproject/concerto-rust#480): `ModelFile.getType`
 * answers from the manager's read memo, and a relationship-typed map's
 * values are decoded with the serializer's class lookups.
 *
 * `ModelFile.getType` keeps the engine's answer for each type name until
 * the model files change (the manager's read memo, P5-29), so a run of
 * Relationships of one type (a relationship-typed map's values) crosses
 * into the engine once rather than once per value. These checks read every
 * answer twice, warm, and again after model changes:
 * - `MFTYPE-01`: a local, an imported, a primitive and an unknown type,
 *   before and after the imported type's file changes (its identifier) and
 *   the importing file changes (a newly imported type);
 * - `MFTYPE-02`: two managers with the same models: a change to one leaves
 *   the other's warm answers alone;
 * - `MFTYPE-03`: a document with a relationship-typed map (BC-05, P5-58)
 *   read and written by fromJSON/toJSON, twice: every value a Relationship
 *   to the map's target type, and the document written back unchanged. TS
 *   5.0.0 rejects the document (BC-05), which is its `reference`.
 *
 * `expect` is the frozen v5.0.0 reference's outcome, which src matches,
 * except where `reference` says otherwise. Run by fallbacks.spec.js.
 */

const A_NS = 'org.acme.mftype.a@1.0.0';
const B_NS = 'org.acme.mftype.b@1.0.0';

const A_ID = `namespace ${A_NS}
participant Base identified by id {
  o String id
}
concept Extra {
  o String note optional
}
`;

const A_VIN = `namespace ${A_NS}
participant Base identified by vin {
  o String vin
}
concept Extra {
  o String note optional
}
`;

const B = `namespace ${B_NS}
import ${A_NS}.{Base}
participant Car extends Base {
  o String model optional
}
`;

const B_EXTRA = `namespace ${B_NS}
import ${A_NS}.{Base, Extra}
participant Car extends Base {
  o String model optional
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
 * What B's model file answers for each type name, read twice.
 * @param {object} mm the model manager
 * @returns {object[]} the answers of both reads
 */
function answers(mm) {
    const read = () => {
        const mf = mm.getModelFile(B_NS);
        const type = (name) => {
            const t = mf.getType(name);
            if (t === null || typeof t === 'string') {
                return t;
            }
            return `${t.getFullyQualifiedName()} by ${t.getIdentifierFieldName()}`;
        };
        return {
            local: type('Car'),
            imported: type('Base'),
            importedFqn: type(`${A_NS}.Base`),
            extra: type('Extra'),
            primitive: type('String'),
            unknown: type('Nope'),
        };
    };
    return [read(), read()];
}

const BY_ID = {
    local: `${B_NS}.Car by id`,
    imported: `${A_NS}.Base by id`,
    // A fully-qualified name is neither local nor imported here.
    importedFqn: null,
    extra: null,
    primitive: 'String',
    unknown: null,
};
const BY_VIN = { ...BY_ID, local: `${B_NS}.Car by vin`, imported: `${A_NS}.Base by vin` };
const WITH_EXTRA = { ...BY_VIN, extra: `${A_NS}.Extra by null` };

const MAPS_NS = 'org.acme.mftype.maps@1.0.0';
const MAPS = `namespace ${MAPS_NS}
participant Person identified by pid {
  o String pid
}
map RelMap {
  o String
  --> Person
}
concept Holder identified by hid {
  o String hid
  o RelMap refs optional
}
`;

/**
 * A `Holder` whose relationship map has 20 entries.
 * @param {number} j the document's number
 * @returns {object} the document
 */
function holder(j) {
    const refs = {};
    for (let i = 0; i < 20; i++) {
        refs[`k${i}`] = `resource:${MAPS_NS}.Person#p${j}-${i}`;
    }
    return { $class: `${MAPS_NS}.Holder`, hid: `h${j}`, refs };
}

const checks = [
    {
        id: 'MFTYPE-01',
        covers: 'ModelFile.getType read warm, then after the imported file and the importing file change',
        run: (core) => {
            const mm = load(core);
            const before = answers(mm);
            mm.updateModelFile(A_VIN, 'a.cto');
            const updated = answers(mm);
            mm.updateModelFile(B_EXTRA, 'b.cto');
            const imported = answers(mm);
            return { before, updated, imported };
        },
        expect: { ok: {
            before: [BY_ID, BY_ID],
            updated: [BY_VIN, BY_VIN],
            imported: [WITH_EXTRA, WITH_EXTRA],
        } },
    },
    {
        id: 'MFTYPE-02',
        covers: 'ModelFile.getType in two managers with the same models: a change to one leaves the other\'s warm answers alone',
        run: (core) => {
            const one = load(core);
            const two = load(core);
            const warm = { one: answers(one), two: answers(two) };
            one.updateModelFile(A_VIN, 'a.cto');
            return { warm, changed: { one: answers(one), two: answers(two) } };
        },
        expect: { ok: {
            warm: { one: [BY_ID, BY_ID], two: [BY_ID, BY_ID] },
            changed: { one: [BY_VIN, BY_VIN], two: [BY_ID, BY_ID] },
        } },
    },
    {
        id: 'MFTYPE-03',
        covers: 'a relationship-typed map read and written twice: every value a Relationship to the target type, written back unchanged',
        run: (core) => {
            const mm = new core.ModelManager();
            mm.addCTOModel(MAPS, 'maps.cto');
            const serializer = mm.getSerializer();
            return [0, 1].map((j) => {
                const json = holder(j);
                const resource = serializer.fromJSON(json);
                const values = [...resource.refs.values()];
                return {
                    relationships: values.every((v) => v instanceof core.Relationship),
                    types: [...new Set(values.map((v) => `${v.getFullyQualifiedType()} by ${v.$identifierFieldName}`))],
                    ids: values.slice(0, 2).map((v) => v.getIdentifier()),
                    roundTrip: JSON.stringify(serializer.toJSON(resource)) === JSON.stringify(json),
                };
            });
        },
        expect: { ok: [0, 1].map((j) => ({
            relationships: true,
            types: [`${MAPS_NS}.Person by pid`],
            ids: [`p${j}-0`, `p${j}-1`],
            roundTrip: true,
        })) },
        // v5.0.0 reads the first value as an embedded Person: a string's
        // characters are its unexpected properties.
        reference: { throws: {
            name: 'ValidationException',
            message: `Unexpected properties for type ${MAPS_NS}.Person: ${[...holder(0).refs.k0].map((_, i) => i).join(', ')}`,
        } },
    },
];

module.exports = checks;
