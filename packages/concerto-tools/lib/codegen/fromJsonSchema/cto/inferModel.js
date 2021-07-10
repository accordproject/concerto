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

const { Writer, TypedStack } = require('@accordproject/concerto-core');
const Ajv = require('ajv');
const draft6MetaSchema = require('ajv/dist/refs/json-schema-draft-06.json');
const addFormats = require('ajv-formats');
// const fs = require('fs');

/**
 * Capitalize the first letter of a string
 * @param {string} string the input string
 * @returns {string} input with first letter capitalized
 * @private
 */
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Remove whitespace and periods from a Type identifier
 * @param {string} type the input string
 * @returns {string} the normalized type name
 * @private
 */
function normalizeType(type) {
    return capitalizeFirstLetter(type.replace(/[\s\\.]/g, '_'));
}

/**
 * Get the Concerto type for an JSON Schema definition
 * @param {*} definition the input object
 * @param {*} context the processing context
 * @returns {string} the Concerto type
 * @private
 */
function inferType(definition, context) {
    const name = context.parents.peek();
    if (definition.$ref) {
        if (!definition.$ref.startsWith('#/definitions/')) {
            throw new Error(`The reference '${definition.$ref}' in '${name}' is not supported. Only local definitions are currently supported, e.g. '#/definitions/'`);
        }
        return definition.$ref.replace(/^#\/definitions\//, '');
    }

    // TODO Also add local sub-schema definition
    if (definition.enum) {
        return normalizeType(definition.title || name);
    }

    if (definition.type) {
        switch (definition.type) {
            case 'string':
                if (definition.format) {
                    if (definition.format === 'date-time' || definition.format === 'date') {
                        return 'DateTime';
                    } else {
                        throw new Error(`Format '${definition.format}' in '${name}' is not supported`);
                    }
                }
                return 'String';
            case 'boolean':
                return 'Boolean';
            case 'number':
                return 'Double';
            case 'integer':
                return 'Integer'; // Could also be Long?
            case 'array':
                return inferType(definition.items, context) + '[]';
            case 'object':
                return normalizeType(definition.title || name);
            default:
                throw new Error(`Type keyword '${definition.type}' in '${name}' is not supported`);
        }
    }
    throw new Error(`Unsupported definition: ${JSON.stringify(definition)}`);
}

/**
 * Convert JSON Schema enumeration to Concerto enum
 * @param {*} definition the input object
 * @param {*} context the processing context
 * @private
 */
function inferEnum(definition, context) {
    const { writer, parents } = context;
    const name = parents.peek();

    writer.writeLine(0, `enum ${normalizeType(definition.title || name)} {`);
    definition.enum.forEach((value) => {
        writer.writeLine(
            1,
            `o ${value}`
        );
    });
    writer.writeLine(0, '}');
    writer.writeLine(0, '');
}

/**
 * Convert JSON Schema object definiton to Concerto concept
 * @param {*} definition the input object
 * @param {*} context the processing context
 * @private
 */
function inferConcept(definition, context) {
    const { writer } = context;
    const type = inferType(definition, context);

    if (definition.additionalProperties) {
        throw new Error('\'additionalProperties\' are not supported in Concerto');
    }

    const requiredFields = [];
    if (definition.required) {
        requiredFields.push(...definition.required);
    }

    writer.writeLine(0, `concept ${type} {`);
    Object.keys(definition.properties || []).forEach((field) => {
        // Ignore reserved properties
        if (['$identifier', '$class'].includes(field)) {
            return;
        }

        const optional = !requiredFields.includes(field) ? ' optional' : '';

        const propertyDefinition = definition.properties[field];
        context.parents.push(field);
        writer.writeLine(
            1,
            `o ${inferType(propertyDefinition, context)} ${field}${optional}`
        );
        context.parents.pop();
    });
    writer.writeLine(0, '}');
    writer.writeLine(0, '');
}

/**
 * Infers a Concerto model from a JSON Schema.
 * @param {*} definition the input object
 * @param {*} context the processing context
 * @private
 */
function inferDeclaration(definition, context) {
    const name = context.parents.peek();

    if (definition.enum) {
        inferEnum(definition, context);
    } else if (definition.type) {
        if (definition.type === 'object') {
            inferConcept(definition, context);
        } else {
            throw new Error(
                `Type keyword '${definition.type}' in definition '${name}' not supported.`
            );
        }
    } else {
        // Find all keys that are not supported
        const badKeys = Object.keys(definition).filter(key => !['enum', 'type'].includes(key));
        throw new Error(
            `Keyword(s) '${badKeys.join('\', \'')}' in definition '${name}' not supported.`
        );
    }
}

/**
 * Infers a Concerto model from a JSON Schema.
 * @param {string} namespace the namespace to use for the model
 * @param {*} rootTypeName the name for the root concept
 * @param {*} schema the input json object
 * @returns {string} the Concerto model
 */
function inferModelFile(namespace, rootTypeName, schema) {
    // Validate the Schema before we start. We won't generate code for bad schema.
    const ajv = new Ajv({ strict: true })
        .addMetaSchema(draft6MetaSchema)
        .addSchema(schema, rootTypeName);
    addFormats(ajv);

    // Will throw an error for bad schemas
    ajv.validate(rootTypeName);

    const context = {
        parents: new TypedStack(),
        writer: new Writer(),
    };

    context.writer.writeLine(0, `namespace ${namespace}`);
    context.writer.writeLine(0, '');

    // Add imports
    // TODO we need some heuristic or metadata to identify Concerto dependencies rather than making assumptions
    context.writer.writeLine(0, 'import org.accordproject.time.* from https://models.accordproject.org/time@0.2.0.cto');
    context.writer.writeLine(0, '');

    // Create definitions
    Object.keys(schema.definitions || []).forEach((key) => {
        context.parents.push(key);
        const definition = schema.definitions[key];
        inferDeclaration(definition, context);
        context.parents.pop();
    });

    // Create root type
    context.parents.push(rootTypeName);
    inferDeclaration(schema, context);
    context.parents.pop();

    return context.writer.getBuffer();
}

// Prototype CLI tool
// usage: node lib/codegen/fromJsonSchema/inferModel.js MyJsonSchema.json namespace RootType
// if (!module.parent) {
//     const schema = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
//     console.log(inferModelFile(process.argv[3], process.argv[4], schema));
// }

module.exports = inferModelFile;
