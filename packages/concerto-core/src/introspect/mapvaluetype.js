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

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
/* istanbul ignore next */
if (global === undefined) {
    const ModelFile = require('./modelfile');
    const MapDeclaration = require('./mapdeclaration');
}

/**
 * MapValueType defines a value type of an MapDeclaration.
 *
 * @extends Decorated
 * @see See {@link Decorated}
 * @class
 * @memberof module:concerto-core
 */
class MapValueType extends Decorated {
    /**
     * Create an MapValueType.
     * @param {MapDeclaration} map - The map for the map value
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
        let mapvalueType = this.getMapValueType();
        if (!ModelUtil.isPrimitiveType(mapvalueType)) {
            this.getModelFile().resolveType( 'map value ' + this.map.getFullyQualifiedName(), mapvalueType);
        }
    }

    /**
    * Returns the map for the map value
     * @public
     * @return {MapDeclaration} the parent map declaration
     */
    getParent() {
        return this.map;
    }

    /**
     * Converts the MapValueType to a synthetic field
     * @returns {Field} the synthetic field for the map value
     */
    toField() {
        const mapValueType = this.getMapValueType();
        const mapValueFieldType = ModelUtil.isPrimitiveType(mapValueType) ? mapValueType : 'Object';
        // create a synthetic field for the map value
        const mapKeyField = new Field(this.getParent(), {
            $class: `${MetaModelNamespace}.${mapValueFieldType}Property`,
            name: `${this.getParent().getName()}_map_value`,
            type: ModelUtil.isPrimitiveType(mapValueType) ? mapValueType
                : {name: mapValueType}
        });
        return mapKeyField;
    }
}

module.exports = MapValueType;
