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

const ModelElement = require('./modelelement');
const { MetaModelNamespace } = require('@accordproject/concerto-metamodel');

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
/* istanbul ignore next */
if (global === undefined) {
    const ModelElement = require('./modelelement');
}
/* eslint-enable no-unused-vars */

/**
 * Decorator encapsulates a decorator (annotation) on a declaration or property.
 * @class
 * @memberof module:concerto-core
 */
class Decorator extends ModelElement {
    /**
     * Create a Decorator.
     * @param {ModelFile} modelFile - the model file for this decorator
     * @param {ModelElement} [parent] - the owner of this property
     * @param {Object} ast - The AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(modelFile, parent, ast) {
        super(modelFile, ast);
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
     * @return {ModelElement} the parent model element
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
     * Returns the arguments for this decorator
     * @return {object[]} the arguments for this decorator
     */
    getArguments() {
        return this.arguments;
    }
}

module.exports = Decorator;
