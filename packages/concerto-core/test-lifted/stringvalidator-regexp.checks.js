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
 * P5-02b lifted checks: `StringValidator` in a model manager built with a
 * caller-supplied custom `regExp` engine (`new ModelManager({ regExp })`).
 *
 * P5-52 (BC-28, R1; accordproject/concerto-rust#373): the option is
 * ignored, with one warning per process (`concerto-regexp-option`), and the
 * TS constructor, `validate` and `compatibleWith` bodies that ran for it
 * are deleted. Every `regex=` is compiled and evaluated by the engine, and
 * `getRegex()` is a native RegExp built from the pattern and flags the
 * engine validated. These checks now confirm that such a manager behaves
 * as a plain one. `expect` is the workspace outcome; `reference`, where it
 * differs, is v5.0.0's, which ran the custom engine (SVR-CTOR-001, -006,
 * -009) or the TS visitor (SVR-VAL-008, whose message names the field
 * `undefined` where the engine names it `null`: message text only, error
 * parity is by class). The recorded corpus cannot reach them (a
 * function-valued option cannot be encoded; see README.md, "The 3
 * not-liftable tests"). Run by fallbacks.spec.js.
 */

const NS = 'org.acme.lifted.p502b.stringvalidator';

/** A custom RegExp engine: plain ECMAScript semantics, but a distinct constructor. */
class CustomRegExp extends RegExp {}

/**
 * A custom RegExp engine that rejects any pattern containing `BAD`, the
 * way a stricter engine (XRegExp, RE2) rejects syntax RegExp accepts.
 * @param {string} pattern the pattern
 * @param {string} flags the flags
 * @returns {RegExp} the regex
 */
function PickyRegExp(pattern, flags) {
    if (pattern.includes('BAD')) {
        throw new Error(`PickyRegExp rejects ${pattern}`);
    }
    return new RegExp(pattern, flags);
}

/**
 * A ModelManager with a custom regExp engine, loaded from CTO.
 * @param {object} core the core under test
 * @param {string} name a distinct namespace suffix
 * @param {string} body the declarations
 * @param {Function} [regExp] the engine (CustomRegExp by default)
 * @returns {object} the model manager
 */
function build(core, name, body, regExp = CustomRegExp) {
    const mm = new core.ModelManager({ regExp });
    mm.addCTOModel(`namespace ${NS}.${name}@1.0.0\n${body}`, `${name}.cto`);
    return mm;
}

/**
 * The validator of `Box.<prop>` in a model built by `build`.
 * @param {object} mm the model manager
 * @param {string} name the namespace suffix
 * @param {string} prop the property
 * @returns {object} the StringValidator
 */
function validatorOf(mm, name, prop) {
    return mm.getType(`${NS}.${name}@1.0.0.Box`).getProperty(prop).getValidator();
}

/**
 * Builds `Box.s` (length=[1,10]) from a mutated AST, so its
 * `lengthValidator` can carry bounds CTO cannot express (explicit nulls,
 * negatives), into a manager with a custom regExp engine.
 * @param {object} core the core under test
 * @param {string} name a distinct namespace suffix
 * @param {object} bounds the `{minLength, maxLength}` to put in the AST
 * @returns {object} the model manager
 */
function buildWithBounds(core, name, bounds) {
    const plain = new core.ModelManager();
    plain.addCTOModel(`namespace ${NS}.${name}@1.0.0\nconcept Box { o String s length=[1,10] optional }`, `${name}.cto`);
    const model = JSON.parse(JSON.stringify(plain.getAst(false).models.find((m) => m.namespace === `${NS}.${name}@1.0.0`)));
    const s = model.declarations.find((d) => d.name === 'Box').properties.find((p) => p.name === 's');
    s.lengthValidator = Object.assign({ $class: 'concerto.metamodel@1.0.0.StringLengthValidator' }, bounds);
    const mm = new core.ModelManager({ regExp: CustomRegExp });
    mm.fromAst({ $class: 'concerto.metamodel@1.0.0.Models', models: [model] });
    return mm;
}

/**
 * Runs `validate(id, value)` and reports a pass as the string 'valid'.
 * @param {object} v the validator
 * @param {string} value the value
 * @returns {string} 'valid' (a failure throws)
 */
function check(v, value) {
    v.validate('id1', value);
    return 'valid';
}

const BOX = 'concept Box { o String s regex=/^a+$/ length=[2,4] optional o String t optional o String u regex=/^a+$/i optional o String w length=[,4] optional o String x length=[2,] optional }';

module.exports = [
    // ---- constructor --------------------------------------------------
    {
        id: 'SVR-CTOR-001',
        covers: 'constructor: regex and length bounds with a custom engine',
        run: (core) => {
            const v = validatorOf(build(core, 'c1', BOX), 'c1', 's');
            return { min: v.getMinLength(), max: v.getMaxLength(), regex: String(v.getRegex()), custom: v.getRegex() instanceof CustomRegExp };
        },
        expect: { ok: { min: 2, max: 4, regex: '/^a+$/', custom: false } },
        reference: { ok: { min: 2, max: 4, regex: '/^a+$/', custom: true } },
    },
    {
        id: 'SVR-CTOR-002',
        covers: 'constructor: both length bounds explicitly null',
        run: (core) => buildWithBounds(core, 'c2', { minLength: null, maxLength: null }) && 'loaded',
        // P5-53 (BC-39, R1): a validator error while the model loads is an IllegalModelException,
        // keeping its errorType; v5.0.0 threw a BaseException.
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'Validator error for field `s`. org.acme.lifted.p502b.stringvalidator.c2@1.0.0.Box.s: Invalid string length, minLength and-or maxLength must be specified. '
            }
        },
        reference: {
            throws: {
                name: 'BaseException',
                message: 'Validator error for field `s`. org.acme.lifted.p502b.stringvalidator.c2@1.0.0.Box.s: Invalid string length, minLength and-or maxLength must be specified.'
            }
        },
    },
    {
        id: 'SVR-CTOR-003',
        covers: 'constructor: a negative length bound',
        run: (core) => buildWithBounds(core, 'c3', { minLength: -1, maxLength: 4 }) && 'loaded',
        // P5-53 (BC-39, R1): a validator error while the model loads is an IllegalModelException,
        // keeping its errorType; v5.0.0 threw a BaseException.
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'Validator error for field `s`. org.acme.lifted.p502b.stringvalidator.c3@1.0.0.Box.s: minLength and-or maxLength must be positive integers. '
            }
        },
        reference: {
            throws: {
                name: 'BaseException',
                message: 'Validator error for field `s`. org.acme.lifted.p502b.stringvalidator.c3@1.0.0.Box.s: minLength and-or maxLength must be positive integers.'
            }
        },
    },
    {
        id: 'SVR-CTOR-004',
        covers: 'constructor: one bound explicitly null (no min/max comparison)',
        run: (core) => {
            const mm = buildWithBounds(core, 'c4', { minLength: null, maxLength: 4 });
            const v = mm.getType(`${NS}.c4@1.0.0.Box`).getProperty('s').getValidator();
            return { min: v.getMinLength(), max: v.getMaxLength() };
        },
        expect: { ok: { min: null, max: 4 } },
    },
    {
        id: 'SVR-CTOR-005',
        covers: 'constructor: minLength greater than maxLength',
        run: (core) => buildWithBounds(core, 'c5', { minLength: 5, maxLength: 4 }) && 'loaded',
        // P5-53 (BC-39, R1): a validator error while the model loads is an IllegalModelException,
        // keeping its errorType; v5.0.0 threw a BaseException.
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'Validator error for field `s`. org.acme.lifted.p502b.stringvalidator.c5@1.0.0.Box.s: minLength must be less than or equal to maxLength. '
            }
        },
        reference: {
            throws: {
                name: 'BaseException',
                message: 'Validator error for field `s`. org.acme.lifted.p502b.stringvalidator.c5@1.0.0.Box.s: minLength must be less than or equal to maxLength.'
            }
        },
    },
    {
        id: 'SVR-CTOR-006',
        covers: 'constructor: the custom engine would reject the pattern (BC-28: the engine accepts it)',
        run: (core) => build(core, 'c6', 'concept Box { o String s regex=/BAD/ optional }', PickyRegExp) && 'loaded',
        expect: { ok: 'loaded' },
        reference: {
            throws: {
                name: 'BaseException',
                message: 'Validator error for field `s`. org.acme.lifted.p502b.stringvalidator.c6@1.0.0.Box.s: PickyRegExp rejects BAD'
            }
        },
    },
    {
        id: 'SVR-CTOR-007',
        covers: 'constructor: a default value that fails the regex',
        run: (core) => build(core, 'c7', 'concept Box { o String s default="bbb" regex=/^a+$/ }') && 'loaded',
        // P5-53 (BC-39, R1): a validator error while the model loads is an IllegalModelException,
        // keeping its errorType; v5.0.0 threw a BaseException.
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'Validator error for field `s`. org.acme.lifted.p502b.stringvalidator.c7@1.0.0.Box.s: Value \'bbb\' failed to match validation regex: /^a+$/ '
            }
        },
        reference: {
            throws: {
                name: 'BaseException',
                message: 'Validator error for field `s`. org.acme.lifted.p502b.stringvalidator.c7@1.0.0.Box.s: Value \'bbb\' failed to match validation regex: /^a+$/'
            }
        },
    },
    {
        id: 'SVR-CTOR-008',
        covers: 'constructor: a default value that passes',
        run: (core) => validatorOf(build(core, 'c8', 'concept Box { o String s default="aa" regex=/^a+$/ length=[1,3] }'), 'c8', 's').getMaxLength(),
        expect: { ok: 3 },
    },
    {
        id: 'SVR-CTOR-009',
        covers: 'constructor: two managers with different engines load one shared AST object; neither engine runs (BC-28: v5.0.0 gave each Field a validator its own engine built, at load)',
        run: (core) => {
            const ns = `${NS}.c9@1.0.0`;
            const source = new core.ModelManager();
            source.addCTOModel(`namespace ${ns}\nconcept Box { o String s regex=/^a+$/ optional o String t regex=/^b+$/i length=[1,3] optional }`, 'c9.cto');
            const ast = source.getModelFile(ns).getAst();
            const calls = [];
            const engine = (tag) => class extends RegExp {
                /**
                 * Records the call, then builds a tagged RegExp.
                 * @param {string} pattern the pattern
                 * @param {string} flags the flags
                 */
                constructor(pattern, flags) {
                    calls.push(tag);
                    super(pattern, flags);
                    this.tag = tag;
                }
            };
            const managers = { A: new core.ModelManager({ regExp: engine('A') }), B: new core.ModelManager({ regExp: engine('B') }) };
            for (const mm of Object.values(managers)) {
                mm.addModelFile(new core.ModelFile(mm, ast, undefined, 'c9.cto'), undefined, 'c9.cto');
            }
            const atLoad = calls.slice();
            // Read B first, so a validator shared through the AST node would show on A.
            const read = {};
            for (const tag of ['B', 'A']) {
                const box = managers[tag].getType(`${ns}.Box`);
                read[tag] = ['s', 't'].map((p) => box.getProperty(p).getValidator().getRegex().tag);
            }
            // How often each engine runs is not part of the contract; that
            // each ran at load, for both fields, and not again on read, is.
            return {
                ranAtLoad: { A: atLoad.filter((t) => t === 'A').length >= 2, B: atLoad.filter((t) => t === 'B').length >= 2 },
                read,
                ranOnRead: calls.length > atLoad.length,
            };
        },
        expect: { ok: { ranAtLoad: { A: false, B: false }, read: { B: ['<undefined>', '<undefined>'], A: ['<undefined>', '<undefined>'] }, ranOnRead: false } },
        reference: { ok: { ranAtLoad: { A: true, B: true }, read: { B: ['B', 'B'], A: ['A', 'A'] }, ranOnRead: false } },
    },
    // P5-53 (BC-40, R1): a length validator with neither bound, both absent
    // (`length=[,]`), is rejected as two null bounds are; v5.0.0 loaded it.
    {
        id: 'SVR-CTOR-010',
        covers: 'constructor: both length bounds absent (BC-40)',
        run: (core) => buildWithBounds(core, 'c10', {}) && 'loaded',
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'Validator error for field `s`. org.acme.lifted.p502b.stringvalidator.c10@1.0.0.Box.s: Invalid string length, minLength and-or maxLength must be specified. '
            }
        },
        reference: { ok: 'loaded' },
    },
    // P5-53 (BC-39, R1): each validator error keeps its errorType on its new
    // class; v5.0.0's BaseException carried the same errorType. Under BC-28
    // the engine compiles the pattern, so the rejected regex is one every
    // ECMAScript engine rejects (quantifier bounds out of order), not one
    // only PickyRegExp would.
    {
        id: 'SVR-ERR-001',
        covers: 'the class and errorType of a load-time and an instance validator error',
        run: (core) => {
            const caught = (fn) => {
                try {
                    fn();
                    return 'no error';
                } catch (e) {
                    return { name: e.constructor.name, errorType: e.errorType };
                }
            };
            return {
                regex: caught(() => build(core, 'e1', 'concept Box { o String s regex=/a{2,1}/ optional }')),
                length: caught(() => buildWithBounds(core, 'e2', { minLength: 5, maxLength: 4 })),
                instance: caught(() => check(validatorOf(build(core, 'e3', BOX), 'e3', 's'), 'abc')),
            };
        },
        expect: {
            ok: {
                regex: { name: 'IllegalModelException', errorType: 'RegexValidatorException' },
                length: { name: 'IllegalModelException', errorType: 'DefaultValidatorException' },
                instance: { name: 'ValidationException', errorType: 'DefaultValidatorException' },
            }
        },
        reference: {
            ok: {
                regex: { name: 'BaseException', errorType: 'RegexValidatorException' },
                length: { name: 'BaseException', errorType: 'DefaultValidatorException' },
                instance: { name: 'BaseException', errorType: 'DefaultValidatorException' },
            }
        },
    },
    // ---- validate -----------------------------------------------------
    {
        id: 'SVR-VAL-001',
        covers: 'validate: a value that passes length and regex',
        run: (core) => check(validatorOf(build(core, 'v1', BOX), 'v1', 's'), 'aaa'),
        expect: { ok: 'valid' },
    },
    {
        id: 'SVR-VAL-002',
        covers: 'validate: shorter than minLength',
        run: (core) => check(validatorOf(build(core, 'v2', BOX), 'v2', 's'), 'a'),
        // P5-53 (BC-39, R1): a validator error for an instance value is a ValidationException,
        // keeping its errorType; v5.0.0 threw a BaseException.
        expect: {
            throws: {
                name: 'ValidationException',
                message: 'Validator error for field `id1`. org.acme.lifted.p502b.stringvalidator.v2@1.0.0.Box.s: The string length of \'a\' should be at least 2 characters.'
            }
        },
        reference: {
            throws: {
                name: 'BaseException',
                message: 'Validator error for field `id1`. org.acme.lifted.p502b.stringvalidator.v2@1.0.0.Box.s: The string length of \'a\' should be at least 2 characters.'
            }
        },
    },
    {
        id: 'SVR-VAL-003',
        covers: 'validate: longer than maxLength',
        run: (core) => check(validatorOf(build(core, 'v3', BOX), 'v3', 's'), 'aaaaa'),
        // P5-53 (BC-39, R1): a validator error for an instance value is a ValidationException,
        // keeping its errorType; v5.0.0 threw a BaseException.
        expect: {
            throws: {
                name: 'ValidationException',
                message: 'Validator error for field `id1`. org.acme.lifted.p502b.stringvalidator.v3@1.0.0.Box.s: The string length of \'aaaaa\' should not exceed 4 characters.'
            }
        },
        reference: {
            throws: {
                name: 'BaseException',
                message: 'Validator error for field `id1`. org.acme.lifted.p502b.stringvalidator.v3@1.0.0.Box.s: The string length of \'aaaaa\' should not exceed 4 characters.'
            }
        },
    },
    {
        id: 'SVR-VAL-004',
        covers: 'validate: the regex does not match',
        run: (core) => check(validatorOf(build(core, 'v4', BOX), 'v4', 's'), 'abc'),
        // P5-53 (BC-39, R1): a validator error for an instance value is a ValidationException,
        // keeping its errorType; v5.0.0 threw a BaseException.
        expect: {
            throws: {
                name: 'ValidationException',
                message: 'Validator error for field `id1`. org.acme.lifted.p502b.stringvalidator.v4@1.0.0.Box.s: Value \'abc\' failed to match validation regex: /^a+$/'
            }
        },
        reference: {
            throws: {
                name: 'BaseException',
                message: 'Validator error for field `id1`. org.acme.lifted.p502b.stringvalidator.v4@1.0.0.Box.s: Value \'abc\' failed to match validation regex: /^a+$/'
            }
        },
    },
    {
        id: 'SVR-VAL-005',
        covers: 'validate: a null value',
        run: (core) => check(validatorOf(build(core, 'v5', BOX), 'v5', 's'), null),
        expect: { ok: 'valid' },
    },
    {
        id: 'SVR-VAL-006',
        covers: 'validate: a length-only validator (no regex), under and over',
        run: (core) => {
            const mm = build(core, 'v6', BOX);
            const res = [];
            for (const [prop, value] of [['w', 'aaaaa'], ['x', 'a'], ['w', 'bb'], ['x', 'bbbbbbb']]) {
                try {
                    res.push(check(validatorOf(mm, 'v6', prop), value));
                } catch (e) {
                    res.push(e.message);
                }
            }
            return res;
        },
        expect: {
            ok: [
                'Validator error for field `id1`. org.acme.lifted.p502b.stringvalidator.v6@1.0.0.Box.w: The string length of \'aaaaa\' should not exceed 4 characters.',
                'Validator error for field `id1`. org.acme.lifted.p502b.stringvalidator.v6@1.0.0.Box.x: The string length of \'a\' should be at least 2 characters.',
                'valid',
                'valid'
            ]
        },
    },
    {
        id: 'SVR-VAL-007',
        covers: 'validate: through Serializer.fromJSON (the instance path)',
        run: (core) => {
            const mm = build(core, 'v7', BOX);
            const ser = new core.Serializer(new core.Factory(mm), mm);
            return ser.toJSON(ser.fromJSON({ $class: `${NS}.v7@1.0.0.Box`, s: 'aa', u: 'AAA' }));
        },
        expect: {
            ok: { '$class': 'org.acme.lifted.p502b.stringvalidator.v7@1.0.0.Box', s: 'aa', u: 'AAA' }
        },
    },
    {
        id: 'SVR-VAL-008',
        covers: 'validate: through Serializer.fromJSON, failing',
        run: (core) => {
            const mm = build(core, 'v8', BOX);
            const ser = new core.Serializer(new core.Factory(mm), mm);
            return ser.fromJSON({ $class: `${NS}.v8@1.0.0.Box`, s: 'bb' });
        },
        // P5-53 (BC-39, R1): a validator error for an instance value is a ValidationException,
        // keeping its errorType; v5.0.0 threw a BaseException.
        expect: {
            throws: {
                name: 'ValidationException',
                message: 'Validator error for field `null`. org.acme.lifted.p502b.stringvalidator.v8@1.0.0.Box.s: Value \'bb\' failed to match validation regex: /^a+$/'
            }
        },
        reference: {
            throws: {
                name: 'BaseException',
                message: 'Validator error for field `undefined`. org.acme.lifted.p502b.stringvalidator.v8@1.0.0.Box.s: Value \'bb\' failed to match validation regex: /^a+$/'
            }
        },
    },
    // ---- compatibleWith -----------------------------------------------
    {
        id: 'SVR-CW-001',
        covers: 'compatibleWith: every TS rule, with a custom engine on this side',
        run: (core) => {
            const mm = build(core, 'w1', `
concept Box {
  o String a regex=/^a+$/ length=[2,4] optional
  o String a2 regex=/^a+$/ length=[2,4] optional
  o String b regex=/^b+$/ length=[2,4] optional
  o String c regex=/^a+$/i length=[2,4] optional
  o String d regex=/^a+$/ length=[1,4] optional
  o String e regex=/^a+$/ length=[3,4] optional
  o String f regex=/^a+$/ length=[,4] optional
  o String g regex=/^a+$/ length=[2,5] optional
  o String h regex=/^a+$/ length=[2,3] optional
  o String i regex=/^a+$/ length=[2,] optional
  o Integer n range=[1,2] optional
}`);
            const v = (p) => mm.getType(`${NS}.w1@1.0.0.Box`).getProperty(p).getValidator();
            const a = v('a');
            return {
                same: a.compatibleWith(v('a2')),
                pattern: a.compatibleWith(v('b')),
                flags: a.compatibleWith(v('c')),
                minLooser: a.compatibleWith(v('d')),
                minTighter: a.compatibleWith(v('e')),
                thisNoMin: v('f').compatibleWith(a),
                otherNoMin: a.compatibleWith(v('f')),
                maxLooser: a.compatibleWith(v('g')),
                maxTighter: a.compatibleWith(v('h')),
                thisNoMax: v('i').compatibleWith(a),
                otherNoMax: a.compatibleWith(v('i')),
                notString: a.compatibleWith(v('n')),
                nullOther: a.compatibleWith(null),
            };
        },
        expect: {
            ok: {
                same: true,
                pattern: false,
                flags: false,
                minLooser: true,
                minTighter: false,
                thisNoMin: false,
                otherNoMin: true,
                maxLooser: true,
                maxTighter: false,
                thisNoMax: false,
                otherNoMax: true,
                notString: false,
                nullOther: false
            }
        },
    },
    {
        id: 'SVR-CW-002',
        covers: 'compatibleWith: the custom engine only on the other side',
        run: (core) => {
            const plain = new core.ModelManager();
            plain.addCTOModel(`namespace ${NS}.w2@1.0.0\nconcept Box { o String s regex=/^a+$/ length=[2,4] optional }`, 'w2.cto');
            const mine = plain.getType(`${NS}.w2@1.0.0.Box`).getProperty('s').getValidator();
            const theirs = validatorOf(build(core, 'w2b', 'concept Box { o String s regex=/^a+$/ length=[2,4] optional }'), 'w2b', 's');
            return [mine.compatibleWith(theirs), theirs.compatibleWith(mine)];
        },
        expect: { ok: [ true, true ] },
    },
];
