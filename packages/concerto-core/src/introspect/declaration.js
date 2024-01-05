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
