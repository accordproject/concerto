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
 * Language-neutral encodings for public-API arguments that are code in
 * JavaScript (task accordproject/concerto-rust#94): a filter predicate and a
 * DecoratorFactory, and (task P2-11b) a visitor. Each is a small tagged kind whose meaning is defined here
 * and in README.md ("Value encoding"), so any engine's harness can build the
 * same behaviour from the fixture without running JavaScript.
 *
 *   {"@@oracle":"predicate","kind":"fqn-in","names":[...]}
 *       a predicate over a declaration: true when the declaration's fully
 *       qualified name is one of `names`
 *   {"@@oracle":"decoratorfactory","kind":"base"}
 *       the exported base DecoratorFactory itself (its newDecorator throws
 *       Error('abstract function called'))
 *   {"@@oracle":"decoratorfactory","kind":"names","names":[...]}
 *       a DecoratorFactory whose newDecorator(parent, ast) returns a plain
 *       Decorator built from (parent, ast) when ast.name is one of `names`,
 *       and null otherwise
 *   {"@@oracle":"visitor","kind":"pair"}
 *       (task P2-11b) a visitor, the argument of every public accept(visitor,
 *       parameters): an object whose visit(thing, parameters) returns the
 *       two-element array [thing, parameters], so the outcome of accept
 *       shows what it dispatched to the visitor, and with which parameters
 *
 * A driver builds such a value with predicate() or decoratorFactory(); the
 * value is registered here, and the recorder's encoder looks it up, so only a
 * function or object whose behaviour is fully described by its encoding is
 * ever encoded. Any other function or factory stays unrecordable.
 */

const M = '@@oracle';

// value (function or factory instance) -> its encoding
const REGISTRY = new WeakMap();

/**
 * @param {*} names value to check
 * @returns {string[]} names, validated
 */
function checkNames(names) {
    if (!Array.isArray(names) || !names.every((n) => typeof n === 'string')) {
        throw new Error('encodable: names must be an array of strings');
    }
    return names.slice();
}

/**
 * Build the predicate an encoding describes.
 * @param {object} enc {kind, names}
 * @returns {function} predicate(declaration) -> boolean
 */
function buildPredicate(enc) {
    if (!enc || enc.kind !== 'fqn-in') {
        const err = new Error('unknown predicate kind ' + (enc && enc.kind));
        err.name = 'HarnessError';
        throw err;
    }
    const names = new Set(checkNames(enc.names));
    const fn = (declaration) => names.has(declaration.getFullyQualifiedName());
    REGISTRY.set(fn, { [M]: 'predicate', kind: 'fqn-in', names: [...names] });
    return fn;
}

/**
 * A predicate for a driver: true for the declarations named.
 * @param {object} spec {kind: 'fqn-in', names: string[]}
 * @returns {function} registered predicate
 */
function predicate(spec) {
    return buildPredicate(spec);
}

/**
 * Build the DecoratorFactory an encoding describes, in one engine core.
 * @param {object} core module set (lib/core.js)
 * @param {object} enc {kind, names?}
 * @returns {object} DecoratorFactory instance
 */
function buildDecoratorFactory(core, enc) {
    let factory;
    if (enc && enc.kind === 'base') {
        factory = new core.DecoratorFactory();
        REGISTRY.set(factory, { [M]: 'decoratorfactory', kind: 'base' });
        return factory;
    }
    if (enc && enc.kind === 'names') {
        const names = new Set(checkNames(enc.names));
        const Decorator = core.Decorator;
        /** DecoratorFactory for the decorators named in the encoding. */
        class NamesDecoratorFactory extends core.DecoratorFactory {
            /**
             * @param {object} parent the decorated element
             * @param {object} ast the decorator's AST
             * @returns {object|null} a Decorator, or null
             */
            newDecorator(parent, ast) {
                return ast && names.has(ast.name) ? new Decorator(parent, ast) : null;
            }
        }
        factory = new NamesDecoratorFactory();
        REGISTRY.set(factory, { [M]: 'decoratorfactory', kind: 'names', names: [...names] });
        return factory;
    }
    const err = new Error('unknown decorator factory kind ' + (enc && enc.kind));
    err.name = 'HarnessError';
    throw err;
}

/**
 * A DecoratorFactory for a driver.
 * @param {object} core module set (lib/core.js)
 * @param {object} spec {kind: 'base'} or {kind: 'names', names: string[]}
 * @returns {object} registered factory
 */
function decoratorFactory(core, spec) {
    return buildDecoratorFactory(core, spec);
}

/**
 * Build the visitor an encoding describes (task P2-11b).
 * @param {object} enc {kind}
 * @returns {object} visitor with a visit(thing, parameters) method
 */
function buildVisitor(enc) {
    if (!enc || enc.kind !== 'pair') {
        const err = new Error('unknown visitor kind ' + (enc && enc.kind));
        err.name = 'HarnessError';
        throw err;
    }
    const visitor = {
        /**
         * @param {object} thing the object accept() was called on
         * @param {*} parameters the parameters accept() was given
         * @returns {Array} [thing, parameters]
         */
        visit(thing, parameters) {
            return [thing, parameters];
        },
    };
    REGISTRY.set(visitor, { [M]: 'visitor', kind: 'pair' });
    return visitor;
}

/**
 * A visitor for a driver.
 * @param {object} spec {kind: 'pair'}
 * @returns {object} registered visitor
 */
function visitor(spec) {
    return buildVisitor(spec);
}

/**
 * The encoding of a registered value.
 * @param {*} v value
 * @returns {object|null} a copy of its encoding, or null when not registered
 */
function encodingOf(v) {
    if (!v || (typeof v !== 'object' && typeof v !== 'function')) {
        return null;
    }
    const enc = REGISTRY.get(v);
    return enc ? JSON.parse(JSON.stringify(enc)) : null;
}

module.exports = { predicate, decoratorFactory, visitor, buildPredicate, buildDecoratorFactory, buildVisitor, encodingOf };
