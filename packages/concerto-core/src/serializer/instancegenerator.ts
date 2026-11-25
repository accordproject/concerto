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

import { NullUtil as Util } from '@accordproject/concerto-util';
import Globalize from '../globalize';
import ModelUtil from '../modelutil';

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
            const name = thing?.getFullyQualifiedName?.() || thing?.getName?.() || String(thing);
            throw new Error('Unrecognised ' + name);
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
                if (classDeclaration.isMapDeclaration?.()) {
                    return new Map();
                }
                throw new Error('Model is recursive.');
            }
            parameters.seen.push(fqn);
        } else { parameters.seen.push('Primitive');
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
            return this.getPrimitiveValue(type, fieldOrScalarDeclaration.validator, parameters);
        }

        let declaration = parameters.modelManager.getType(type);

        if (declaration.isEnum()) {
            let enumValues = declaration.getOwnProperties();
            return parameters.valueGenerator.getEnum(enumValues).getName();
        }

        declaration = this.findConcreteSubclass(declaration);

        if (declaration.isMapDeclaration?.()) {
            return declaration.accept(this, parameters);
        }
        return this.generateResource(declaration, parameters);
    }

    /**
     * Get a value for a primitive type.
     * @param {String} type - the primitive type name
     * @param {Validator} validator - the validator that constrains the value, if any
     * @param {Object} parameters  - the parameter
     * @return {*} A value of the primitive type.
     * @private
     */
    getPrimitiveValue(type, validator, parameters) {
        switch(type) {
        case 'DateTime':
            return parameters.valueGenerator.getDateTime();
        case 'Integer':
            if(validator){
                return parameters.valueGenerator.getRange(validator.lowerBound, validator.upperBound, type);
            }
            return parameters.valueGenerator.getInteger();
        case 'Long':
            if(validator){
                return parameters.valueGenerator.getRange(validator.lowerBound, validator.upperBound, type);
            }
            return parameters.valueGenerator.getLong();
        case 'Double':
            if(validator){
                return parameters.valueGenerator.getRange(validator.lowerBound, validator.upperBound, type);
            }
            return parameters.valueGenerator.getDouble();
        case 'Boolean':
            return parameters.valueGenerator.getBoolean();
        default:
            if(validator?.regex){
                return parameters.valueGenerator.getRegex(validator.regex,
                    validator.minLength,
                    validator.maxLength);
            }
            return parameters.valueGenerator.getString(validator?.minLength,
                validator?.maxLength);
        }
    }

    /**
     * Create and populate an instance of a concrete class declaration.
     * @param {ClassDeclaration} classDeclaration - the type to instantiate
     * @param {Object} parameters  - the parameter
     * @return {Resource} the generated instance.
     * @private
     */
    generateResource(classDeclaration, parameters) {
        let id: string | null = null;
        if (classDeclaration.isIdentified()) {
            let idFieldName = classDeclaration.getIdentifierFieldName();
            let idField = classDeclaration.getProperty(idFieldName);
            if (idField?.isTypeScalar?.()){
                idField = idField.getScalarField();
            }
            if(idField?.validator?.regex){
                id = parameters.valueGenerator.getRegex(idField.validator.regex,
                    idField.validator.minLength, idField.validator.maxLength);
            } else {
                id = this.generateRandomId(classDeclaration);
            }
        }
        let resource = parameters.factory.newResource(classDeclaration.getNamespace(), classDeclaration.getName(), id);
        parameters.stack.push(resource);
        return classDeclaration.accept(this, parameters);
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
        // a map value type can also be a relationship, and is never an array
        if (relationshipDeclaration.isArray?.()) {
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
        return parameters.valueGenerator.getMap(() => {
            const value = this.getMapItem(mapDeclaration.getValue(), parameters);
            // null means the value would recurse, so the map is left empty
            if (value === null) {
                return null;
            }
            const key = this.getMapItem(mapDeclaration.getKey(), parameters);
            return [key, value];
        });
    }

    /**
     * Get a key or a value for a map entry.
     * @param {MapKeyType|MapValueType} mapType - the declared key or value type
     * @param {Object} parameters  - the parameter
     * @return {*} the generated item, or null if generating it would recurse.
     * @private
     */
    getMapItem(mapType, parameters) {
        if (mapType.isRelationship?.()) {
            return this.visitRelationshipDeclaration(mapType, parameters);
        }

        let type = mapType.getType();
        let validator = null;

        if (!ModelUtil.isPrimitiveType(type)) {
            const declaration = parameters.modelManager.getType(mapType.getFullyQualifiedTypeName());

            if (declaration.isScalarDeclaration?.()) {
                type = declaration.getType();
                validator = declaration.getValidator();
            } else if (declaration.isEnum()) {
                return parameters.valueGenerator.getEnum(declaration.getOwnProperties()).getName();
            } else {
                const concrete = this.findConcreteSubclass(declaration);
                const fqn = concrete.getFullyQualifiedName();
                if (parameters.seen.includes(fqn)) {
                    return null;
                }
                parameters.seen.push(fqn);
                const resource = this.generateResource(concrete, parameters);
                parameters.seen.pop();
                return resource;
            }
        }

        const value = this.getPrimitiveValue(type, validator, parameters);
        // a DateTime in a map is held as an ISO 8601 string, unlike a DateTime field
        return type === 'DateTime' ? value.toISOString() : value;
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

export { InstanceGenerator };
export default InstanceGenerator;
