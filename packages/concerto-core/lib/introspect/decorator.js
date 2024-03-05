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

const { MetaModelNamespace } = require('@accordproject/concerto-metamodel');
const IllegalModelException = require('./illegalmodelexception');

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
/* istanbul ignore next */
if (global === undefined) {
    const ClassDeclaration = require('./classdeclaration');
    const Property = require('./property');
}
/* eslint-enable no-unused-vars */

/**
 * Decorator encapsulates a decorator (annotation) on a class or property.
 * @class
 * @memberof module:concerto-core
 */
class Decorator {
    /**
     * Create a Decorator.
     * @param {ClassDeclaration | Property} parent - the owner of this property
     * @param {Object} ast - The AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(parent, ast) {
        this.ast = ast;
        this.parent = parent;
        this.arguments = null;
        this.process();
    }

    /**
     * Visitor design pattern
     * @param {Object} visitor - the visitor
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    accept(visitor, parameters) {
        return visitor.visit(this, parameters);
    }

    /**
     * Returns the owner of this property
     * @return {ClassDeclaration|Property} the parent class or property declaration
     */
    getParent() {
        return this.parent;
    }

    /**
     * Process the AST and build the model
     * @throws {IllegalModelException}
     * @private
     */
    process() {
        this.name = this.ast.name;
        this.arguments = [];

        if (this.ast.arguments) {
            for (let n = 0; n < this.ast.arguments.length; n++) {
                let thing = this.ast.arguments[n];
                if (thing) {
                    if (thing.$class === `${MetaModelNamespace}.DecoratorTypeReference`) {
                        // XXX Is this really what we want?
                        if (!MetaModelNamespace[thing.type.name]) {
                            const errorMessage = `Type '${thing.type.name}' not found within the namespace '${MetaModelNamespace}'.`;
                            throw new IllegalModelException(errorMessage);
                        }
                        this.arguments.push({
                            type: 'Identifier',
                            name: thing.type.name,
                            array: thing.isArray
                        });
                    } else {
                        this.arguments.push(thing.value);
                    }
                }
            }
        }
    }

    /**
     * Validate the property
     * @throws {IllegalModelException}
     * @private
     */
    validate() { }

    /**
     * Returns the name of a decorator
     * @return {string} the name of this decorator
     */
    getName() {
        return this.name;
    }

    /**
     * Returns the arguments for this decorator
     * @return {object[]} the arguments for this decorator
     */
    getArguments() {
        return this.arguments;
    }

    /**
     * Returns true if this class is the definition of a decorator.
     *
     * @return {boolean} true if the class is a decorator
     */
    isDecorator() {
        return true;
    }
}

module.exports = Decorator;
