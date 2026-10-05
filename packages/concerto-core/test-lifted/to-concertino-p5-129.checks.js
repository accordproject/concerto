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
 * P5-129 lifted checks (accordproject/concerto-rust#506, BC-54):
 * `ModelManager.toConcertino({ namespaces, decoratorCommandSets,
 * vocabularyManager, locale, decorateOptions })`, which is new in R1
 * (additive). v5.0.0 has no such method, so every `reference` outcome is the
 * TypeError of calling it.
 *
 * - TC-001: the round trip, Concertino back to the metamodel, gives
 *   `getAst(true)` (with no source locations, which Concertino does not keep);
 * - TC-002: the same document as the browser CTO pipeline (concerto-cto,
 *   `@accordproject/concertino/resolve`, `convertToConcertino`);
 * - TC-003: a decorator with a primitive type reference (`@Foo(String)`),
 *   for which `getAst(true)` throws;
 * - TC-004, TC-005, TC-012: namespace filtering, with the import closure
 *   (TC-012: a model from an AST with no `imports`);
 * - TC-006 to TC-008: decorator command sets and vocabulary, applied in that
 *   order, with the source manager unchanged;
 * - TC-009 to TC-011: the error classes (unknown or system namespace, a
 *   vocabulary without a locale, models that do not resolve).
 *
 * A throw is reduced to its class (error parity, maintainer decision
 * 2026-09-27). Run by fallbacks.spec.js.
 */

const { ConcertinoConverter, convertToConcertino } = require('@accordproject/concertino');
const { resolveModels } = require('@accordproject/concertino/resolve');
const { VocabularyManager } = require('@accordproject/concerto-vocabulary');
const { Parser } = require('@accordproject/concerto-cto');

const MODELS = {
    'a.cto': `namespace a@1.0.0
@Term("Base")
abstract concept A { o String s }
enum Colour { o RED o GREEN }`,
    'b.cto': `namespace b@1.0.0
import a@1.0.0.{A as AA, Colour}
import concerto.decorator@1.0.0.{Decorator}
concept Label extends Decorator { o String text }
@Label("x")
concept B identified by id extends AA {
  o String id
  o Integer n range=[0,] optional
  o Colour colour default="RED"
  --> B parent optional
}
asset C identified by cid { o String cid }
map M { o String o B }`,
    'c.cto': `namespace c@1.0.0
import a@1.0.0.{A}
import b@1.0.0.{B}
concept Z extends A { o B b o String z }`,
    'd.cto': `namespace d@1.0.0
scalar Email extends String regex=/^\\S+@\\S+$/
event E { o Email email }`,
};

const DC = 'org.accordproject.decoratorcommands@0.4.0';
const MM = 'concerto.metamodel@1.0.0';

/**
 * A decorator command set that UPSERTs one decorator with a string argument.
 * @param {object} target the command target (namespace, declaration, property)
 * @param {string} name the decorator name
 * @param {string} value its argument
 * @returns {object} the DecoratorCommandSet
 */
function dcs(target, name, value) {
    return {
        $class: `${DC}.DecoratorCommandSet`, name: 'p5-129', version: '1.0.0',
        commands: [{
            $class: `${DC}.Command`, type: 'UPSERT',
            target: { $class: `${DC}.CommandTarget`, ...target },
            decorator: { $class: `${MM}.Decorator`, name, arguments: [{ $class: `${MM}.DecoratorString`, value }] },
        }],
    };
}

const VOCABULARY = `locale: en
namespace: d@1.0.0
declarations:
  - E: An event
    properties:
      - email: E-mail address
`;

/**
 * A manager holding MODELS.
 * @param {object} core the core under test
 * @returns {object} the ModelManager
 */
function manager(core) {
    const mm = new core.ModelManager();
    for (const [name, cto] of Object.entries(MODELS)) {
        mm.addCTOModel(cto, name);
    }
    return mm;
}

/**
 * Runs `fn`, reducing a throw to its class.
 * @param {Function} fn the call
 * @returns {Array} `['ok', value]` or `['throws', class]`
 */
function probe(fn) {
    try {
        return ['ok', fn()];
    } catch (e) {
        return ['throws', e && e.constructor ? e.constructor.name : typeof e];
    }
}

/**
 * JSON with sorted keys and without `location`, for comparing ASTs.
 * @param {*} x the value
 * @returns {string} its canonical JSON
 */
function canonical(x) {
    const sort = (v) => {
        if (Array.isArray(v)) {
            return v.map(sort);
        }
        if (v && typeof v === 'object') {
            return Object.fromEntries(Object.keys(v).filter((k) => k !== 'location').sort().map((k) => [k, sort(v[k])]));
        }
        return v;
    };
    return JSON.stringify(sort(x));
}

const NO_METHOD = { ok: ['throws', 'TypeError'] };

module.exports = [
    {
        id: 'TC-001',
        covers: 'toConcertino round trip: converted back, it is getAst(true)',
        run: (core) => probe(() => {
            const mm = manager(core);
            const doc = mm.toConcertino();
            const back = new ConcertinoConverter().toConcertoMetamodel(doc);
            return {
                version: doc.metadata.concertinoVersion,
                valid: new ConcertinoConverter().isValid(doc),
                declarations: Object.keys(doc.declarations).sort(),
                roundTrip: canonical(back) === canonical(mm.getAst(true)),
            };
        }),
        expect: { ok: ['ok', {
            version: '5.1.0',
            valid: true,
            declarations: ['a@1.0.0.A', 'a@1.0.0.Colour', 'b@1.0.0.B', 'b@1.0.0.C', 'b@1.0.0.Label', 'b@1.0.0.M', 'c@1.0.0.Z', 'd@1.0.0.E', 'd@1.0.0.Email'],
            roundTrip: true,
        }] },
        reference: NO_METHOD,
    },
    {
        id: 'TC-002',
        covers: 'toConcertino gives the document of the browser CTO pipeline',
        run: (core) => probe(() => {
            const doc = manager(core).toConcertino();
            const { models, diagnostics } = resolveModels(Object.entries(MODELS).map(([name, cto]) => Parser.parse(cto, name)));
            return { diagnostics: diagnostics.length, same: canonical(doc) === canonical(convertToConcertino(models)) };
        }),
        expect: { ok: ['ok', { diagnostics: 0, same: true }] },
        reference: NO_METHOD,
    },
    {
        id: 'TC-003',
        covers: 'toConcertino with a primitive decorator type reference, where getAst(true) throws',
        run: (core) => {
            const mm = new core.ModelManager();
            mm.addCTOModel(`namespace p@1.0.0
@Foo(String)
concept P { o String s }`, 'p.cto');
            return {
                getAst: probe(() => mm.getAst(true) && 'ok')[0],
                toConcertino: probe(() => mm.toConcertino().metadata.models['p@1.0.0'] !== undefined),
            };
        },
        expect: { ok: { getAst: 'throws', toConcertino: ['ok', true] } },
        reference: { ok: { getAst: 'throws', toConcertino: ['throws', 'TypeError'] } },
    },
    {
        id: 'TC-004',
        covers: 'toConcertino namespaces: a namespace with its import closure',
        run: (core) => probe(() => {
            const mm = manager(core);
            const outline = (doc) => ({
                namespaces: Object.keys(doc.metadata.models).sort(),
                declarations: Object.keys(doc.declarations).sort(),
            });
            return {
                c: outline(mm.toConcertino({ namespaces: ['c@1.0.0'] })),
                b: outline(mm.toConcertino({ namespaces: ['b@1.0.0'] })),
                ad: outline(mm.toConcertino({ namespaces: ['d@1.0.0', 'a@1.0.0', 'd@1.0.0'] })),
                none: outline(mm.toConcertino({ namespaces: [] })),
            };
        }),
        expect: { ok: ['ok', {
            c: {
                namespaces: ['a@1.0.0', 'b@1.0.0', 'c@1.0.0'],
                declarations: ['a@1.0.0.A', 'a@1.0.0.Colour', 'b@1.0.0.B', 'b@1.0.0.C', 'b@1.0.0.Label', 'b@1.0.0.M', 'c@1.0.0.Z'],
            },
            b: {
                namespaces: ['a@1.0.0', 'b@1.0.0'],
                declarations: ['a@1.0.0.A', 'a@1.0.0.Colour', 'b@1.0.0.B', 'b@1.0.0.C', 'b@1.0.0.Label', 'b@1.0.0.M'],
            },
            ad: {
                namespaces: ['a@1.0.0', 'd@1.0.0'],
                declarations: ['a@1.0.0.A', 'a@1.0.0.Colour', 'd@1.0.0.E', 'd@1.0.0.Email'],
            },
            none: { namespaces: [], declarations: [] },
        }] },
        reference: NO_METHOD,
    },
    {
        id: 'TC-005',
        covers: 'toConcertino namespaces: a filtered document is the full one restricted to the closure',
        run: (core) => probe(() => {
            const mm = manager(core);
            const full = mm.toConcertino();
            const part = mm.toConcertino({ namespaces: ['b@1.0.0'] });
            return Object.keys(part.declarations).every((k) => canonical(part.declarations[k]) === canonical(full.declarations[k]));
        }),
        expect: { ok: ['ok', true] },
        reference: NO_METHOD,
    },
    {
        id: 'TC-006',
        covers: 'toConcertino decoratorCommandSets: applied first, the source manager unchanged',
        run: (core) => probe(() => {
            const mm = manager(core);
            const doc = mm.toConcertino({
                decoratorCommandSets: [dcs({ namespace: 'd@1.0.0', declaration: 'E' }, 'Hello', 'world')],
                namespaces: ['d@1.0.0'],
            });
            return {
                metadata: doc.declarations['d@1.0.0.E'].metadata,
                source: mm.getType('d@1.0.0.E').getDecorators().length,
            };
        }),
        expect: { ok: ['ok', { metadata: { Hello: ['world'] }, source: 0 }] },
        reference: NO_METHOD,
    },
    {
        id: 'TC-007',
        covers: 'toConcertino vocabularyManager and locale: the @Term vocabulary is in the document',
        run: (core) => probe(() => {
            const mm = manager(core);
            const vocabularies = new VocabularyManager();
            vocabularies.addVocabulary(VOCABULARY);
            const doc = mm.toConcertino({ vocabularyManager: vocabularies, locale: 'en', namespaces: ['d@1.0.0'] });
            return {
                declaration: doc.declarations['d@1.0.0.E'].vocabulary,
                property: doc.declarations['d@1.0.0.E'].properties.email.vocabulary,
                source: mm.getType('d@1.0.0.E').getDecorators().length,
            };
        }),
        expect: { ok: ['ok', { declaration: { label: 'An event' }, property: { label: 'E-mail address' }, source: 0 }] },
        reference: NO_METHOD,
    },
    {
        id: 'TC-008',
        covers: 'toConcertino applies the vocabulary after the decorator command sets, with decorateOptions',
        run: (core) => probe(() => {
            const mm = manager(core);
            const vocabularies = new VocabularyManager();
            vocabularies.addVocabulary(VOCABULARY);
            const decorateOptions = { validate: true, validateCommands: true };
            const doc = mm.toConcertino({
                decoratorCommandSets: dcs({ namespace: 'd@1.0.0', declaration: 'E' }, 'Term', 'From the command set'),
                vocabularyManager: vocabularies,
                locale: 'en',
                decorateOptions,
            });
            return {
                vocabulary: doc.declarations['d@1.0.0.E'].vocabulary,
                base: doc.declarations['a@1.0.0.A'].vocabulary,
                decorateOptions,
            };
        }),
        expect: { ok: ['ok', {
            vocabulary: { label: 'An event' },
            base: { label: 'Base' },
            decorateOptions: { validate: true, validateCommands: true },
        }] },
        reference: NO_METHOD,
    },
    {
        id: 'TC-009',
        covers: 'toConcertino namespaces: an unknown or system namespace throws Error',
        run: (core) => {
            const mm = manager(core);
            return [
                probe(() => mm.toConcertino({ namespaces: ['x@1.0.0'] })),
                probe(() => mm.toConcertino({ namespaces: ['a@1.0.0', 'a@2.0.0'] })),
                probe(() => mm.toConcertino({ namespaces: ['concerto@1.0.0'] })),
                probe(() => mm.toConcertino({ namespaces: ['concerto.decorator@1.0.0'] })),
            ];
        },
        expect: { ok: [['throws', 'Error'], ['throws', 'Error'], ['throws', 'Error'], ['throws', 'Error']] },
        reference: { ok: [['throws', 'TypeError'], ['throws', 'TypeError'], ['throws', 'TypeError'], ['throws', 'TypeError']] },
    },
    {
        id: 'TC-010',
        covers: 'toConcertino vocabularyManager without a locale throws Error',
        run: (core) => {
            const vocabularies = new VocabularyManager();
            vocabularies.addVocabulary(VOCABULARY);
            return probe(() => manager(core).toConcertino({ vocabularyManager: vocabularies }));
        },
        expect: { ok: ['throws', 'Error'] },
        reference: NO_METHOD,
    },
    {
        id: 'TC-011',
        covers: 'toConcertino on models that do not resolve (loaded without validation) throws IllegalModelException',
        run: (core) => {
            const mm = new core.ModelManager();
            mm.addCTOModel(`namespace u@1.0.0
concept Q { o Missing m }`, 'u.cto', true);
            return probe(() => mm.toConcertino());
        },
        expect: { ok: ['throws', 'IllegalModelException'] },
        reference: NO_METHOD,
    },
    {
        id: 'TC-012',
        covers: 'toConcertino namespaces: a model loaded from an AST with no imports',
        run: (core) => probe(() => {
            const mm = new core.ModelManager();
            mm.fromAst({ $class: `${MM}.Models`, models: [{
                $class: `${MM}.Model`, namespace: 'n@1.0.0',
                declarations: [{ $class: `${MM}.ConceptDeclaration`, name: 'N', isAbstract: false, properties: [] }],
            }] });
            return Object.keys(mm.toConcertino({ namespaces: ['n@1.0.0'] }).declarations);
        }),
        expect: { ok: ['ok', ['n@1.0.0.N']] },
        reference: NO_METHOD,
    },
];
