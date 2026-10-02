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
 * P5-54 lifted checks (accordproject/concerto-rust#375): the ModelManager's
 * `decoratorValidation` option, on and off, on every path that validates a
 * whole manager, checked through the public API against the frozen v5.0.0
 * reference. Run by fallbacks.spec.js.
 *
 * - `fromAst` (and `clearModelFiles` before an add): `clearModelFiles`
 *   replaces the manager's engine handle, which then validated with the
 *   default options, ignoring `decoratorValidation` (and
 *   `dangerouslyAllowReservedSystemTypeNamesInUserModels`).
 * - `validateModelFiles` after `fromAst(ast, {disableValidation: true})`.
 * - `DecoratorManager.decorateModels`: TS validates the result in
 *   `new ModelManager({decoratorValidation}).fromAst(…)`; the engine's
 *   resident DCS manager validated it with the default options.
 *
 * Each probe reports the thrown class's name (or `ok`), so that only the
 * class, not the message wording, is compared (error parity, P5-09).
 */

const ERROR = { missingDecorator: 'error', invalidDecorator: 'error' };
const WARNING = { missingDecorator: 'warning', invalidDecorator: 'warning' };

const UNDECLARED = 'namespace test.dv@1.0.0\n@Undeclared\nconcept Person { o String name }\n';
const WRONG_ARGUMENT = 'namespace test.dv@1.0.0\nconcept Info { o String note }\n@Info(1)\nconcept Person { o String name }\n';
const DECLARED = 'namespace test.dv@1.0.0\nconcept Info { o String note }\n@Info("x")\nconcept Person { o String name }\n';
const RESERVED = 'namespace test.dv@1.0.0\nconcept Concept { o String name }\n';

/**
 * The outcome of `fn`: `ok` (or what it returns), or the thrown class's name.
 * @param {Function} fn the call
 * @returns {*} the outcome
 */
function probe(fn) {
    try {
        const out = fn();
        return out === undefined ? 'ok' : out;
    } catch (e) {
        return e.constructor.name;
    }
}

/**
 * The AST of `cto`, from a manager that accepts it.
 * @param {object} core a loaded core
 * @param {string} cto the model text
 * @param {object} [options] the source manager's options
 * @returns {object} the `Models` AST
 */
function astOf(core, cto, options) {
    const src = new core.ModelManager(options);
    src.addCTOModel(cto, 'dv.cto');
    return src.getAst();
}

/**
 * `new ModelManager(options).fromAst(astOf(cto), fromAstOptions)`.
 * @param {object} core a loaded core
 * @param {string} cto the model text
 * @param {object} [options] the new manager's options
 * @param {object} [fromAstOptions] the fromAst options
 * @returns {string} the outcome
 */
function fromAst(core, cto, options, fromAstOptions) {
    const ast = astOf(core, cto, cto === RESERVED ? { dangerouslyAllowReservedSystemTypeNamesInUserModels: true } : undefined);
    return probe(() => {
        new core.ModelManager(options).fromAst(ast, fromAstOptions);
    });
}

/** A command set that applies `@Undeclared` to `test.dv@1.0.0.Person`. */
const UPSERT_UNDECLARED = {
    $class: 'org.accordproject.decoratorcommands@0.4.0.DecoratorCommandSet',
    name: 'dv',
    version: '1.0.0',
    commands: [{
        $class: 'org.accordproject.decoratorcommands@0.4.0.Command',
        type: 'UPSERT',
        target: {
            $class: 'org.accordproject.decoratorcommands@0.4.0.CommandTarget',
            namespace: 'test.dv@1.0.0',
            declaration: 'Person',
        },
        decorator: { $class: 'concerto.metamodel@1.0.0.Decorator', name: 'Undeclared', arguments: [] },
    }],
};

/**
 * `DecoratorManager.decorateModels` applying `@Undeclared`, on a manager
 * built with `validation` as its `decoratorValidation`.
 * @param {object} core a loaded core
 * @param {object} [validation] the decoratorValidation option
 * @param {object} [options] the decorateModels options
 * @returns {*} the outcome: whether Person has `@Undeclared`, or the class thrown
 */
function decorate(core, validation, options) {
    const mm = new core.ModelManager(validation ? { decoratorValidation: validation } : undefined);
    mm.addCTOModel('namespace test.dv@1.0.0\nconcept Person { o String name }\n', 'dv.cto');
    return probe(() => {
        const out = core.DecoratorManager.decorateModels(mm, JSON.parse(JSON.stringify(UPSERT_UNDECLARED)), options);
        return !!out.getType('test.dv@1.0.0.Person').getDecorator('Undeclared');
    });
}

module.exports = [
    {
        id: 'DV-001',
        covers: 'basemodelmanager.ts fromAst: missingDecorator error rejects an undeclared decorator',
        run: (core) => fromAst(core, UNDECLARED, { decoratorValidation: ERROR }),
        expect: { ok: 'IllegalModelException' },
    },
    {
        id: 'DV-002',
        covers: 'basemodelmanager.ts fromAst: with decoratorValidation off, an undeclared decorator passes',
        run: (core) => fromAst(core, UNDECLARED),
        expect: { ok: 'ok' },
    },
    {
        id: 'DV-003',
        covers: 'basemodelmanager.ts fromAst: invalidDecorator error rejects a decorator argument of the wrong type',
        run: (core) => fromAst(core, WRONG_ARGUMENT, { decoratorValidation: ERROR }),
        expect: { ok: 'IllegalModelException' },
    },
    {
        id: 'DV-004',
        covers: 'basemodelmanager.ts fromAst: with decoratorValidation off, a decorator argument of the wrong type passes',
        run: (core) => fromAst(core, WRONG_ARGUMENT),
        expect: { ok: 'ok' },
    },
    {
        id: 'DV-005',
        covers: 'basemodelmanager.ts fromAst: warning levels log and do not throw',
        run: (core) => [
            fromAst(core, UNDECLARED, { decoratorValidation: WARNING }),
            fromAst(core, WRONG_ARGUMENT, { decoratorValidation: WARNING }),
        ],
        expect: { ok: [ 'ok', 'ok' ] },
    },
    {
        id: 'DV-006',
        covers: 'basemodelmanager.ts fromAst: missingDecorator error accepts a declared, well-formed decorator',
        run: (core) => fromAst(core, DECLARED, { decoratorValidation: ERROR }),
        expect: { ok: 'ok' },
    },
    {
        id: 'DV-007',
        covers: 'basemodelmanager.ts validateModelFiles: after fromAst with disableValidation, missingDecorator error rejects an undeclared decorator',
        run: (core) => {
            const ast = astOf(core, UNDECLARED);
            const mm = new core.ModelManager({ decoratorValidation: ERROR });
            return [
                probe(() => { mm.fromAst(ast, { disableValidation: true }); }),
                probe(() => { mm.validateModelFiles(); }),
            ];
        },
        expect: { ok: [ 'ok', 'IllegalModelException' ] },
    },
    {
        id: 'DV-008',
        covers: 'basemodelmanager.ts clearModelFiles: the manager keeps decoratorValidation for later adds',
        run: (core) => {
            const mm = new core.ModelManager({ decoratorValidation: ERROR });
            mm.clearModelFiles();
            return probe(() => { mm.addCTOModel(UNDECLARED, 'dv.cto'); });
        },
        expect: { ok: 'IllegalModelException' },
    },
    {
        id: 'DV-009',
        covers: 'basemodelmanager.ts fromAst: dangerouslyAllowReservedSystemTypeNamesInUserModels on and off',
        run: (core) => [
            fromAst(core, RESERVED, { dangerouslyAllowReservedSystemTypeNamesInUserModels: true }),
            fromAst(core, RESERVED, { dangerouslyAllowReservedSystemTypeNamesInUserModels: false }),
        ],
        expect: { ok: [ 'ok', 'IllegalModelException' ] },
    },
    {
        id: 'DV-010',
        covers: 'decoratormanager.ts decorateModels: missingDecorator error on the source manager rejects applying an undeclared decorator',
        run: (core) => decorate(core, ERROR),
        expect: { ok: 'IllegalModelException' },
    },
    {
        id: 'DV-011',
        covers: 'decoratormanager.ts decorateModels: with decoratorValidation off, an undeclared decorator is applied',
        run: (core) => decorate(core),
        expect: { ok: true },
    },
    {
        id: 'DV-012',
        covers: 'decoratormanager.ts decorateModels: disableMetamodelValidation skips the decorator checks',
        run: (core) => decorate(core, ERROR, { disableMetamodelValidation: true }),
        expect: { ok: true },
    },
];
