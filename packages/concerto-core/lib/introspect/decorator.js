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
const { Logger } = require('@accordproject/concerto-util');
const ModelUtil = require('../modelutil');
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
    * Handles a validation error, logging and throwing as required
    * @param {string} level the log level
    * @param {*} err the error to log
    * @param {*} [fileLocation] the file location
    * @private
    */
    handleError(level, err) {
        Logger.dispatch(level, err);
        if (level === 'error') {
            throw new IllegalModelException(err, this.getParent().getModelFile(), this.ast.location);
        }
    }

    /**
     * Visitor design pattern
     * @param {Object} visitor - the visitor
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
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
     * Validate the decorator
     * @throws {IllegalModelException}
     * @private
     */
    validate() {
        const mf = this.getParent().getModelFile();
        const decoratedName = this.getParent().getFullyQualifiedName?.();
        const mm = mf.getModelManager();
        const validationOptions = mm.getDecoratorValidation();
        if (validationOptions.missingDecorator || validationOptions.invalidDecorator) {
            try {
                // this throws if the type does not exist
                mf.resolveType(decoratedName, this.getName(), this.ast.location);
                const decoratorDecl = mf.getType(this.getName());
                const requiredProperties = decoratorDecl.getProperties().filter(p => !p.isOptional());
                const optionalProperties = decoratorDecl.getProperties().filter(p => p.isOptional());
                const allProperties = [...requiredProperties, ...optionalProperties];
                if (this.getArguments().length < requiredProperties.length) {
                    const err = `Decorator ${this.getName()} has too few arguments. Required properties are: [${requiredProperties.map(p => p.getName()).join()}]`;
                    this.handleError(validationOptions.invalidDecorator, err);
                }
                const args = this.getArguments();
                for (let n = 0; n < args.length; n++) {
                    const arg = args[n];
                    if (n > allProperties.length - 1) {
                        const err = `Decorator ${this.getName()} has too many arguments. Properties are: [${allProperties.map(p => p.getName()).join()}]`;
                        this.handleError(validationOptions.invalidDecorator, err);
                    }
                    else {
                        const property = allProperties[n];
                        const argType = typeof arg;
                        switch (property.getType()) {
                        case 'Integer':
                        case 'Double':
                        case 'Long':
                            if (argType !== 'number') {
                                const err = `Decorator ${this.getName()} has invalid decorator argument. Expected number. Found ${argType}, with value ${JSON.stringify(arg)}`;
                                this.handleError(validationOptions.invalidDecorator, err);
                            }
                            break;
                        case 'String':
                            if (argType !== 'string') {
                                const err = `Decorator ${this.getName()} has invalid decorator argument. Expected string. Found ${argType}, with value ${JSON.stringify(arg)}`;
                                this.handleError(validationOptions.invalidDecorator, err);
                            }
                            break;
                        case 'Boolean':
                            if (argType !== 'boolean') {
                                const err = `Decorator ${this.getName()} has invalid decorator argument. Expected boolean. Found ${argType}, with value ${JSON.stringify(arg)}`;
                                this.handleError(validationOptions.invalidDecorator, err);
                            }
                            break;
                        default: {
                            if (argType !== 'object' || arg?.type !== 'Identifier') {
                                const err = `Decorator ${this.getName()} has invalid decorator argument. Expected object. Found ${argType}, with value ${JSON.stringify(arg)}`;
                                this.handleError(validationOptions.invalidDecorator, err);
                            }
                            const typeDecl = mf.getType(arg.name);
                            if (!typeDecl) {
                                const err = `Decorator ${this.getName()} references a type ${arg.name} which has not been defined/imported.`;
                                this.handleError(validationOptions.invalidDecorator, err);
                            }
                            else {
                                if (!ModelUtil.isAssignableTo(typeDecl.getModelFile(), typeDecl.getFullyQualifiedName(), property)) {
                                    const err = `Decorator ${this.getName()} references a type ${arg.name} which cannot be assigned to the declared type ${property.getFullyQualifiedTypeName()}`;
                                    this.handleError(validationOptions.invalidDecorator, err);
                                }
                            }
                            break;
                        }
                        }
                    }
                }
            }
            catch (err) {
                console.log(err);
                this.handleError(validationOptions.missingDecorator, err);
            }
        }
    }

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
