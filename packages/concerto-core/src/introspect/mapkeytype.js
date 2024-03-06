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
const Field = require('./field');
const ModelUtil = require('../modelutil');

const Decorated = require('./decorated');
const IllegalModelException = require('./illegalmodelexception');

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
/* istanbul ignore next */
if (global === undefined) {
    const ModelFile = require('./modelfile');
    const MapDeclaration = require('./mapdeclaration');
}

const VALID_KEY_TYPES = ['String', 'DateTime'];

/**
 * MapKeyType defines a Key type of an MapDeclaration.
 *
 * @extends Decorated
 * @see See {@link Decorated}
 * @class
 * @memberof module:concerto-core
 */
class MapKeyType extends Decorated {
    /**
     * Create an MapKeyType.
     * @param {MapDeclaration} map - The map for the map key
     * @param {Object} ast - The AST created by the parser
     * @param {ModelFile} modelFile - the ModelFile for the Map class
     * @throws {IllegalModelException}
     */
    constructor(map, ast) {
        super(map.getModelFile(), ast);
        this.map = map;
        this.process();
    }

    /**
     * Semantic validation of the structure of this class.
     *
     * @throws {IllegalModelException}
     * @protected
     */
    validate() {
        let mapkeyType = this.getMapKeyType();
        if (!ModelUtil.isPrimitiveType(mapkeyType)) {
            this.getModelFile().resolveType( 'map key ' + this.map.getFullyQualifiedName(), mapkeyType);
            const mapkeyDecl = this.getModelFile().getType(mapkeyType);
            if(mapkeyDecl && mapkeyDecl.isScalar()) {
                mapkeyType = mapkeyDecl.getScalarType();
            }
        }

        if(!VALID_KEY_TYPES.includes(mapkeyType)) {
            throw new IllegalModelException(`A map key must be one of ${VALID_KEY_TYPES}, or a scalar thereof. Invalid type: ${mapkeyType}, for map ${this.map.getFullyQualifiedName()}`);
        }
    }

    /**
    * Returns the map for the map key
     * @public
     * @return {MapDeclaration} the parent map declaration
     */
    getParent() {
        return this.map;
    }

    /**
     * Converts the MapKeyType to a synthetic field
     * @returns {Field} the synthetic field for the map key
     */
    toField() {
        const mapKeyType = this.getMapKeyType();
        const mapKeyFieldType = ModelUtil.isPrimitiveType(mapKeyType) ? mapKeyType : 'Object';
        // create a synthetic field for the map key
        const mapKeyField = new Field(this.getParent(), {
            $class: `${MetaModelNamespace}.${mapKeyFieldType}Property`,
            name: `${this.getParent().getName()}_map_key`,
            type: ModelUtil.isPrimitiveType(mapKeyType) ? mapKeyType
                : {name: mapKeyType}
        });
        return mapKeyField;
    }
}

module.exports = MapKeyType;
