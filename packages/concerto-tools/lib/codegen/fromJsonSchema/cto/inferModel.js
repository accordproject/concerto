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
const Ajv2019 = require('ajv/dist/2019');
const Ajv2020 = require('ajv/dist/2020');
const draft6MetaSchema = require('ajv/dist/refs/json-schema-draft-06.json');
const draft7MetaSchema = require('ajv/dist/refs/json-schema-draft-07.json');
const addFormats = require('ajv-formats');

/**
 * Capitalize the first letter of a string
 * @param {string} string the input string
 * @returns {string} input with first letter capitalized
 * @private
 */
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

const REGEX_ESCAPED_CHARS = /[\s\\.-]/g;

/**
 * Remove whitespace and periods from a Type identifier
 * @param {string} type the input string
 * @returns {string} the normalized type name
 * @private
 */
function normalizeType(type) {
    return capitalizeFirstLetter(
        type
            // In CTO we only have one place to store definitions, so we flatten the storage structure from JSON Schema
            .replace(/^#\/(definitions|\$defs|components\/schemas)\//, '')
            // Replace delimiters with underscore
            .replace(REGEX_ESCAPED_CHARS, '_')
    );
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
 * @param {object} definition - the input object
 * @param {*} context - the processing context
 * @param {boolean} [skipDictionary] - if true, this function will not use the dictionary help inference
 * @returns {string} A name for the definition
 * @private
 */
function inferTypeName(definition, context, skipDictionary) {
    if (definition.$ref) {
        return normalizeType(definition.$ref);
    }

    const name = context.parents.slice(-1).pop();
    const { type } = parseIdUri(definition.$id) || { type: name };

    if (skipDictionary || context.dictionary.has(normalizeType(type))){
        return normalizeType(type);
    }

    // We've found an inline sub-schema
    if (definition.properties || definition.enum){
        const subSchemaName = context.parents
            .map(normalizeType)
            .join('_');

        // Come back to this later
        context.jobs.push({ name: subSchemaName, definition });
        return subSchemaName;
    }

    // We fallback to a stringified object representation. This is "untyped".
    return 'String';
}

/**
 * Get the Concerto type for an JSON Schema definition
 * @param {*} definition the input object
 * @param {*} context the processing context
 * @returns {string} the Concerto type
 * @private
 */
function inferType(definition, context) {
    const name = context.parents.slice(-1).pop();
    if (definition.$ref) {
        // Recursive defintion
        if (definition.$ref === '#') {
            const top = context.parents.pop();
            const parent = context.parents.slice(-1).pop();
            context.parents.push(top);
            return parent;
        }

        return inferTypeName(definition, context);
    }

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
                    console.warn(`Format '${definition.format}' in '${name}' is not supported. It has been ignored.`);
                    return 'String';
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

    // Hack until we support union types.
    // https://github.com/accordproject/concerto/issues/292
    const alternative = definition.anyOf || definition.oneOf;
    if (alternative){
        const keyword = definition.anyOf ? 'anyOf' : 'oneOf';
        console.warn(
            `Keyword '${keyword}' in definition '${name}' is not fully supported. Defaulting to first alternative.`
        );

        // Just choose the first item
        return inferType(alternative[0], context);
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
        let normalizedValue = value;
        // Concerto does not allow enum values to start with numbers or values such as `true`
        // If we can relax the parser rules, this branch could be removed
        if (typeof normalizedValue !== 'string' || normalizedValue.match(/^\d/)){
            normalizedValue = `_${normalizedValue}`;
        }
        normalizedValue = normalizedValue.replace(REGEX_ESCAPED_CHARS, '_');
        writer.writeLine(
            1,
            `o ${normalizedValue}`
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
            validator = ` regex=/${propertyDefinition.pattern.replace(/\//g, '\\/')}/`;
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
    const name = context.parents.slice(-1).pop();

    if (definition.enum) {
        inferEnum(definition, context);
    } else if (definition.type) {
        if (definition.type === 'object') {
            inferConcept(definition, context);
        } else if (definition.type === 'array') {
            console.warn(
                `Type keyword 'array' in definition '${name}' is not supported. It has been ignored.`
            );
        } else {
            throw new Error(
                `Type keyword '${definition.type}' in definition '${name}' is not supported.`
            );
        }
    } else {
        // Find all keys that are not supported
        const badKeys = Object.keys(definition).filter(key =>
            !['enum', 'type'].includes(key) &&
            !key.startsWith('x-') // Ignore custom extensions
        );
        console.warn(
            `Keyword(s) '${badKeys.join('\', \'')}' in definition '${name}' are not supported.`
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

    let ajv = new Ajv2019({ strict: false })
        .addMetaSchema(draft6MetaSchema)
        .addMetaSchema(draft7MetaSchema);

    if (schemaVersion && schemaVersion.startsWith('https://json-schema.org/draft/2020-12/schema')) {
        ajv = new Ajv2020({ strict: false });
    }

    if (schemaVersion && schemaVersion.startsWith('https://json-schema.org/draft/2020-12/schema')) {
        ajv = new Ajv2020({ strict: false });
    }

    const { namespace, type } = parseIdUri(schema.$id) ||
        { namespace: defaultNamespace, type: defaultType };

    ajv.addSchema(schema, type);
    addFormats(ajv);

    // Will throw an error for bad schemas
    ajv.validate(type);

    const context = {
        parents: new Array(), // Track ancestors in the tree
        writer: new Writer(),
        dictionary: new Set(),     // Track types that we've seen before
        jobs: new Array(),    // Queue of inline definitions to come-back to
    };

    context.writer.writeLine(0, `namespace ${namespace}`);
    context.writer.writeLine(0, '');

    // Create definitions
    const defs = schema.definitions || schema.$defs || schema?.components?.schemas ||[];

    // Build a dictionary
    context.dictionary.add(defaultType);
    if (schema.$id) {
        context.dictionary.add(normalizeType(parseIdUri(schema.$id).type));
    }
    Object.keys(defs).forEach((key) => {
        context.parents.push(key);
        const definition = defs[key];
        const typeName = inferTypeName(definition, context, true);
        if (context.dictionary.has(typeName)){
            throw new Error(`Duplicate definition found for type '${typeName}'.`);
        }
        context.dictionary.add(typeName);
        context.parents.pop();
    });

    // Visit each declaration
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

    // Generate declarations for all inline sub-schemas
    while(context.jobs.length > 0){
        const job = context.jobs.pop();
        context.parents.push(job.name);
        context.dictionary.add(job.name);
        inferDeclaration(job.definition, context);
        context.parents.pop();
    }

    return context.writer.getBuffer();
}

module.exports = inferModelFile;
