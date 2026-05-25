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

const Relationship = require('../model/relationship');
const Resource = require('../model/resource');
const Identifiable = require('../model/identifiable');
const Util = require('@accordproject/concerto-util').NullUtil;
const ModelUtil = require('../modelutil');
const ValidationException = require('./validationexception');
const Globalize = require('../globalize');

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
dayjs.extend(utc);

/**
 * Internal sentinel used in diagnostic-collection mode to unwind from a
 * leaf reporter back to the nearest siblings loop after the diagnostic has
 * been recorded. Never escapes the validator.
 * @private
 */
class CollectedDiagnosticException extends Error {
    constructor() {
        super('diagnostic collected');
    }
}

/**
 * Escape a JSON-pointer reference token per RFC 6901.
 * @param {string|number} token a path segment
 * @returns {string} escaped segment
 * @private
 */
function escapeJsonPointerToken(token) {
    return String(token).replace(/~/g, '~0').replace(/\//g, '~1');
}

/**
 * Render the current visitor path as a JSON Pointer.
 * @param {Object} parameters visitor parameters
 * @returns {string} JSON-pointer style path, e.g. "/parties/0/email"
 * @private
 */
function currentPath(parameters) {
    if (!parameters.pathStack || parameters.pathStack.length === 0) {
        return '/';
    }
    return '/' + parameters.pathStack.map(escapeJsonPointerToken).join('/');
}

/**
 * Push a path segment, run fn, then pop. Always pops even if fn throws.
 * @param {Object} parameters visitor parameters
 * @param {string|number} segment path segment to push
 * @param {Function} fn function to invoke while the segment is on the stack
 * @returns {*} the value returned by fn
 * @private
 */
function withPath(parameters, segment, fn) {
    if (!parameters.pathStack) {
        parameters.pathStack = [];
    }
    parameters.pathStack.push(segment);
    try {
        return fn();
    } finally {
        parameters.pathStack.pop();
    }
}

/**
 * <p>
 * Validates a Resource or Field against the models defined in the ModelManager.
 * This class is used with the Visitor pattern and visits the class declarations
 * (etc) for the model, checking that the data in a Resource / Field is consistent
 * with the model.
 * </p>
 * The parameters for the visit method must contain the following properties:
 * <ul>
 *  <li> 'stack' - the TypedStack of objects being processed. It should
 * start as [Resource] or [Field]</li>
 * <li> 'rootResourceIdentifier' - the identifier of the resource being validated </li>
 * <li> 'modelManager' - the ModelManager instance to use for type checking</li>
 * </ul>
 * @private
 * @class
 * @memberof module:concerto-core
 */
class ResourceValidator {
    options: any;

    /**
     * ResourceValidator constructor
     * @param {Object} options - the optional serialization options.
     * @param {boolean} options.validate - validate the structure of the Resource
     * with its model prior to serialization (default to true)
     * @param {boolean} options.convertResourcesToRelationships - Convert resources that
     * are specified for relationship fields into relationships, false by default.
     * @param {boolean} options.permitResourcesForRelationships - Permit resources in the
     */
    constructor(options) {
        this.options = options || {};
    }

    /**
     * Run a reporter (one that normally throws a ValidationException) under
     * diagnostic collection. In throw mode the reporter is invoked directly.
     * In collect mode the thrown ValidationException is captured as a
     * structured Diagnostic, the path is recorded, and a sentinel is rethrown
     * so the nearest siblings loop can continue.
     * @param {Object} parameters - visitor parameters
     * @param {string} code - the diagnostic code to attach
     * @param {Function} reportFn - the report function (throws on call)
     * @param {Object} [extra] - optional fields to merge into the diagnostic
     * @private
     */
    static reportOrCollect(parameters, code, reportFn, extra?) {
        if (!parameters.errorCollector) {
            reportFn();
            return;
        }
        try {
            reportFn();
        } catch (err) {
            if (err instanceof CollectedDiagnosticException) {
                throw err;
            }
            const message = err instanceof Error ? err.message : String(err);
            parameters.errorCollector.push(Object.assign({
                code,
                message,
                path: currentPath(parameters),
                severity: 'error',
                cause: err,
            }, extra || {}));
            throw new CollectedDiagnosticException();
        }
    }

    /**
     * Visitor design pattern.
     *
     * @param {Object} thing - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visit(thing, parameters) {
        if (thing.isEnum?.()) {
            return this.visitEnumDeclaration(thing, parameters);
        } else if (thing.isClassDeclaration?.()) {
            return this.visitClassDeclaration(thing, parameters);
        } else if (thing.isMapDeclaration?.()) {
            return this.visitMapDeclaration(thing, parameters);
        }else if (thing.isRelationship?.()) {
            return this.visitRelationshipDeclaration(thing, parameters);
        } else if (thing.isTypeScalar?.()) {
            return this.visitField(thing.getScalarField(), parameters);
        } else if (thing.isField?.()) {
            return this.visitField(thing, parameters);
        }
    }

    /**
     * Visitor design pattern
     *
     * @param {EnumDeclaration} enumDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitEnumDeclaration(enumDeclaration, parameters) {
        const obj = parameters.stack.pop();

        // now check that obj is one of the enum values
        const properties = enumDeclaration.getProperties();
        let found = false;
        for(let n=0; n < properties.length; n++) {
            const property = properties[n];
            if(property.getName() === obj) {
                found = true;
            }
        }

        if(!found) {
            ResourceValidator.reportOrCollect(parameters, 'INVALID_ENUM_VALUE',
                () => ResourceValidator.reportInvalidEnumValue(parameters.rootResourceIdentifier, enumDeclaration, obj));
        }

        return null;
    }


    /**
     * Check a Type that is declared as a Map Type.
     * @param {Object} type - the type in scope for validation, can be MapTypeKey or MapTypeValue
     * @param {Object} value - the object being validated
     * @param {Object} parameters  - the parameter
     * @param {Map} mapDeclaration - the object being visited
     * @private
     */
    checkMapType(type, value, parameters, mapDeclaration, ) {

        if (!ModelUtil.isPrimitiveType(type.getType())) {

            // thing might be a Concept, Scalar String, Scalar DateTime
            let thing = mapDeclaration.getModelFile()
                .getAllDeclarations()
                .find(decl => decl.name === type.getType());

            // if Key or Value is Scalar, get the Base Type of the Scalar for primitive validation.
            if (ModelUtil.isScalar(mapDeclaration.getKey())) {
                type = thing.getType();
            }

            if (thing?.isClassDeclaration?.()) {
                parameters.stack.push(value);
                thing.accept(this, parameters);
                return;
            }
        } else {
            // otherwise its a primitive
            type = type.getType();

        }

        // validate the primitive
        switch(type) {
        case 'String':
            if (typeof value !== 'string') {
                ResourceValidator.reportOrCollect(parameters, 'MAP_TYPE_VIOLATION',
                    () => { throw new ValidationException(`Model violation in ${mapDeclaration.getFullyQualifiedName()}. Expected Type of String but found '${value}' instead.`); });
            }
            break;
        case 'DateTime':
            if (!dayjs.utc(value).isValid()) {
                ResourceValidator.reportOrCollect(parameters, 'MAP_TYPE_VIOLATION',
                    () => { throw new ValidationException(`Model violation in ${mapDeclaration.getFullyQualifiedName()}. Expected Type of DateTime but found '${value}' instead.`); });
            }
            break;
        case 'Boolean':
            if (typeof value !== 'boolean') {
                const typeOfValue = typeof value;
                ResourceValidator.reportOrCollect(parameters, 'MAP_TYPE_VIOLATION',
                    () => { throw new ValidationException(`Model violation in ${mapDeclaration.getFullyQualifiedName()}. Expected Type of Boolean but found ${typeOfValue} instead, for value '${value}'.`); });
            }
            break;
        }
    }

    /**
     * Visitor design pattern
     *
     * @param {MapDeclaration} mapDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     *
     * @private
     */
    visitMapDeclaration(mapDeclaration, parameters) {

        const obj = parameters.stack.pop();

        if (!((obj instanceof Map))) {
            ResourceValidator.reportOrCollect(parameters, 'MAP_TYPE_VIOLATION',
                () => { throw new ValidationException('Expected a Map, but found ' + JSON.stringify(obj)); });
        }

        obj.forEach((value, key) => {
            if (!ModelUtil.isSystemProperty(key)) {
                try {
                    withPath(parameters, String(key), () => {
                        // Validate Key
                        this.checkMapType(mapDeclaration.getKey(), key, parameters, mapDeclaration);
                        // Validate Value
                        this.checkMapType(mapDeclaration.getValue(), value, parameters, mapDeclaration);
                    });
                } catch (err) {
                    if (err instanceof CollectedDiagnosticException) {
                        return; // continue forEach
                    }
                    throw err;
                }
            }
        });

        return null;
    }

    /**
     * Visitor design pattern
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitClassDeclaration(classDeclaration, parameters) {

        const obj = parameters.stack.pop();

        // are we dealing with a Resource?
        if(!((obj instanceof Resource))) {
            ResourceValidator.reportOrCollect(parameters, 'NOT_RESOURCE',
                () => ResourceValidator.reportNotResouceViolation(parameters.rootResourceIdentifier, classDeclaration, obj));
        }

        if(obj instanceof Identifiable) {
            parameters.rootResourceIdentifier = obj.getFullyQualifiedIdentifier();
        }

        const toBeAssignedClassDeclaration = parameters.modelManager.getType(obj.getFullyQualifiedType());
        const toBeAssignedClassDecName = toBeAssignedClassDeclaration.getFullyQualifiedName();
        const identifierFieldName = toBeAssignedClassDeclaration.getIdentifierFieldName();

        // is the type we are assigning to abstract?
        // the only way this can happen is if the type is non-abstract
        // and then gets redeclared as abstract
        if(toBeAssignedClassDeclaration.isAbstract()) {
            ResourceValidator.reportOrCollect(parameters, 'ABSTRACT_CLASS',
                () => ResourceValidator.reportAbstractClass(toBeAssignedClassDeclaration));
        }

        // are there extra fields in the object?
        let props = Object.getOwnPropertyNames(obj);
        for (let n = 0; n < props.length; n++) {
            try {
                let propName = props[n];
                if(!ModelUtil.isSystemProperty(propName)) {
                    const field = toBeAssignedClassDeclaration.getProperty(propName);
                    if (!field) {
                        if(classDeclaration.isIdentified() &&
                            // Allow shadowing of the $identifier field to normalize lookup of the identifying field.
                            propName !== '$identifier'
                        ){
                            withPath(parameters, propName, () =>
                                ResourceValidator.reportOrCollect(parameters, 'UNDECLARED_FIELD',
                                    () => ResourceValidator.reportUndeclaredField(obj.getIdentifier(), propName, toBeAssignedClassDecName)));
                        }
                        else {
                            withPath(parameters, propName, () =>
                                ResourceValidator.reportOrCollect(parameters, 'UNDECLARED_FIELD',
                                    () => ResourceValidator.reportUndeclaredField(parameters.currentIdentifier, propName, toBeAssignedClassDecName)));
                        }
                    }
                }
            } catch (err) {
                if (err instanceof CollectedDiagnosticException) {
                    continue;
                }
                throw err;
            }
        }

        if(classDeclaration.isIdentified()) {
            const id = obj.getIdentifier();

            // prevent empty identifiers
            if(!id || id.trim().length === 0) {
                ResourceValidator.reportOrCollect(parameters, 'EMPTY_IDENTIFIER',
                    () => ResourceValidator.reportEmptyIdentifier(parameters.rootResourceIdentifier));
            }

            // Enforce that shadowed $identifier fields have the same value as the explicit identifying field.
            // The value of the explicit identified field takes precedence.
            if (identifierFieldName !== '$identifier'){
                obj.$identifier = id;
            }

            parameters.currentIdentifier = obj.getFullyQualifiedIdentifier();
        }

        // now validate each property
        const properties = toBeAssignedClassDeclaration.getProperties();
        for(let n=0; n < properties.length; n++) {
            const property = properties[n];
            try {
                const value = obj[property.getName()];
                if(!Util.isNull(value)) {
                    withPath(parameters, property.getName(), () => {
                        parameters.stack.push(value);
                        property.accept(this, parameters);
                    });
                }
                else {
                    if(!property.isOptional()) {
                        // Allow shadowing of the $identifier field to normalize lookup of the identifying field.
                        if (property.getName() === '$identifier' && identifierFieldName !== '$identifier'
                        ) {
                            continue;
                        }
                        // Allow implicit optionality by declaring a default value, without using the optional keyword.
                        if (!Util.isNull(property?.defaultValue)){
                            continue;
                        }
                        withPath(parameters, property.getName(), () =>
                            ResourceValidator.reportOrCollect(parameters, 'MISSING_REQUIRED_FIELD',
                                () => ResourceValidator.reportMissingRequiredProperty(parameters.rootResourceIdentifier, property)));
                    }
                }
            } catch (err) {
                if (err instanceof CollectedDiagnosticException) {
                    continue;
                }
                throw err;
            }
        }
        return null;
    }

    /**
     * Visitor design pattern
     * @param {Field} field - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitField(field, parameters) {
        const obj = parameters.stack.pop();

        let dataType = typeof(obj);
        let propName = field.getName();

        if (dataType === 'undefined' || dataType === 'symbol') {
            ResourceValidator.reportOrCollect(parameters, 'FIELD_TYPE_VIOLATION',
                () => ResourceValidator.reportFieldTypeViolation(parameters.rootResourceIdentifier, propName, obj, field));
            return null;
        }

        if(field.isTypeEnum()) {
            this.checkEnum(obj, field,parameters);
        }
        else {
            if(field.isArray()) {
                this.checkArray(obj, field,parameters);
            }
            else {
                this.checkItem(obj, field,parameters);
            }
        }

        return null;
    }

    /**
     * Check a Field that is declared as an Array.
     * @param {Object} obj - the object being validated
     * @param {Field} field - the object being visited
     * @param {Object} parameters  - the parameter
     * @private
     */
    checkEnum(obj,field,parameters) {

        if(field.isArray() && !(obj instanceof Array)) {
            ResourceValidator.reportOrCollect(parameters, 'FIELD_TYPE_VIOLATION',
                () => ResourceValidator.reportFieldTypeViolation(parameters.rootResourceIdentifier, field.getName(), obj, field));
        }

        const enumDeclaration = field.getParent().getModelFile().getType(field.getType());

        if(field.isArray()) {
            for(let n=0; n < obj.length; n++) {
                const item = obj[n];
                try {
                    withPath(parameters, n, () => {
                        parameters.stack.push(item);
                        enumDeclaration.accept(this, parameters);
                    });
                } catch (err) {
                    if (err instanceof CollectedDiagnosticException) {
                        continue;
                    }
                    throw err;
                }
            }
        }
        else {
            const item = obj;
            parameters.stack.push(item);
            enumDeclaration.accept(this, parameters);
        }
    }

    /**
     * Check a Field that is declared as an Array.
     * @param {Object} obj - the object being validated
     * @param {Field} field - the object being visited
     * @param {Object} parameters  - the parameter
     * @private
     */
    checkArray(obj,field,parameters) {

        if(!(obj instanceof Array)) {
            ResourceValidator.reportOrCollect(parameters, 'FIELD_TYPE_VIOLATION',
                () => ResourceValidator.reportFieldTypeViolation(parameters.rootResourceIdentifier, field.getName(), obj, field));
        }

        for(let n=0; n < obj.length; n++) {
            const item = obj[n];
            try {
                withPath(parameters, n, () => {
                    this.checkItem(item, field, parameters);
                });
            } catch (err) {
                if (err instanceof CollectedDiagnosticException) {
                    continue;
                }
                throw err;
            }
        }
    }

    /**
     * Check a single (non-array) field.
     * @param {Object} obj - the object being validated
     * @param {Field} field - the object being visited
     * @param {Object} parameters  - the parameter
     * @private
     */
    checkItem(obj,field, parameters) {
        let dataType = typeof obj;
        let propName = field.getName();

        if (dataType === 'undefined' || dataType === 'symbol') {
            ResourceValidator.reportOrCollect(parameters, 'FIELD_TYPE_VIOLATION',
                () => ResourceValidator.reportFieldTypeViolation(parameters.rootResourceIdentifier, propName, obj, field));
        }

        if(field.isPrimitive()) {
            let invalid = false;

            switch(field.getType()) {
            case 'String':
                if(dataType !== 'string') {
                    invalid = true;
                }
                break;
            case 'Long':
            case 'Integer':
            case 'Double': {
                if(dataType !== 'number') {
                    invalid = true;
                }
                if (!isFinite(obj)) {
                    invalid = true;
                }
            }
                break;
            case 'Boolean':
                if(dataType !== 'boolean') {
                    invalid = true;
                }
                break;
            case 'DateTime':
                if(!(typeof obj === 'object' && typeof obj.isBefore === 'function')) {
                    invalid = true;
                }
                break;
            }
            if (invalid) {
                ResourceValidator.reportOrCollect(parameters, 'FIELD_TYPE_VIOLATION',
                    () => ResourceValidator.reportFieldTypeViolation(parameters.rootResourceIdentifier, propName, obj, field));
            }
            else {
                if(field.getValidator() !== null) {
                    ResourceValidator.reportOrCollect(parameters, 'VALIDATOR_VIOLATION',
                        () => field.getValidator().validate(parameters.currentIdentifier, obj));
                }
            }
        }
        else {
            // a field that points to a transaction, asset, participant...
            let classDeclaration = parameters.modelManager.getType(field.getFullyQualifiedTypeName());
            if(obj instanceof Identifiable) {
                try {
                    classDeclaration = parameters.modelManager.getType(obj.getFullyQualifiedType());
                } catch (err) {
                    ResourceValidator.reportOrCollect(parameters, 'FIELD_TYPE_VIOLATION',
                        () => ResourceValidator.reportFieldTypeViolation(parameters.rootResourceIdentifier, propName, obj, field));
                }

                // is it compatible?
                if(!ModelUtil.isAssignableTo(classDeclaration.getModelFile(), classDeclaration.getFullyQualifiedName(), field)) {
                    ResourceValidator.reportOrCollect(parameters, 'INVALID_FIELD_ASSIGNMENT',
                        () => ResourceValidator.reportInvalidFieldAssignment(parameters.rootResourceIdentifier, propName, obj, field));
                }
            }

            // recurse
            parameters.stack.push(obj);
            classDeclaration.accept(this, parameters);
        }
    }

    /**
     * Visitor design pattern
     * @param {RelationshipDeclaration} relationshipDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitRelationshipDeclaration(relationshipDeclaration, parameters) {
        const obj = parameters.stack.pop();

        if(relationshipDeclaration.isArray()) {
            if(!(obj instanceof Array)) {
                ResourceValidator.reportOrCollect(parameters, 'INVALID_FIELD_ASSIGNMENT',
                    () => ResourceValidator.reportInvalidFieldAssignment(parameters.rootResourceIdentifier, relationshipDeclaration.getName(), obj, relationshipDeclaration));
            }

            for(let n=0; n < obj.length; n++) {
                const item = obj[n];
                try {
                    withPath(parameters, n, () => {
                        this.checkRelationship(parameters, relationshipDeclaration, item);
                    });
                } catch (err) {
                    if (err instanceof CollectedDiagnosticException) {
                        continue;
                    }
                    throw err;
                }
            }
        }
        else {
            this.checkRelationship(parameters, relationshipDeclaration, obj);
        }
        return null;
    }

    /**
     * Check a single relationship
     * @param {Object} parameters  - the parameter
     * @param {relationshipDeclaration} relationshipDeclaration - the object being visited
     * @param {Object} obj - the object being validated
     * @private
     */
    checkRelationship(parameters, relationshipDeclaration, obj) {
        if(obj instanceof Relationship) {
            // All good..
        } else if (obj instanceof Resource && (this.options.convertResourcesToRelationships || this.options.permitResourcesForRelationships)) {
            // All good.. Again
        } else {
            ResourceValidator.reportOrCollect(parameters, 'NOT_RELATIONSHIP',
                () => ResourceValidator.reportNotRelationshipViolation(parameters.rootResourceIdentifier, relationshipDeclaration, obj));
        }

        const relationshipType = parameters.modelManager.getType(obj.getFullyQualifiedType());

        if(!relationshipType.getIdentifierFieldName()) {
            ResourceValidator.reportOrCollect(parameters, 'INVALID_RELATIONSHIP',
                () => { throw new ValidationException('Cannot have a relationship to a field that is not identifiable.'); });
        }

        if(!ModelUtil.isAssignableTo(relationshipType.getModelFile(), obj.getFullyQualifiedType(), relationshipDeclaration)) {
            ResourceValidator.reportOrCollect(parameters, 'INVALID_FIELD_ASSIGNMENT',
                () => ResourceValidator.reportInvalidFieldAssignment(parameters.rootResourceIdentifier, relationshipDeclaration.getName(), obj, relationshipDeclaration));
        }
    }

    /**
     * Throw a new error for a model violation.
     * @param {string} id - the identifier of this instance.
     * @param {string} propName - the name of the field.
     * @param {*} value - the value of the field.
     * @param {Field} field - the field
     * @throws {ValidationException} the exception
     * @private
     */
    static reportFieldTypeViolation(id, propName, value, field) {
        let isArray = field.isArray() ? '[]' : '';
        let typeOfValue = typeof value;

        if(value instanceof Identifiable) {
            typeOfValue = value.getFullyQualifiedType();
            value = value.getFullyQualifiedIdentifier();
        }
        else {
            if(value) {
                try {
                    if (typeof value === 'number' && !isFinite(value)) {
                        value = value.toString();
                    } else {
                        value = JSON.stringify(value);
                    }
                }
                catch(err) {
                    value = value.toString();
                }
            }
        }

        let formatter = Globalize.messageFormatter('resourcevalidator-fieldtypeviolation');
        throw new ValidationException(formatter({
            resourceId: id,
            propertyName: propName,
            fieldType: field.getType() + isArray,
            value: value,
            typeOfValue: typeOfValue
        }));
    }

    /**
     * Throw a new error for a model violation.
     * @param {string} id - the identifier of this instance.
     * @param {ClassDeclaration} classDeclaration - the declaration of the class
     * @param {Object} value - the value of the field.
     * @private
     */
    static reportNotResouceViolation(id, classDeclaration, value) {
        let formatter = Globalize.messageFormatter('resourcevalidator-notresourceorconcept');
        throw new ValidationException(formatter({
            resourceId: id,
            classFQN: classDeclaration.getFullyQualifiedName(),
            invalidValue: value.toString()
        }));
    }

    /**
     * Throw a new error for a model violation.
     * @param {string} id - the identifier of this instance.
     * @param {RelationshipDeclaration} relationshipDeclaration - the declaration of the class
     * @param {Object} value - the value of the field.
     * @private
     */
    static reportNotRelationshipViolation(id, relationshipDeclaration, value) {
        let formatter = Globalize.messageFormatter('resourcevalidator-notrelationship');
        throw new ValidationException(formatter({
            resourceId: id,
            classFQN: relationshipDeclaration.getFullyQualifiedTypeName(),
            invalidValue: value.toString()
        }));
    }

    /**
     * Throw a new error for a missing, but required field.
     * @param {string} id - the identifier of this instance.
     * @param {Field} field - the field/
     * @private
     */
    static reportMissingRequiredProperty(id, field) {
        let formatter = Globalize.messageFormatter('resourcevalidator-missingrequiredproperty');
        throw new ValidationException(formatter({
            resourceId: id,
            fieldName: field.getName()
        }));
    }

    /**
     * Throw a new error for a missing, but required field.
     * @param {string} id - the identifier of this instance.
     * @param {Field} field - the field/
     * @private
     */
    static reportEmptyIdentifier(id) {
        let formatter = Globalize.messageFormatter('resourcevalidator-emptyidentifier');
        throw new ValidationException(formatter({
            resourceId: id
        }));
    }

    /**
     * Throw a new error for a missing, but required field.
     * @param {string} id - the identifier of this instance.
     * @param {Field} field - the field
     * @param {string} obj - the object value
     * @private
     */
    static reportInvalidEnumValue(id, field, obj) {
        let formatter = Globalize.messageFormatter('resourcevalidator-invalidenumvalue');
        throw new ValidationException(formatter({
            resourceId: id,
            value: obj,
            fieldName: field.getName()
        }));
    }

    /**
     * Throw a validation exception for an abstract class
     * @param {ClassDeclaration} classDeclaration - the class declaration
     * @throws {ValidationException} the validation exception
     * @private
     */
    static reportAbstractClass(classDeclaration) {
        let formatter = Globalize.messageFormatter('resourcevalidator-abstractclass');
        throw new ValidationException(formatter({
            className: classDeclaration.getFullyQualifiedName(),
        }));
    }

    /**
     * Throw a validation exception for an abstract class
     * @param {string} resourceId - the id of the resource being validated
     * @param {string} propertyName - the name of the property that is not declared
     * @param {string} fullyQualifiedTypeName - the fully qualified type being validated
     * @throws {ValidationException} the validation exception
     * @private
     */
    static reportUndeclaredField(resourceId, propertyName, fullyQualifiedTypeName ) {
        let formatter = Globalize.messageFormatter('resourcevalidator-undeclaredfield');
        throw new ValidationException(formatter({
            resourceId: resourceId,
            propertyName: propertyName,
            fullyQualifiedTypeName: fullyQualifiedTypeName
        }));
    }

    /**
     * Throw a validation exception for an invalid field assignment
     * @param {string} resourceId - the id of the resource being validated
     * @param {string} propName - the name of the property that is being assigned
     * @param {*} obj - the Field
     * @param {Field} field - the Field
     * @throws {ValidationException} the validation exception
     * @private
     */
    static reportInvalidFieldAssignment(resourceId, propName, obj, field) {
        let formatter = Globalize.messageFormatter('resourcevalidator-invalidfieldassignment');
        let typeName = field.getFullyQualifiedTypeName();

        if(field.isArray()) {
            typeName += '[]';
        }

        throw new ValidationException(formatter({
            resourceId: resourceId,
            propertyName: propName,
            objectType: obj.getFullyQualifiedType(),
            fieldType: typeName
        }));
    }
}

export = ResourceValidator;
