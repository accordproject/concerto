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
 * Lifted black-box scenarios (task P2-10, plan §2.3) that replace the W
 * (white-box) tests of packages/concerto-core/test/serializer/jsonpopulator.js.
 *
 * Each scenario drives `Serializer.fromJSON` — the public entry point that
 * builds a `JSONPopulator` and walks a class declaration with it — instead
 * of constructing a `JSONPopulator` directly over sinon-stubbed `Field`/
 * `Factory`/`Resource` objects. `options.validate: false` is used throughout
 * so the scenario exercises JSONPopulator's own conversion/lookup rules and
 * not ResourceValidator's (a separate ledger member, lifted separately).
 *
 * See MAP.tsv in this directory for the test -> scenario mapping.
 */

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
dayjs.extend(utc);

// A scalar field with a null value is dropped before JSONPopulator ever
// sees it (JSONPopulator#visitClassDeclaration -> getAssignableProperties
// filters null/undefined-valued properties). An array field does not get
// that treatment: each element is handed to JSONPopulator#convertItem /
// #convertToObject as-is. So the "from null" / "from undefined" scenarios
// below use a single-element array of the same primitive type to reach the
// same convertToObject branch a sinon-stubbed direct call would.
const CONVERT_MODEL = `
namespace org.acme.lifted.convert@1.0.0

concept ConvertBox identified by boxId {
  o String boxId
  o DateTime dt optional
  o Integer i optional
  o Long l optional
  o Double d optional
  o Boolean b optional
  o String s optional
  o DateTime[] dtArr optional
  o Integer[] iArr optional
  o Long[] lArr optional
  o Double[] dArr optional
  o Boolean[] bArr optional
  o String[] sArr optional
}
`;

const ITEM_MODEL = `
namespace org.acme.lifted.item@1.0.0

asset MyAsset1 identified by assetId {
  o String assetId
  o Integer assetValue optional
}

asset MyAsset2 identified by assetId {
  o String assetId
  o Integer integerValue optional
}

concept Container identified by containerId {
  o String containerId
  o MyAsset1 myAsset optional
}
`;

const noValidate = (extra) => Object.assign({ validate: false }, extra || {});

// id prefix: JP (JSONPopulator). Groups: CV = #convertToObject, IT = #convertItem.
const scenarios = [
    // ---- #convertToObject : DateTime ----------------------------------
    {
        id: 'JP-CV-001',
        model: CONVERT_MODEL,
        json: { $class: 'org.acme.lifted.convert@1.0.0.ConvertBox', boxId: 'b1', dt: '2016-10-20T05:34:03.519Z' },
        options: noValidate({ strictQualifiedDateTimes: true, utcOffset: 0 }),
    },
    {
        id: 'JP-CV-002',
        model: CONVERT_MODEL,
        json: { $class: 'org.acme.lifted.convert@1.0.0.ConvertBox', boxId: 'b1', dt: '2016-10-20T05:34:03.519+02:00' },
        options: noValidate({ strictQualifiedDateTimes: true, utcOffset: 0 }),
    },
    {
        id: 'JP-CV-003',
        model: CONVERT_MODEL,
        json: { $class: 'org.acme.lifted.convert@1.0.0.ConvertBox', boxId: 'b1', dt: '2016-10-20T05:34:03.519' },
        options: noValidate({ strictQualifiedDateTimes: true, utcOffset: 0 }),
    },
    {
        id: 'JP-CV-004',
        model: CONVERT_MODEL,
        json: { $class: 'org.acme.lifted.convert@1.0.0.ConvertBox', boxId: 'b1', dt: '2020-01-01' },
        options: noValidate({ strictQualifiedDateTimes: true, utcOffset: 0 }),
    },
    {
        id: 'JP-CV-005',
        model: CONVERT_MODEL,
        json: { $class: 'org.acme.lifted.convert@1.0.0.ConvertBox', boxId: 'b1', dt: dayjs.utc('2016-10-20T05:34:03Z') },
        options: noValidate(),
    },
    {
        id: 'JP-CV-006',
        model: CONVERT_MODEL,
        json: { $class: 'org.acme.lifted.convert@1.0.0.ConvertBox', boxId: 'b1', dt: 'abc' },
        options: noValidate(),
    },
    {
        id: 'JP-CV-007',
        model: CONVERT_MODEL,
        json: { $class: 'org.acme.lifted.convert@1.0.0.ConvertBox', boxId: 'b1', dtArr: [null] },
        options: noValidate(),
    },
    {
        id: 'JP-CV-008',
        model: CONVERT_MODEL,
        json: { $class: 'org.acme.lifted.convert@1.0.0.ConvertBox', boxId: 'b1', dtArr: [undefined] },
        options: noValidate(),
    },
    {
        id: 'JP-CV-009',
        model: CONVERT_MODEL,
        json: { $class: 'org.acme.lifted.convert@1.0.0.ConvertBox', boxId: 'b1', dt: '2016-10-20T05:34:03.519' },
        options: noValidate({ strictQualifiedDateTimes: false, utcOffset: 0 }),
    },
    {
        id: 'JP-CV-010',
        model: CONVERT_MODEL,
        json: { $class: 'org.acme.lifted.convert@1.0.0.ConvertBox', boxId: 'b1', dt: '2020-01-01' },
        options: noValidate({ strictQualifiedDateTimes: false, utcOffset: 0 }),
    },
    {
        id: 'JP-CV-011',
        model: CONVERT_MODEL,
        json: { $class: 'org.acme.lifted.convert@1.0.0.ConvertBox', boxId: 'b1', dt: '2016-10-20T05:34:03.519' },
        options: noValidate({ strictQualifiedDateTimes: false, utcOffset: 120 }),
    },

    // ---- #convertToObject : Integer -----------------------------------
    {
        id: 'JP-CV-012',
        model: CONVERT_MODEL,
        json: { $class: 'org.acme.lifted.convert@1.0.0.ConvertBox', boxId: 'b1', i: '32768' },
        options: noValidate(),
    },
    {
        id: 'JP-CV-013',
        model: CONVERT_MODEL,
        json: { $class: 'org.acme.lifted.convert@1.0.0.ConvertBox', boxId: 'b1', iArr: [null] },
        options: noValidate(),
    },
    {
        id: 'JP-CV-014',
        model: CONVERT_MODEL,
        json: { $class: 'org.acme.lifted.convert@1.0.0.ConvertBox', boxId: 'b1', iArr: [undefined] },
        options: noValidate(),
    },
    {
        id: 'JP-CV-015',
        model: CONVERT_MODEL,
        json: { $class: 'org.acme.lifted.convert@1.0.0.ConvertBox', boxId: 'b1', i: 32768 },
        options: noValidate(),
    },

    // ---- #convertToObject : Long ---------------------------------------
    {
        id: 'JP-CV-016',
        model: CONVERT_MODEL,
        json: { $class: 'org.acme.lifted.convert@1.0.0.ConvertBox', boxId: 'b1', l: '32768' },
        options: noValidate(),
    },
    {
        id: 'JP-CV-017',
        model: CONVERT_MODEL,
        json: { $class: 'org.acme.lifted.convert@1.0.0.ConvertBox', boxId: 'b1', lArr: [null] },
        options: noValidate(),
    },
    {
        id: 'JP-CV-018',
        model: CONVERT_MODEL,
        json: { $class: 'org.acme.lifted.convert@1.0.0.ConvertBox', boxId: 'b1', lArr: [undefined] },
        options: noValidate(),
    },
    {
        id: 'JP-CV-019',
        model: CONVERT_MODEL,
        json: { $class: 'org.acme.lifted.convert@1.0.0.ConvertBox', boxId: 'b1', l: 32768 },
        options: noValidate(),
    },
    {
        id: 'JP-CV-020',
        model: CONVERT_MODEL,
        json: { $class: 'org.acme.lifted.convert@1.0.0.ConvertBox', boxId: 'b1', l: 32.768 },
        options: noValidate(),
    },

    // ---- #convertToObject : Double -------------------------------------
    {
        id: 'JP-CV-021',
        model: CONVERT_MODEL,
        json: { $class: 'org.acme.lifted.convert@1.0.0.ConvertBox', boxId: 'b1', d: '32.768' },
        options: noValidate(),
    },
    {
        id: 'JP-CV-022',
        model: CONVERT_MODEL,
        json: { $class: 'org.acme.lifted.convert@1.0.0.ConvertBox', boxId: 'b1', dArr: [null] },
        options: noValidate(),
    },
    {
        id: 'JP-CV-023',
        model: CONVERT_MODEL,
        json: { $class: 'org.acme.lifted.convert@1.0.0.ConvertBox', boxId: 'b1', dArr: [undefined] },
        options: noValidate(),
    },
    {
        id: 'JP-CV-024',
        model: CONVERT_MODEL,
        json: { $class: 'org.acme.lifted.convert@1.0.0.ConvertBox', boxId: 'b1', d: 32.768 },
        options: noValidate(),
    },

    // ---- #convertToObject : Boolean ------------------------------------
    {
        id: 'JP-CV-025',
        model: CONVERT_MODEL,
        json: { $class: 'org.acme.lifted.convert@1.0.0.ConvertBox', boxId: 'b1', b: true },
        options: noValidate(),
    },
    {
        id: 'JP-CV-026',
        model: CONVERT_MODEL,
        json: { $class: 'org.acme.lifted.convert@1.0.0.ConvertBox', boxId: 'b1', b: 'true' },
        options: noValidate(),
    },
    {
        id: 'JP-CV-027',
        model: CONVERT_MODEL,
        json: { $class: 'org.acme.lifted.convert@1.0.0.ConvertBox', boxId: 'b1', b: 32.768 },
        options: noValidate(),
    },
    {
        id: 'JP-CV-028',
        model: CONVERT_MODEL,
        json: { $class: 'org.acme.lifted.convert@1.0.0.ConvertBox', boxId: 'b1', bArr: [null] },
        options: noValidate(),
    },
    {
        id: 'JP-CV-029',
        model: CONVERT_MODEL,
        json: { $class: 'org.acme.lifted.convert@1.0.0.ConvertBox', boxId: 'b1', bArr: [undefined] },
        options: noValidate(),
    },

    // ---- #convertToObject : String --------------------------------------
    {
        id: 'JP-CV-030',
        model: CONVERT_MODEL,
        json: { $class: 'org.acme.lifted.convert@1.0.0.ConvertBox', boxId: 'b1', s: 'hello world' },
        options: noValidate(),
    },
    {
        id: 'JP-CV-031',
        model: CONVERT_MODEL,
        json: { $class: 'org.acme.lifted.convert@1.0.0.ConvertBox', boxId: 'b1', s: 32.768 },
        options: noValidate(),
    },
    {
        id: 'JP-CV-032',
        model: CONVERT_MODEL,
        json: { $class: 'org.acme.lifted.convert@1.0.0.ConvertBox', boxId: 'b1', sArr: [null] },
        options: noValidate(),
    },
    {
        id: 'JP-CV-033',
        model: CONVERT_MODEL,
        json: { $class: 'org.acme.lifted.convert@1.0.0.ConvertBox', boxId: 'b1', sArr: [undefined] },
        options: noValidate(),
    },

    // ---- #convertItem ----------------------------------------------------
    // A single (non-array) declared-type field (Container.myAsset, type
    // MyAsset1) reaches JSONPopulator#convertItem the same way the original
    // tests called it directly against `assetDeclaration1`.
    {
        id: 'JP-IT-001',
        model: ITEM_MODEL,
        json: {
            $class: 'org.acme.lifted.item@1.0.0.Container',
            containerId: 'c1',
            myAsset: { $class: 'org.acme.lifted.item@1.0.0.NOTAREALTYPE', assetId: 'asset1' },
        },
        options: noValidate(),
    },
    {
        id: 'JP-IT-002',
        model: ITEM_MODEL,
        json: {
            $class: 'org.acme.lifted.item@1.0.0.Container',
            containerId: 'c1',
            myAsset: { $class: 'org.acme.lifted.item@1.0.0.MyAsset1', assetId: 'asset1' },
        },
        options: noValidate(),
    },
    {
        id: 'JP-IT-003',
        model: ITEM_MODEL,
        json: {
            $class: 'org.acme.lifted.item@1.0.0.Container',
            containerId: 'c1',
            myAsset: { $class: 'org.acme.lifted.item@1.0.0.MyAsset1', assetId: 'asset1', assetValue: 1 },
        },
        options: noValidate(),
    },
    {
        id: 'JP-IT-004',
        model: ITEM_MODEL,
        json: {
            $class: 'org.acme.lifted.item@1.0.0.Container',
            containerId: 'c1',
            myAsset: { $class: 'org.acme.lifted.item@1.0.0.MyAsset1', assetId: 'asset1', assetValue: null },
        },
        options: noValidate(),
    },
    {
        // $class on the nested object names a *different* type (MyAsset2)
        // than the field's own declared type (MyAsset1): convertItem
        // resolves the declaration from jsonItem.$class, not from the field.
        id: 'JP-IT-005',
        model: ITEM_MODEL,
        json: {
            $class: 'org.acme.lifted.item@1.0.0.Container',
            containerId: 'c1',
            myAsset: { $class: 'org.acme.lifted.item@1.0.0.MyAsset2', assetId: 'asset2' },
        },
        options: noValidate(),
    },
    {
        // No $class on the nested object: convertItem falls back to the
        // field's own declared type (MyAsset1).
        id: 'JP-IT-006',
        model: ITEM_MODEL,
        json: {
            $class: 'org.acme.lifted.item@1.0.0.Container',
            containerId: 'c1',
            myAsset: { assetId: 'asset1' },
        },
        options: noValidate(),
    },
];

module.exports = scenarios;
