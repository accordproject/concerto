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
 * (white-box) tests of
 * packages/concerto-core/test/introspect/stringvalidator.js.
 *
 * The original file builds a bare `StringValidator` directly over a
 * sinon-stubbed `Field` (`sinon.createStubInstance(Field)`). Every scenario
 * here instead builds a real `ModelManager` from CTO (or, where the AST a
 * real CTO parse produces cannot express the case, from a mutated metamodel
 * AST via `fromAst` -- a public entry point, same technique
 * `drivers/gaps.spec.js` uses), reads the real `StringValidator` back off a
 * real `Field` with `field.getValidator()`, and calls the same public
 * methods (`validate`, `getRegex`, `compatibleWith`) the W tests called on
 * their stub. `getValidator`, `validate`, `getRegex` and `compatibleWith`
 * are all recorded ops (see migration/oracle/lib/ops.js,
 * `INTROSPECTION_CLASSES` includes `StringValidator`), so calling them here
 * -- unlike the jsonpopulator.js lift -- does not need to go through
 * `Serializer.fromJSON` at all: the validator instance a real model
 * produces *is* the public API.
 *
 * Each entry is `{ id, run(ctx) }`, unlike the plain `{model,json,options}`
 * shape jsonpopulator.scenarios.js uses -- `drivers/lifted.spec.js` runs
 * `run(ctx)` directly for any entry that has one. `ctx` is
 * `{ ModelManager, Factory, Serializer }`. `run` never asserts: the recorder
 * (ORACLE_SOURCE=lifted) captures whatever the reference actually does.
 *
 * See MAP.tsv in this directory for the test -> scenario mapping.
 */

const NS = 'org.acme.lifted.stringvalidator';

/**
 * The versioned namespace a `${NS}.<name>@1.0.0` model declares.
 * @param {string} name the unversioned suffix used in both the CTO source
 *   and here, so the two can never drift apart.
 * @returns {string} the full namespace, with version
 */
function nsFor(name) {
    return `${NS}.${name}@1.0.0`;
}

/**
 * Build a ModelManager from a one-off CTO source string.
 * @param {object} ModelManager the ModelManager class
 * @param {string} cto a Concerto model
 * @param {string} file a filename (any distinct name; only used in errors)
 * @returns {object} the model manager
 */
function build(ModelManager, cto, file) {
    const mm = new ModelManager();
    mm.addCTOModel(cto, file);
    return mm;
}

/**
 * Get the real, model-built Field for `ns.Box.s`.
 * @param {object} mm a ModelManager
 * @param {string} ns the namespace of the model
 * @returns {object} the Field
 */
function fieldS(mm, ns) {
    return mm.getType(`${ns}.Box`).getProperty('s');
}

// ---- #constructor -----------------------------------------------------
// All nine constructor scenarios reach StringValidator's constructor the
// same way the reference always builds one: by loading a model with a
// String field carrying `regex=`/`length=`/`default=` clauses. Seven are
// expected to throw at load time (IllegalModelException, wrapping the
// StringValidator's own "Validator error for field ..." message); two
// (C9's own model, and every "loads fine" case below) are expected to
// succeed. Only the "no bound specified at all" case (SV-CTOR-002) cannot
// be produced by the CTO grammar -- an omitted bound compiles to an
// *absent* key, not an explicit `null` -- so it goes through `fromAst`
// instead, mutating a real, successfully-parsed AST's `lengthValidator`
// node before feeding it back through the model manager's own public
// `fromAst`, exactly as `drivers/gaps.spec.js` already does for other
// AST-shape edge cases.
const constructorScenarios = [
    {
        id: 'SV-CTOR-001',
        run: ({ ModelManager }) => {
            // Invalid regex: `\p{...}` with an unrecognised Unicode
            // property name is a syntactically well-formed regex literal
            // (so the CTO parser accepts it as one), but `new RegExp(...)`
            // itself throws a SyntaxError for it under the `u` flag --
            // StringValidator's own `new CustomRegExp(...)` catch reports
            // that as a "Validator error for field" IllegalModelException,
            // the same branch the W test's unparsable-to-JS pattern
            // string reached directly against the constructor.
            const cto = `
namespace ${NS}.c1@1.0.0
concept Box identified by id {
  o String id
  o String s regex=/\\p{NotAUnicodeProperty}/u
}
`;
            build(ModelManager, cto, 'c1.cto');
        },
    },
    {
        id: 'SV-CTOR-002',
        run: ({ ModelManager }) => {
            // No bound at all: minLength === null && maxLength === null.
            // Not reachable from CTO (an omitted bound is undefined, not
            // null); reached via fromAst on a mutated, otherwise-valid AST.
            const cto = `
namespace ${NS}.c2@1.0.0
concept Box identified by id {
  o String id
  o String s length=[1,10]
}
`;
            const mm0 = build(ModelManager, cto, 'c2.cto');
            const ast = mm0.getAst(false);
            const model = JSON.parse(
                JSON.stringify(ast.models.find((m) => m.namespace === `${NS}.c2@1.0.0`))
            );
            const box = model.declarations.find((d) => d.name === 'Box');
            const sField = box.properties.find((p) => p.name === 's');
            sField.lengthValidator = {
                $class: 'concerto.metamodel@1.0.0.StringLengthValidator',
                minLength: null,
                maxLength: null,
            };
            const mm = new ModelManager();
            mm.fromAst({ $class: 'concerto.metamodel@1.0.0.Models', models: [model] });
        },
    },
    {
        id: 'SV-CTOR-003',
        run: ({ ModelManager }) => {
            // minLength > maxLength.
            const cto = `
namespace ${NS}.c3@1.0.0
concept Box identified by id {
  o String id
  o String s length=[200,100]
}
`;
            build(ModelManager, cto, 'c3.cto');
        },
    },
    {
        id: 'SV-CTOR-004',
        run: ({ ModelManager }) => {
            // Negative minLength.
            const cto = `
namespace ${NS}.c4@1.0.0
concept Box identified by id {
  o String id
  o String s length=[-2,]
}
`;
            build(ModelManager, cto, 'c4.cto');
        },
    },
    {
        id: 'SV-CTOR-005',
        run: ({ ModelManager }) => {
            // Negative maxLength.
            const cto = `
namespace ${NS}.c5@1.0.0
concept Box identified by id {
  o String id
  o String s length=[,-100]
}
`;
            build(ModelManager, cto, 'c5.cto');
        },
    },
    {
        id: 'SV-CTOR-006',
        run: ({ ModelManager }) => {
            // Negative min and max length.
            const cto = `
namespace ${NS}.c6@1.0.0
concept Box identified by id {
  o String id
  o String s length=[-1,-100]
}
`;
            build(ModelManager, cto, 'c6.cto');
        },
    },
    {
        id: 'SV-CTOR-007',
        run: ({ ModelManager }) => {
            // defaultValue shorter than minLength.
            const cto = `
namespace ${NS}.c7@1.0.0
concept Box identified by id {
  o String id
  o String s default="abc" length=[5,10]
}
`;
            build(ModelManager, cto, 'c7.cto');
        },
    },
    {
        id: 'SV-CTOR-008',
        run: ({ ModelManager }) => {
            // defaultValue longer than maxLength.
            const cto = `
namespace ${NS}.c8@1.0.0
concept Box identified by id {
  o String id
  o String s default="abcdefgh" length=[2,5]
}
`;
            build(ModelManager, cto, 'c8.cto');
        },
    },
    {
        id: 'SV-CTOR-009',
        run: ({ ModelManager }) => {
            // A defaultValue that satisfies both the pattern and the length
            // bounds: expected to load without error.
            const cto = `
namespace ${NS}.c9@1.0.0
concept Box identified by id {
  o String id
  o String s default="ABC" regex=/^[A-Z]{3,5}$/ length=[3,5]
}
`;
            build(ModelManager, cto, 'c9.cto');
        },
    },
];

// ---- #validate ----------------------------------------------------------
// Each scenario loads a model whose String field `s` carries the same
// regex/length combination the matching W test gave `new StringValidator`
// directly, reads the real validator back with `field.getValidator()`, and
// calls `validate('id', value)` on it -- one or more times, for the
// repeated-call (global/sticky regex) cases -- exactly as the W test called
// it on its stub-backed instance. A "not leave lastIndex set" check itself
// cannot be lifted (see MAP.tsv): the oracle's RegExp encoding
// (`lib/codec.js` `encodeScalar`) stores only `{source, flags}`, never
// `lastIndex`, so no fixture can carry that assertion. The *behaviour* the
// lastIndex test guards -- that a global/sticky regex does not leak match
// state between calls -- is exercised anyway by the repeated-validate
// scenarios below (SV-VAL-004, SV-VAL-005, SV-VAL-007): a poisoned
// `lastIndex` would make the second/third call disagree with the first.
/**
 * The #validate and "custom RegEx engine" scenarios.
 * @returns {object[]} scenario entries
 */
function validateScenarios() {
    const scenarios = [];
    const withField = (name, regexClause, lengthClause) => `
namespace ${NS}.${name}@1.0.0
concept Box identified by id {
  o String id
  o String s ${regexClause} ${lengthClause} optional
}
`;
    const push = (id, cto, ns, calls) => {
        scenarios.push({
            id,
            run: ({ ModelManager }) => {
                const mm = build(ModelManager, cto, `${id}.cto`);
                const v = fieldS(mm, ns).getValidator();
                v.getRegex();
                // Each call stands on its own -- the W tests this replaces
                // wrap every assertion in its own `(() => {...}).should
                // .throw()`, so a mismatch on an earlier value must not
                // stop a later, independent call (e.g. a valid value
                // followed by two out-of-range ones) from running and being
                // recorded too.
                for (const value of calls) {
                    try {
                        v.validate('id', value);
                    } catch (e) {
                        // recorded by the oracle as this call's error outcome
                    }
                }
            },
        });
    };

    push(
        'SV-VAL-001',
        withField('v1', 'regex=/^[A-z][A-z][0-9]{7}/', ''),
        nsFor('v1'),
        [null]
    ); // ignore a null string

    push(
        'SV-VAL-002',
        withField('v2', 'regex=/^[A-z][A-z][0-9]{7}/', ''),
        nsFor('v2'),
        ['AB1234567']
    ); // validate a matching string

    push(
        'SV-VAL-003',
        withField('v3', 'regex=/^[A-z][A-z][0-9]{7}/', ''),
        nsFor('v3'),
        ['xyz']
    ); // detect a mismatched string

    push(
        'SV-VAL-004',
        withField('v4', 'regex=/^[A-z][A-z][0-9]{7}/g', ''),
        nsFor('v4'),
        ['AB1234567', 'AB1234567', 'AB1234567']
    ); // repeatedly validate a matching string, global regex

    push(
        'SV-VAL-005',
        withField('v5', 'regex=/^[A-z][A-z][0-9]{7}/g', ''),
        nsFor('v5'),
        ['xyz', 'xyz']
    ); // repeatedly reject a mismatched string, global regex

    push(
        'SV-VAL-006',
        withField('v6', 'regex=/^[A-z][A-z][0-9]{7}/y', ''),
        nsFor('v6'),
        ['AB1234567', 'AB1234567']
    ); // repeatedly validate a matching string, sticky regex

    push(
        'SV-VAL-007',
        withField('v7', 'regex=/^[\\\\]*\\n$/', ''),
        nsFor('v7'),
        ['\\\\\n']
    ); // validate a string with escaped characters

    push(
        'SV-VAL-008',
        withField('v8', 'regex=/^[\\\\]*\\n$/', ''),
        nsFor('v8'),
        ['\\hi!\n']
    ); // reject a string that fails to match escaped characters

    push(
        'SV-VAL-009',
        withField(
            'v9',
            'regex=/^(\\p{Lu}|\\p{Ll}|\\p{Lt}|\\p{Lm}|\\p{Lo}|\\p{Nl}|\\$|_)(?:\\p{Lu}|\\p{Ll}|\\p{Lt}|\\p{Lm}|\\p{Lo}|\\p{Nl}|\\$|_|\\p{Mn}|\\p{Mc}|\\p{Nd}|\\p{Pc})*$/u',
            ''
        ),
        nsFor('v9'),
        ['AB1234567']
    ); // validate a unicode string

    push(
        'SV-VAL-010',
        withField(
            'v10',
            'regex=/^(\\p{Lu}|\\p{Ll}|\\p{Lt}|\\p{Lm}|\\p{Lo}|\\p{Nl}|\\$|_)(?:\\p{Lu}|\\p{Ll}|\\p{Lt}|\\p{Lm}|\\p{Lo}|\\p{Nl}|\\$|_|\\p{Mn}|\\p{Mc}|\\p{Nd}|\\p{Pc})*$/u',
            ''
        ),
        nsFor('v10'),
        ['1FOO']
    ); // reject a string that fails a unicode pattern

    push('SV-VAL-011', withField('v11', '', 'length=[1,100]'), nsFor('v11'), [
        'AB1234567455455455',
    ]); // validate a string, min and max length both specified

    push('SV-VAL-012', withField('v12', '', 'length=[2,]'), nsFor('v12'), [
        'AB1234567455455455',
        'w',
        '',
    ]); // only minLength specified: one pass, two too-short failures

    push('SV-VAL-013', withField('v13', '', 'length=[,10]'), nsFor('v13'), [
        'ABCD123456',
        '',
        'ABCD1234567',
    ]); // only maxLength specified: two passes, one too-long failure

    push(
        'SV-VAL-014',
        withField('v14', '', 'length=[,10]'),
        nsFor('v14'),
        ['ABCD123456', '', 'ABCD1234567']
    ); // maxLength specified, minLength omitted -> null

    push(
        'SV-VAL-015',
        withField('v15', '', 'length=[2,]'),
        nsFor('v15'),
        ['AB1234567455455455', 'w', '']
    ); // minLength specified, maxLength omitted -> null

    push(
        'SV-VAL-016',
        withField('v16', 'regex=/^[A-z]{1,100}$/', 'length=[1,10]'),
        nsFor('v16'),
        ['AbCdefghijklmksadada']
    ); // string length takes precedence over the regex

    push('SV-VAL-017', withField('v17', '', 'length=[10,10]'), nsFor('v17'), [
        'ABCDEFGHIJ',
    ]); // min and max length the same

    return scenarios;
}

// ---- #validate with custom RegEx engine ---------------------------------
// Both are listed `not-liftable` in MAP.tsv: `options.regExp` (an
// alternative RegExp-compatible constructor, e.g. XRegExp) is a *function*
// passed as a ModelManager constructor option. The oracle's input codec
// (`lib/codec.js` `encodePlain`/`encode`) throws `NonPlain('function')` for
// any function-valued input, so a ModelManager built with a custom
// `regExp` option can never be recorded: the `ModelManager.new` call itself
// is skipped, and everything built from that model manager is tainted.
// There is no public-API route to this option's effect that stays inside
// what the oracle can encode.

// ---- #compatibleWith ------------------------------------------------------
// `compatibleWith` is itself a public method (reachable off any real
// `Field.getValidator()`), so every one of these lifts by building one
// model with two String fields -- `a` and `b` -- carrying the two
// validator configurations the W test gave its two stub-backed
// `StringValidator`s, then calling `fieldA.getValidator().compatibleWith(
// fieldB.getValidator())`, the same call the W test made directly.
/**
 * The #compatibleWith scenarios.
 * @returns {object[]} scenario entries
 */
function compatScenarios() {
    const scenarios = [];
    const twoFields = (name, aClause, bClause) => `
namespace ${NS}.${name}@1.0.0
concept Box identified by id {
  o String id
  o String a ${aClause} optional
  o String b ${bClause} optional
}
`;
    const push = (id, cto, ns) => {
        scenarios.push({
            id,
            run: ({ ModelManager }) => {
                const mm = build(ModelManager, cto, `${id}.cto`);
                const decl = mm.getType(`${ns}.Box`);
                const a = decl.getProperty('a').getValidator();
                const b = decl.getProperty('b').getValidator();
                a.compatibleWith(b);
            },
        });
    };

    // false for a number validator: field `b` is an Integer with a range
    // validator instead of a second String field.
    scenarios.push({
        id: 'SV-CW-001',
        run: ({ ModelManager }) => {
            const cto = `
namespace ${NS}.cw1@1.0.0
concept Box identified by id {
  o String id
  o String a regex=/foo/ length=[1,100]
  o Integer b range=[-1,1]
}
`;
            const mm = build(ModelManager, cto, 'cw1.cto');
            const decl = mm.getType(`${nsFor('cw1')}.Box`);
            const a = decl.getProperty('a').getValidator();
            const b = decl.getProperty('b').getValidator();
            a.compatibleWith(b);
        },
    });

    push('SV-CW-002', twoFields('cw2', 'regex=/foo/', 'regex=/foo/'), nsFor('cw2')); // same pattern
    push('SV-CW-003', twoFields('cw3', 'regex=/foo/', 'regex=/bar/'), nsFor('cw3')); // different pattern
    push(
        'SV-CW-004',
        twoFields('cw4', 'regex=/foo/i', 'regex=/foo/i'),
        nsFor('cw4')
    ); // same pattern and flags
    push(
        'SV-CW-005',
        twoFields('cw5', 'regex=/foo/i', 'regex=/foo/g'),
        nsFor('cw5')
    ); // different flags
    push(
        'SV-CW-006',
        twoFields('cw6', 'length=[1,100]', 'length=[1,100]'),
        nsFor('cw6')
    ); // same string lengths
    push(
        'SV-CW-007',
        twoFields('cw7', 'length=[1,100]', 'length=[2,]'),
        nsFor('cw7')
    ); // different string lengths
    push('SV-CW-008', twoFields('cw8', 'length=[,10]', 'length=[,10]'), nsFor('cw8')); // same min lengths (both null)
    push('SV-CW-009', twoFields('cw9', 'length=[2,]', 'length=[2,]'), nsFor('cw9')); // same max lengths (both null)
    push(
        'SV-CW-010',
        twoFields('cw10', 'length=[1,100]', 'length=[10,100]'),
        nsFor('cw10')
    ); // this min length smaller than other's
    push(
        'SV-CW-011',
        twoFields('cw11', 'length=[1,100]', 'length=[1,10]'),
        nsFor('cw11')
    ); // this max length greater than other's
    push(
        'SV-CW-012',
        twoFields('cw12', 'length=[1,]', 'length=[1,10]'),
        nsFor('cw12')
    ); // this max length null, other's has a value
    push(
        'SV-CW-013',
        twoFields('cw13', 'regex=/foo/ length=[1,100]', 'regex=/foo/ length=[1,100]'),
        nsFor('cw13')
    ); // same pattern and lengths
    push(
        'SV-CW-014',
        twoFields('cw14', 'regex=/foo/ length=[1,100]', 'regex=/bar/ length=[1,100]'),
        nsFor('cw14')
    ); // pattern changed, lengths the same
    push(
        'SV-CW-015',
        twoFields('cw15', 'regex=/foo/ length=[1,100]', 'regex=/foo/ length=[2,]'),
        nsFor('cw15')
    ); // pattern the same, lengths differ
    push(
        'SV-CW-016',
        twoFields('cw16', 'regex=/foo/ length=[1,100]', 'regex=/bar/ length=[2,]'),
        nsFor('cw16')
    ); // pattern and lengths both differ

    return scenarios;
}

module.exports = [...constructorScenarios, ...validateScenarios(), ...compatScenarios()];
