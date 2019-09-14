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

const ClassDeclaration = require('./classdeclaration');

/**
 * ConceptDeclaration defines the schema (aka model or class) for
 * an Concept. It extends ClassDeclaration which manages a set of
 * fields, a super-type and the specification of an
 * identifying field.
 *
 * @extends ClassDeclaration
 * @see {@link ClassDeclaration}
 * @class
 * @memberof module:concerto
 */
class ConceptDeclaration extends ClassDeclaration {

    /**
     * Create an AssetDeclaration.
     * @param {ModelFile} modelFile the ModelFile for this class
     * @param {Object} ast - The AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(modelFile, ast) {
        super(modelFile, ast);
        this._isConceptDeclaration = true;
    }

    /**
     * Returns true if this class is the definition of a concept.
     *
     * @return {boolean} true if the class is a concept
     */
    isConcept() {
        return true;
    }

    /**
     * Alternative instanceof that is reliable across different module instances
     * @see https://github.com/hyperledger/composer-concerto/issues/47
     *
     * @param {object} object - The object to test against
     * @returns {boolean} - True, if the object is an instance of a ConceptDeclaration
     */
    static [Symbol.hasInstance](object){
        return typeof object !== 'undefined' && object !== null && Boolean(object._isConceptDeclaration);
    }
}

module.exports = ConceptDeclaration;
