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
 * Tests whether an object is a concept
 * @param {*} obj the input object
 * @param {*} modelManager the model manager
 * @returns {boolean} true if the object is a concept
 */
function isConcept(obj, modelManager) {
    const concepts = modelManager.getConceptDeclarations();
    return concepts.filter( clazz => clazz.getFullyQualifiedName() === obj.$class ).length > 0;
}

/**
 * Tests whether an object is a concept
 * @param {*} obj the input object
 * @param {*} modelManager the model manager
 */
function getIdentifier(obj, modelManager) {
}

/**
 * Tests whether an object is a concept
 * @param {*} obj the input object
 * @param {*} modelManager the model manager
 */
function getFullyQualifiedIdentifier(obj, modelManager) {
}

/**
 * Tests whether an object is a concept
 * @param {*} obj the input object
 * @param {*} modelManager the model manager
 */
function isRelationship(obj, modelManager) {
}

/**
 * Tests whether an object is a concept
 * @param {*} obj the input object
 * @param {*} modelManager the model manager
 */
function isResource(obj, modelManager) {
}

/**
 * Tests whether an object is a concept
 * @param {*} obj the input object
 * @param {*} modelManager the model manager
 */
function toURI(obj, modelManager) {
}

/**
 * Tests whether an object is a concept
 * @param {*} obj the input object
 * @param {*} modelManager the model manager
 */
function getType(obj, modelManager) {
}

/**
 * Tests whether an object is a concept
 * @param {*} obj the input object
 * @param {*} modelManager the model manager
 */
function getFullyQualifiedType(obj, modelManager) {
}

/**
 * Tests whether an object is a concept
 * @param {*} obj the input object
 * @param {*} modelManager the model manager
 */
function getNamespace(obj, modelManager) {
}

/**
 * Tests whether an object is a concept
 * @param {*} obj the input object
 * @param {*} modelManager the model manager
 * @param {string} typeName the name of the type to test
 */
function instanceOf(obj, modelManager, typeName) {
}

/**
 * Tests whether an object is a concept
 * @param {*} obj the input object
 * @param {*} modelManager the model manager
 */
function validate(obj, modelManager) {
}

module.exports.isConcept = isConcept;
module.exports.getIdentifier = getIdentifier;
module.exports.getFullyQualifiedIdentifier = getFullyQualifiedIdentifier;
module.exports.isRelationship = isRelationship;
module.exports.isResource = isResource;
module.exports.toURI = toURI;
module.exports.getType = getType;
module.exports.getFullyQualifiedType = getFullyQualifiedType;
module.exports.getNamespace = getNamespace;
module.exports.instanceOf = instanceOf;
module.exports.validate = validate;