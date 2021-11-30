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

const Writer = require('@accordproject/concerto-util').Writer;
const TypedStack = require('@accordproject/concerto-util').TypedStack;

const isoRegex = /^(-?(?:[1-9][0-9]*)?[0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])T(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(.[0-9]+)?(Z)?$/gm;

/**
 * Capitalize the first letter of a string
 * @param {string} string the input string
 * @returns {string} input with first letter capitalized
 */
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Computes an integer hashcode value for a string
 * @param {string} value the input string
 * @returns {number} the hashcode
 */
function hashCode(value) {
    let hash = 0, i, chr;
    for (i = 0; i < value.length; i++) {
        chr   = value.charCodeAt(i);
        hash  = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
}

/**
 * Returns true if val is an object
 * @param {*} val the value to test
 * @returns {Boolean} true if val is an object
 */
function isObject(val) {
    if (val === null) {
        return false;
    }
    return ((typeof val === 'function') || (typeof val === 'object'));
}

/**
 * Returns true if val is a boolean
 * @param {*} val the value to test
 * @returns {Boolean} true if val is a boolean
 */
function isBoolean(val) {
    return val === true || val === false || toString.call(val) === '[object Boolean]';
}

/**
 * Returns true if val is null
 * @param {*} val the value to test
 * @returns {Boolean} true if val is null
 */
function isNull(val) {
    return val === null;
}

/**
 * Returns true if val is an array
 * @param {*} val the value to test
 * @returns {Boolean} true if val is an array
 */
function isArray(val) {
    return !isNull(val) && Array.isArray(val);
}

/**
 * Returns true if val is a string
 * @param {*} val the value to test
 * @returns {Boolean} true if val is a string
 */
function isString(val) {
    return (typeof val === 'string' || val instanceof String);
}

/**
 * Returns true if val is a date time
 * @param {*} val the value to test
 * @returns {Boolean} true if val is a string
 */
function isDateTime(val) {
    return !isNull(val) && isString(val) && val.match(isoRegex);
}

/**
 * Returns true if val is an integer
 * @param {*} val the value to test
 * @returns {Boolean} true if val is a string
 */
function isInteger(val) {
    if (isNull(val) || isNaN(val) || typeof val !== 'number') {
        return false;
    }
    return val.toString().indexOf('.') === -1;
}

/**
 * Returns true if val is an integer
 * @param {*} val the value to test
 * @returns {Boolean} true if val is a string
 */
function isDouble(val) {
    return (!isNull(val) && !isNaN(val) && typeof val === 'number' && val.toString().indexOf('.') !== -1);
}

/**
 * Get the primitive Concerto type for an input
 * @param {*} input the input object
 * @returns {string} the Concerto type
 */
function getType(input) {
    if (isDouble(input)) {
        return 'Double';
    }
    else if (isInteger(input)) {
        return 'Integer';
    } else if (isBoolean(input)) {
        return 'Boolean';
    } else if (isDateTime(input)) {
        return 'DateTime';
    } else if (isString(input)) {
        return 'String';
    }
    else {
        // nulls are assumed to be String
        return 'String';
    }
}

/**
 * Handles an array
 * @param {*} typeName the name of the type being processed
 * @param {*} context the processing context
 * @param {*} input  the input object
 * @returns {object} the type for the array
 */
function handleArray(typeName, context, input) {
    let result = null;
    let item = null;

    if(input.length > 0) {
        item = input[0];
        input.forEach( (i) => {
            if(isObject(i)) {
                item = {...item, ...i};
            }
        });
    }
    else {
        // empty array are assumed to be strings
        item = '';
    }
    const itemTypeName = isObject(item) ? typeName : getType(item);

    result = handleType(itemTypeName, context, item);
    result.array = '[]';
    result.optional = '',
    result.name = typeName;

    return result;
}

/**
 * Handles an input type
 * @param {*} name the name of the type being processed
 * @param {*} context the processing context
 * @param {*} input  the input object
 * @returns {object} an object for the type
 */
function handleType(name, context, input) {
    // console.log(name);
    let result = null;
    if (isArray(input)) {
        result = handleArray(name, context, input);
    } else if (isObject(input)) {
        const typeDef = {
            type: capitalizeFirstLetter(name),
            fields : []
        };
        context.parents.push(typeDef);
        context[typeDef.type] = typeDef;
        const me = context.parents.peek();

        Object.keys(input).forEach(key => {
            const result = handleType(key, context, input[key]);
            me.fields.push(result);
        });
        me.hash = hashCode(JSON.stringify(me.fields));
        context.parents.pop();
        result = {
            name,
            type: typeDef.type,
            array: '',
            optional : ''
        };
    } else {
        return {
            name: name,
            type: getType(input),
            array: '',
            optional : isNull(input) ? 'optional' : ''
        };
    }

    return result;
}

/**
 * Detect duplicate types and remove them
 * @param {*} context the context
 */
function removeDuplicateTypes(context) {
    const typeMap = {};
    Object.values(context).forEach(typeDef => {
        if(!typeMap[typeDef.hash]) {
            typeMap[typeDef.hash] = typeDef;
        }
    });

    Object.values(context).forEach(typeDef => {
        Object.values(typeDef.fields).forEach(fieldDef => {
            if(context[fieldDef.type]) {
                const dupeTypeDef = typeMap[context[fieldDef.type].hash];
                if(dupeTypeDef && fieldDef.type !== dupeTypeDef.type) {
                    // console.log(`Removed ${fieldDef.type} and replaced with ${dupeTypeDef.type}`);
                    delete context[fieldDef.type];
                    fieldDef.type = dupeTypeDef.type;
                }
            }
        });
    });

    // console.log(typeMap);
}

/**
 * Infers a Concerto model from a JSON instance.
 * @param {string} namespace the namespace to use for the model
 * @param {*} rootTypeName the name for the root concept
 * @param {*} input the input json object
 * @returns {string} the Concerto model
 */
function inferModel(namespace, rootTypeName, input) {
    const writer = new Writer();

    const context = {
        parents : new TypedStack()
    };
    handleType(rootTypeName, context, input);
    delete context.parents;
    removeDuplicateTypes(context);
    // console.log(JSON.stringify(context, null, 2));

    writer.writeLine( 0, `namespace ${namespace}`);
    Object.values(context).forEach(type => {
        writer.writeLine( 0, `concept ${type.type} {`);
        type.fields.forEach( field => writer.writeLine( 1, `o ${field.type}${field.array} ${field.name} ${field.optional}`));
        writer.writeLine( 0, '}');
    });

    return writer.getBuffer();
}

module.exports = inferModel;
