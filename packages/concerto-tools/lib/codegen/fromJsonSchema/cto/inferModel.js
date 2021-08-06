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
const Ajv2019 = require('ajv/dist/2019');
const Ajv2020 = require('ajv/dist/2020');
const draft6MetaSchema = require('ajv/dist/refs/json-schema-draft-06.json');
const draft7MetaSchema = require('ajv/dist/refs/json-schema-draft-07.json');
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
    return capitalizeFirstLetter(type.replace(/[\s\\.-]/g, '_'));
}

/**
 * Parse a $id URL to use it as a namespace and root type
 * @param {string} id - the $id value from a JSON schema
 * @returns {object} A namespace and type pair
 * @private
 */
function parseIdUri(id) {
    if (!id) { return; }

    // TODO (MCR) - support non-URL URI $id values
    // https://datatracker.ietf.org/doc/html/draft-wright-json-schema-01#section-9.2
    const url = new URL(id);
    let namespace = url.hostname.split('.').reverse().join('.');
    const path = url.pathname.split('/');
    const type = normalizeType(path.pop()
        .replace(/\.json$/, '') // Convention is to add .schema.json to $id
        .replace(/\.schema$/, ''));

    namespace += path.length > 0 ? path.join('.') : '';

    return { namespace, type };
}

/**
 * Infer a type name for a definition. Examines $id, title and parent declaration
 * @param {*} definition the input object
 * @param {*} context the processing context
 * @returns {string} A name for the definition
 * @private
 */
function inferTypeName(definition, context) {
    const name = context.parents.peek();
    const { type } = parseIdUri(definition.$id) ||
        { type: definition.title || name };
    return normalizeType(type);
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
        // Recursive defintion
        if (definition.$ref === '#') {
            const top = context.parents.pop();
            const parent = context.parents.peek();
            context.parents.push(top);
            return parent;
        }

        return normalizeType(definition.$ref.replace(/^#\/(definitions|\$defs)\//, ''));
    }

    // TODO Also add local sub-schema definition
    if (definition.enum) {
        return inferTypeName(definition, context);
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
                return inferTypeName(definition, context);
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
    const { writer } = context;

    writer.writeLine(0, `enum ${inferTypeName(definition, context)} {`);
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

        const type = inferType(propertyDefinition, context);

        let validator = '';
        // Note: Concerto does not provide syntax for exclusive minimum or inclusive maximum
        // https://json-schema.org/understanding-json-schema/reference/numeric.html#range
        if (['Double', 'Long', 'Integer'].includes(type)) {
            if (propertyDefinition.minimum || propertyDefinition.exclusiveMaximum) {
                const min = propertyDefinition.minimum || '';
                const exclusiveMax = propertyDefinition.exclusiveMaximum || '';
                validator = ` range=[${min},${exclusiveMax}]`;
            }
        } else if (type === 'String' && propertyDefinition.pattern) {
            validator = ` regex=/${propertyDefinition.pattern}/`;
        }

        // Warning: The semantics of this default property differs between JSON Schema and Concerto
        // JSON Schema does not fill in missing values during validation, whereas Concerto does
        // https://json-schema.org/understanding-json-schema/reference/generic.html#id2
        let defaultValue = '';
        if (propertyDefinition.default) {
            defaultValue = ` default=${JSON.stringify(propertyDefinition.default)}`;
        }

        writer.writeLine(
            1,
            `o ${type} ${field}${defaultValue}${validator}${optional}`
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
 * @param {string} defaultNamespace a fallback namespace to use for the model if it can't be infered
 * @param {string} defaultType a fallback name for the root concept if it can't be infered
 * @param {object} schema the input json object
 * @returns {string} the Concerto model
 */
function inferModelFile(defaultNamespace, defaultType, schema) {
    const schemaVersion = schema.$schema;

    let ajv = new Ajv2019({ strict: true })
        .addMetaSchema(draft6MetaSchema)
        .addMetaSchema(draft7MetaSchema);

    if (schemaVersion && schemaVersion.startsWith('https://json-schema.org/draft/2020-12/schema')) {
        ajv = new Ajv2020({ strict: true });
    }

    const { namespace, type } = parseIdUri(schema.$id) ||
        { namespace: defaultNamespace, type: defaultType };

    ajv.addSchema(schema, type);
    addFormats(ajv);

    // Will throw an error for bad schemas
    ajv.validate(type);

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
    const defs = schema.definitions || schema.$defs || [];
    Object.keys(defs).forEach((key) => {
        context.parents.push(key);
        const definition = defs[key];
        inferDeclaration(definition, context);
        context.parents.pop();
    });

    // Create root type
    context.parents.push(type);
    inferDeclaration(schema, context);
    context.parents.pop();

    return context.writer.getBuffer();
}

// Prototype CLI tool
// usage: node lib/codegen/fromJsonSchema/cto/inferModel.js MyJsonSchema.json namespace RootType
// if (!module.parent) {
//     const schema = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
//     console.log(inferModelFile(process.argv[3], process.argv[4], schema));
// }

module.exports = inferModelFile;
