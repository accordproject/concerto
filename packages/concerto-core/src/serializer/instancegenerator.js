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

const Util = require('@accordproject/concerto-util').NullUtil;
const Globalize = require('../globalize');

/**
 * Generate sample instance data for the specified class declaration
 * and resource instance. The specified resource instance will be
 * updated with either default values or generated sample data.
 * @private
 * @class
 * @memberof module:concerto-core
 */
class InstanceGenerator {

    /**
     * Visitor design pattern
     * @param {Object} thing - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visit(thing, parameters) {
        if (thing.isClassDeclaration?.()) {
            return this.visitClassDeclaration(thing, parameters);
        } else if (thing.isMapDeclaration?.()) {
            return this.visitMapDeclaration(thing, parameters);
        } else if (thing.isRelationship?.()) {
            return this.visitRelationshipDeclaration(thing, parameters);
        } else if (thing.isTypeScalar?.()) {
            return this.visitField(thing.getScalarField(), parameters);
        } else if (thing.isField?.()) {
            return this.visitField(thing, parameters);
        } else {
            throw new Error('Unrecognised ' + JSON.stringify(thing) );
        }
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
        const properties = classDeclaration.getProperties();
        for (const property of properties) {
            if (!parameters.includeOptionalFields && property.isOptional()) {
                continue;
            }
            const value = obj[property.getName()];
            if(Util.isNull(value)) {
                obj[property.getName()] = property.accept(this,parameters);
            }
        }
        return obj;
    }

    /**
     * Visitor design pattern
     * @param {Field} field - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitField(field, parameters) {
        if(!field.isPrimitive()){
            let type = field.getFullyQualifiedTypeName();
            let classDeclaration = parameters.modelManager.getType(type);
            classDeclaration = this.findConcreteSubclass(classDeclaration);
            let fqn = classDeclaration.getFullyQualifiedName();

            if (parameters.seen.includes(fqn)){
                if (field.isArray()) {
                    return [];
                }
                if (field.isOptional()) {
                    return null;
                }
                throw new Error('Model is recursive.');
            }
            parameters.seen.push(fqn);
        } else { parameters.seen.push('Primitve');
        }
        let result;
        if (field.isArray()) {
            const valueSupplier = () => this.getFieldValue(field, parameters);
            result =  parameters.valueGenerator.getArray(valueSupplier);
        } else {
            result = this.getFieldValue(field, parameters);
        }
        parameters.seen.pop();
        return result;
    }


    /**
     * Get a value for the specified field.
     * @param {Field} field - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {*} A value for the specified field.
     */
    getFieldValue(field, parameters) {
        let fieldOrScalarDeclaration = field;
        if (field.isTypeScalar?.()){
            fieldOrScalarDeclaration = field.getScalarField();
        }
        let type = field.getFullyQualifiedTypeName();
        if (field.isPrimitive()) {
            switch(type) {
            case 'DateTime':
                return parameters.valueGenerator.getDateTime();
            case 'Integer':
                if(fieldOrScalarDeclaration.validator){
                    return parameters.valueGenerator.getRange(fieldOrScalarDeclaration.validator.lowerBound, fieldOrScalarDeclaration.validator.upperBound, type);
                }
                return parameters.valueGenerator.getInteger();
            case 'Long':
                if(fieldOrScalarDeclaration.validator){
                    return parameters.valueGenerator.getRange(fieldOrScalarDeclaration.validator.lowerBound, fieldOrScalarDeclaration.validator.upperBound, type);
                }
                return parameters.valueGenerator.getLong();
            case 'Double':
                if(fieldOrScalarDeclaration.validator){
                    return parameters.valueGenerator.getRange(fieldOrScalarDeclaration.validator.lowerBound, fieldOrScalarDeclaration.validator.upperBound, type);
                }
                return parameters.valueGenerator.getDouble();
            case 'Boolean':
                return parameters.valueGenerator.getBoolean();
            default:
                if(fieldOrScalarDeclaration.validator?.regex){
                    return parameters.valueGenerator.getRegex(fieldOrScalarDeclaration.validator.regex,
                        fieldOrScalarDeclaration.validator.minLength,
                        fieldOrScalarDeclaration.validator.maxLength);
                }
                return parameters.valueGenerator.getString(fieldOrScalarDeclaration.validator?.minLength,
                    fieldOrScalarDeclaration.validator?.maxLength);
            }
        }

        let declaration = parameters.modelManager.getType(type);

        if (declaration.isEnum()) {
            let enumValues = declaration.getOwnProperties();
            return parameters.valueGenerator.getEnum(enumValues).getName();
        }

        declaration = this.findConcreteSubclass(declaration);

        if (!declaration.isMapDeclaration?.()) {
            let id = null;
            if (declaration.isIdentified()) {
                let idFieldName = declaration.getIdentifierFieldName();
                let idField = declaration.getProperty(idFieldName);
                if (idField?.isTypeScalar?.()){
                    idField = idField.getScalarField();
                }
                if(idField?.validator?.regex){
                    id = parameters.valueGenerator.getRegex(fieldOrScalarDeclaration.validator.regex);
                } else {
                    id = this.generateRandomId(declaration);
                }
            }
            let resource = parameters.factory.newResource(declaration.getNamespace(), declaration.getName(), id);
            parameters.stack.push(resource);
        }
        return declaration.accept(this, parameters);
    }

    /**
     * Find a concrete type that extends the provided type. If the supplied type argument is
     * not abstract then it will be returned.
     * TODO: work out whether this has to be a leaf node or whether the closest type can be used
     * It depends really since the closest type will satisfy the model but whether it satisfies
     * any transaction code which attempts to use the generated resource is another matter.
     * @param {ClassDeclaration} declaration the class declaration.
     * @return {ClassDeclaration} the closest extending concrete class definition.
     * @throws {Error} if no concrete subclasses exist.
     */
    findConcreteSubclass(declaration) {
        if (declaration.isMapDeclaration?.() || !declaration.isAbstract()) {
            return declaration;
        }

        const concreteSubclasses = declaration.getAssignableClassDeclarations()
            .filter(subclass => !subclass.isAbstract());

        if (concreteSubclasses.length === 0) {
            const formatter = Globalize.messageFormatter('instancegenerator-newinstance-noconcreteclass');
            throw new Error(formatter({ type: declaration.getFullyQualifiedName() }));
        }

        return concreteSubclasses[0];
    }



    /**
     * Visitor design pattern
     * @param {RelationshipDeclaration} relationshipDeclaration - the object being visited
     * @param {Object} parameters - the parameter
     * @return {Relationship} the result of visiting
     * @private
     */
    visitRelationshipDeclaration(relationshipDeclaration, parameters) {
        let classDeclaration = parameters.modelManager.getType(relationshipDeclaration.getFullyQualifiedTypeName());
        classDeclaration = this.findConcreteSubclass(classDeclaration);
        const factory = parameters.factory;
        const valueSupplier = () => {
            const id = this.generateRandomId(classDeclaration);
            return factory.newRelationship(classDeclaration.getNamespace(), classDeclaration.getName(), id);
        };
        if (relationshipDeclaration.isArray()) {
            return parameters.valueGenerator.getArray(valueSupplier);
        } else {
            return valueSupplier();
        }
    }

    /**
     * Visitor design pattern
     * @param {MapDeclaration} mapDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitMapDeclaration(mapDeclaration, parameters) {
        return parameters.valueGenerator.getMap();
    }

    /**
     * Generate a random ID for a given type.
     * @private
     * @param {ClassDeclaration} classDeclaration - class declaration for a type.
     * @return {String} an ID.
     */
    generateRandomId(classDeclaration) {
        let id = Math.round(Math.random() * 9999).toString();
        id = id.padStart(4, '0');
        return id;
    }

}

module.exports = InstanceGenerator;
