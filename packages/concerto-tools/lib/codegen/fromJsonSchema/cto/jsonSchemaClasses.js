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
 * A visitable class to be used by the JsonSchemaVisitor.
 *
 * @class
 */
class Visitable {
    /**
     * @param {Object} body - the body.
     * @param {String[]} path - the location inside the JSON Schema model.
     *
     */
    constructor(body, path) {
        this.body = body;
        this.path = path;
    }
    /**
     * @param {Object} visitor - the JSON Schema model visitor.
     * @param {Object} parameters - the visitor parameters.
     *
     * @return {Object} the result of visiting or undefined.
     */
    accept(visitor, parameters) {
        return visitor.visit(this, parameters);
    }
}

/**
 * A local reference visitable class.
 *
 * @class
 */
class LocalReference extends Visitable { isLocalReference = true; }
/**
 * A reference visitable class.
 *
 * @class
 */
class Reference extends Visitable { isReference = true; }
/**
 * An array property visitable class.
 *
 * @class
 */
class ArrayProperty extends Visitable { isArrayProperty = true; }
/**
 * A property visitable class.
 *
 * @class
 */
class Property extends Visitable { isProperty = true; }
/**
 * A properties visitable class.
 *
 * @class
 */
class Properties extends Visitable { isProperties = true; }
/**
 * A non-enum definition visitable class.
 *
 * @class
 */
class NonEnumDefinition extends Visitable { isNonEnumDefinition = true; }
/**
 * An enum definition visitable class.
 *
 * @class
 */
class EnumDefinition extends Visitable { isEnumDefinition = true; }
/**
 * An definition visitable class.
 *
 * @class
 */
class Definition extends Visitable { isDefinition = true; }
/**
 * A definitions visitable class.
 *
 * @class
 */
class Definitions extends Visitable { isDefinitions = true; }
/**
 * A JsonSchemaModel visitable class.
 *
 * @class
 */
class JsonSchemaModel extends Visitable {
    /**
     * @param {Object} body - the body.
     *
     */
    constructor(body) {
        super(body, []);
    }

    isJsonSchemaModel = true;
}

module.exports = {
    Visitable,
    LocalReference,
    Reference,
    ArrayProperty,
    Property,
    Properties,
    NonEnumDefinition,
    EnumDefinition,
    Definition,
    Definitions,
    JsonSchemaModel,
};
