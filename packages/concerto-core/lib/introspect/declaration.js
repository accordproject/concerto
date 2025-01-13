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

const Decorated = require('./decorated');
const ModelUtil = require('../modelutil');
const IllegalModelException = require('./illegalmodelexception');

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
/* istanbul ignore next */
if (global === undefined) {
    const ModelFile = require('./modelfile');
}
/* eslint-enable no-unused-vars */

/**
 * Declaration defines the structure (model/schema) of composite data.
 * It is composed of a set of Properties, may have an identifying field, and may
 * have a super-type.
 * A Declaration is conceptually owned by a ModelFile which
 * defines all the classes that are part of a namespace.
 *
 * @abstract
 * @class
 * @memberof module:concerto-core
 */
class Declaration extends Decorated {
    /**
     * Create a Declaration from an Abstract Syntax Tree. The AST is the
     * result of parsing.
     *
     * @param {ModelFile} modelFile - the ModelFile for this class
     * @param {Object} ast - the AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(modelFile, ast) {
        super(ast);
        this.modelFile = modelFile;
        this.process();
    }

    /**
     * Process the AST and build the model
     *
     * @throws {IllegalModelException}
     * @private
     */
    process() {
        super.process();

        if (!ModelUtil.isValidIdentifier(this.ast.name)){
            throw new IllegalModelException(`Invalid class name '${this.ast.name}'`, this.modelFile, this.ast.location);
        }

        // should we use resolved name here?
        this.name = this.ast.name;
        this.fqn = ModelUtil.getFullyQualifiedName(this.modelFile.getNamespace(), this.name);
    }

    /**
     * Returns the ModelFile that defines this class.
     *
     * @public
     * @return {ModelFile} the owning ModelFile
     */
    getModelFile() {
        return this.modelFile;
    }

    /**
     * Returns the short name of a class. This name does not include the
     * namespace from the owning ModelFile.
     *
     * @return {string} the short name of this class
     */
    getName() {
        return this.name;
    }

    /**
     * Return the namespace of this class.
     * @return {string} namespace - a namespace.
     */
    getNamespace() {
        return this.modelFile.getNamespace();
    }

    /**
     * Returns the fully qualified name of this class.
     * The name will include the namespace if present.
     *
     * @return {string} the fully-qualified name of this class
     */
    getFullyQualifiedName() {
        return this.fqn;
    }

    /**
     * Returns false as scalars are never identified.
     * @returns {Boolean} false as scalars are never identified
     */
    isIdentified() {
        return false;
    }

    /**
     * Returns false as scalars are never identified.
     * @returns {Boolean} false as scalars are never identified
     */
    isSystemIdentified() {
        return false;
    }

    /**
     * Returns the name of the identifying field for this class. Note
     * that the identifying field may come from a super type.
     *
     * @return {string} the name of the id field for this class or null if it does not exist
     */
    getIdentifierFieldName() {
        return null;
    }

    /**
     * Returns the FQN of the super type for this class or null if this
     * class does not have a super type.
     *
     * @return {string} the FQN name of the super type or null
     */
    getType() {
        return null;
    }

    /**
     * Returns the string representation of this class
     * @return {String} the string representation of the class
     */
    toString() {
        return null;
    }

    /**
     * Returns true if this class is the definition of an enum.
     *
     * @return {boolean} true if the class is an enum
     */
    isEnum() {
        return false;
    }

    /**
     * Returns true if this class is the definition of a class declaration.
     *
     * @return {boolean} true if the class is a class
     */
    isClassDeclaration() {
        return false;
    }

    /**
     * Returns true if this class is the definition of a scalar declaration.
     *
     * @return {boolean} true if the class is a scalar
     */
    isScalarDeclaration() {
        return false;
    }

    /**
     * Returns true if this class is the definition of a map-declaration.
     *
     * @return {boolean} true if the class is a map-declaration
     */
    isMapDeclaration() {
        return false;
    }
}

module.exports = Declaration;
