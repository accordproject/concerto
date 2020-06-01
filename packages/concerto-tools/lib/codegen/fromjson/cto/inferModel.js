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

const Writer = require('@accordproject/concerto-core').Writer;
const TypedStack = require('@accordproject/concerto-core').TypedStack;

const isoRegex = /^(-?(?:[1-9][0-9]*)?[0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])T(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(.[0-9]+)?(Z)?$/gm;

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Returns true if val is an object
 * @param {*} val the value to test
 * @returns {Boolean} true if val is an object
 */
function isObject(val) {
    if (isArray(val)) {
        return false;
    }
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
    return !isNull(val) && val.match(isoRegex);
}

/**
 * Returns true if val is an integer
 * @param {*} val the value to test
 * @returns {Boolean} true if val is a string
 */
function isInteger(val) {
    if (isNull(val) || isNaN(val)) {
        return false;
    }
    let x = parseFloat(val);
    return (x | 0) === x;
}

/**
 * Returns true if val is an integer
 * @param {*} val the value to test
 * @returns {Boolean} true if val is a string
 */
function isDouble(val) {
    return (!isNull(val) && !isNaN(val) && val.toString().indexOf('.') !== -1);
}

/**
 * Handles an array
 * @param {*} typeName the name of the type being processed
 * @param {*} context the processing context
 * @param {*} input  the input object
 */
function handleArray(typeName, context, input) {
    let result = null;
    if(input.length > 0) {
        const item = input[0];
        const itemTypeName = isObject(item) ? typeName : getType(item);
        result = handleType(itemTypeName, context, item);
        if(result) {
            result.array = '[]';
            result.name = typeName;
        }
    }

    return result;
}

/**
 * Get the primitive Concerto type for an input
 * @param {*} input the input object
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
        // e.g. null values
        return 'String';
    }
}

/**
 * Handles an input type
 * @param {*} typeName the name of the type being processed
 * @param {*} context the processing context
 * @param {*} input  the input object
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
        context[name] = typeDef;
        const me = context.parents.peek();

        Object.keys(input).forEach(key => {
            const result = handleType(key, context, input[key]);
            if(result) {
                me.fields.push(result);
            }
        });
        context.parents.pop();
        result = {
            name,
            type: typeDef.type,
            array: ''
        };
    } else {
        return {
            name: name,
            type: getType(input),
            array: ''
        };
    }

    return result;
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
    // console.log(JSON.stringify(context, null, 2));

    writer.writeLine( 0, `namespace ${namespace}`);
    Object.keys(context).forEach(key => {
        const type = context[key];
        writer.writeLine( 0, `concept ${type.type} {`);
        type.fields.forEach( field => writer.writeLine( 1, `o ${field.type}${field.array} ${field.name}`));
        writer.writeLine( 0, '}');
    });

    return writer.getBuffer();
}

module.exports = inferModel;
