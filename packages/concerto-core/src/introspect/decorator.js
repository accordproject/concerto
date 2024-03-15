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
const IllegalModelException = require('./illegalmodelexception');

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
        // let thingType = null;

        if (this.ast.arguments) {
            for (let n = 0; n < this.ast.arguments.length; n++) {
                let thing = this.ast.arguments[n];
                if (thing) {
                    if (
                        thing.$class ===
                        `${MetaModelNamespace}.DecoratorTypeReference`
                    ) {
                        // XXX Is this really what we want?
                        this.arguments.push({
                            type: this._resolveArguemntType(thing),
                            name: thing.type.name,
                            array: thing.isArray,
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
    validate() {}

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

    /**
     * Resolves the type of the decorator argument
     * @param {Object} argument - the decorator argument // Idt we have argument as any defined type
     * @return {ClassDeclaration} the type of the decorator argument // similar to [this](https://github.com/accordproject/concerto/blob/0d7f108d4961f87782436dd689639ce0f35e97f8/packages/concerto-core/lib/introspect/classdeclaration.js#L155) method
     */
    _resolveArguemntType(argument) {

        let classDecl = null;

        const modelFile = this.parent.getModelFile();

        if (modelFile.isImportedType(argument.type.name)) {
            let fullyQualifiedTypeName = modelFile.resolveImport(argument.type.name);
            classDecl = modelFile.getModelManager().getType(fullyQualifiedTypeName);
        } else {
            classDecl = modelFile.getType(argument.type.name);
        }

        if (!classDecl) {
            // THROW AN EXCEPTION TYPE NOT FOUND NEITHER IN THE NAMESPACE NOR IN THE IMPORTS
            throw new IllegalModelException('Could not find type ' + this.type.name, modelFile, this.ast.location);
        }

        return classDecl;

    }
}

module.exports = Decorator;
