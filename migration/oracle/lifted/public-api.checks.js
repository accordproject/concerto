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
 * P5-02b lifted checks: small public-API members whose only coverage was a
 * white-box or ts-mode test before P5-02, checked through the public API
 * against the frozen v5.0.0 reference. Run by fallbacks.spec.js.
 *
 * - `ModelUtil`'s memoised engine calls (src/modelutil.ts): the non-string
 *   argument arm (not memoised, straight to the engine), the memo's size
 *   limit, and the map key/value predicates;
 * - `Identifiable.toURI()`'s `ResourceId` guards (src/model/resourceid.ts);
 * - `StringValidator.matchesRegex` with no regex;
 * - `BaseModelManager.isAliasedTypeEnabled` and
 *   `DecoratorManager.isNamespaceTargetEnabled`.
 */

const NS = 'org.acme.lifted.p502b.publicapi@1.0.0';

const MODEL = `namespace ${NS}
scalar SS extends String
scalar SI extends Integer
asset A identified by id { o String id }
concept C { o String s length=[1,3] }
map M { o String o String }
map MS { o SS o SS }
`;

/**
 * A model manager over MODEL.
 * @param {object} core the core under test
 * @returns {object} the model manager
 */
function setup(core) {
    const mm = new core.ModelManager();
    mm.addCTOModel(MODEL, 'publicapi.cto');
    return mm;
}

/**
 * Calls `ModelUtil[name](...args)`, reporting a throw as its message.
 * @param {object} core the core under test
 * @param {string} name the ModelUtil member
 * @param {Array} args the arguments
 * @returns {string} the stringified result, or `<ErrorClass>: <message>`
 */
function util(core, name, args) {
    try {
        return String(core.ModelUtil[name](...args));
    } catch (e) {
        return `${e.constructor.name}: ${e.message}`;
    }
}

/**
 * `toURI()` of an asset after clearing one of its identifying parts.
 * @param {object} core the core under test
 * @param {string|string[]} prop the propert(y|ies) to blank
 * @returns {string} the URI (or throws)
 */
function uriWithout(core, prop) {
    const mm = setup(core);
    const r = new core.Factory(mm).newResource(NS, 'A', 'a1');
    for (const p of [].concat(prop)) {
        r[p] = '';
    }
    return r.toURI();
}

module.exports = [
    {
        id: 'PA-MU-001',
        covers: 'modelutil.ts: non-string arguments go straight to the engine (not memoised)',
        run: (core) => [
            util(core, 'getShortName', [5]),
            util(core, 'getShortName', [undefined]),
            util(core, 'isPrimitiveType', [5]),
            util(core, 'capitalizeFirstLetter', [5]),
            util(core, 'isValidIdentifier', [null]),
            util(core, 'getFullyQualifiedName', [5, 'X']),
            util(core, 'removeNamespaceVersionFromFullyQualifiedName', [5]),
            util(core, 'isPrivateSystemProperty', [undefined]),
        ],
        expect: {
            ok: [
                'TypeError: fqn.lastIndexOf is not a function',
                'TypeError: Cannot read properties of undefined (reading \'lastIndexOf\')',
                'false',
                'TypeError: string.charAt is not a function',
                'true',
                '5.X',
                'TypeError: fqn.lastIndexOf is not a function',
                'false'
            ]
        },
    },
    {
        id: 'PA-MU-002',
        covers: 'modelutil.ts: the engine memo is cleared at its size limit and stays correct',
        run: (core) => {
            let right = 0;
            for (let i = 0; i < 5000; i++) {
                if (core.ModelUtil.getShortName(`org.acme.p502b.memo.T${i}`) === `T${i}`) {
                    right++;
                }
            }
            return right;
        },
        expect: { ok: 5000 },
    },
    {
        id: 'PA-MU-003',
        covers: 'modelutil.ts: isValidMapKey / isValidMapValue / isValidMapKeyScalar',
        run: (core) => {
            const mm = setup(core);
            const d = (n) => mm.getType(`${NS}.${n}`);
            return [
                core.ModelUtil.isValidMapKey(d('M').getKey()),
                core.ModelUtil.isValidMapValue(d('M').getValue()),
                core.ModelUtil.isValidMapKey(d('MS').getKey()),
                core.ModelUtil.isValidMapValue(d('MS').getValue()),
                core.ModelUtil.isValidMapKeyScalar(d('SS')),
                core.ModelUtil.isValidMapKeyScalar(d('SI')),
            ];
        },
        expect: { ok: [ false, false, false, false, true, false ] },
    },
    {
        id: 'PA-RI-001',
        covers: 'resourceid.ts: toURI with an empty identifier',
        run: (core) => uriWithout(core, ['$identifier', 'id']),
        expect: { throws: { name: 'Error', message: 'Missing id' } },
    },
    {
        id: 'PA-RI-002',
        covers: 'resourceid.ts: toURI with an empty namespace',
        run: (core) => uriWithout(core, '$namespace'),
        expect: { throws: { name: 'Error', message: 'Missing namespace' } },
    },
    {
        id: 'PA-RI-003',
        covers: 'resourceid.ts: toURI with an empty type',
        run: (core) => uriWithout(core, '$type'),
        expect: { throws: { name: 'Error', message: 'Missing type' } },
    },
    {
        id: 'PA-SV-001',
        covers: 'stringvalidator.ts matchesRegex: a length-only validator has no regex',
        run: (core) => setup(core).getType(`${NS}.C`).getProperty('s').getValidator().matchesRegex('anything'),
        expect: { ok: true },
    },
    {
        id: 'PA-MM-001',
        covers: 'basemodelmanager.ts isAliasedTypeEnabled',
        run: (core) => setup(core).isAliasedTypeEnabled(),
        expect: { ok: true },
    },
    {
        id: 'PA-DM-001',
        covers: 'decoratormanager.ts isNamespaceTargetEnabled',
        run: (core) => core.DecoratorManager.isNamespaceTargetEnabled(),
        expect: { ok: true },
    },
    {
        id: 'PA-IG-001',
        covers: 'instancegenerator.ts visit: scalar-typed fields in a generated sample (visit unwraps the scalar, so getFieldValue never sees one)',
        run: (core) => {
            const mm = new core.ModelManager();
            mm.addCTOModel(`namespace ${NS.replace('@1.0.0', '.ig@1.0.0')}
scalar SS extends String default="d"
scalar SI extends Integer range=[3,4]
concept G { o SS s o SI i }`, 'ig.cto');
            const r = new core.Factory(mm).newConcept(NS.replace('@1.0.0', '.ig@1.0.0'), 'G', undefined, { generate: 'sample' });
            return { s: r.s, iType: typeof r.i, inRange: r.i >= 3 && r.i <= 4 };
        },
        expect: { ok: { s: 'd', iType: 'number', inRange: true } },
    },
];
