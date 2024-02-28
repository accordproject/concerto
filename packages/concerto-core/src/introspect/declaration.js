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

const IllegalModelException = require('./illegalmodelexception');
const Decorated = require('./decorated');
const ModelUtil = require('../modelutil');

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
/* istanbul ignore next */
if (global === undefined) {
    const ModelFile = require('./modelfile');
}
/* eslint-enable no-unused-vars */

/**
 * A Declaration is conceptually owned by a ModelFile which
 * defines all the top-level declarations that are part of a namespace.
 * A declaration has decorators, a name and a type.
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
        super(modelFile, ast);
        this.process();
    }

    /**
     * Semantic validation of the declaration. Subclasses should
     * override this method to impose additional semantic constraints on the
     * contents/relations of declarations.
     *
     * @throws {IllegalModelException}
     * @protected
     */
    validate() {
        super.validate();

        const declarations = this.getModelFile().getAllDeclarations();
        const declarationNames = declarations.map(
            d => d.getFullyQualifiedName()
        );
        const uniqueNames = new Set(declarationNames);

        if (uniqueNames.size !== declarations.length) {
            const duplicateElements = declarationNames.filter(
                (item, index) => declarationNames.indexOf(item) !== index
            );
            throw new IllegalModelException(
                `Duplicate declaration name ${duplicateElements[0]}`
            );
        }

        // #648 - check for clashes against imported types
        if (this.getModelFile().isImportedType(this.getName())){
            throw new IllegalModelException(`Type '${this.getName()}' clashes with an imported type with the same name.`, this.modelFile, this.ast.location);
        }

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
}

module.exports = Declaration;
