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

const ClassDeclaration = require('@accordproject/concerto-core').ClassDeclaration;
const EnumDeclaration = require('@accordproject/concerto-core').EnumDeclaration;
const Field = require('@accordproject/concerto-core').Field;
const RelationshipDeclaration = require('@accordproject/concerto-core').RelationshipDeclaration;
const debug = require('debug')('concerto-core:recursiondetectionvisitor');
const util = require('util');

/**
 * Detects whether ClassDeclaration contains recursive references.
 * Basic example:
 * concept Person {
 *   o Person[] children
 * }
 *
 * parameters.stack should be initialized to []
 * @private
 * @class
 * @memberof module:concerto-tools
 */
class RecursionDetectionVisitor {

    /**
     * Visitor design pattern
     * @param {Object} thing - the object being visited
     * @param {Object} parameters - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visit(thing, parameters) {
        // the order of these matters!
        if (thing.isEnum?.()) {
            return this.visitEnumDeclaration(thing, parameters);
        }
        else if (thing.isClassDeclaration?.()) {
            return this.visitClassDeclaration(thing, parameters);
        } else if (thing.isField?.()) {
            return this.visitField(thing, parameters);
        } else if (thing.isRelationship?.()) {
            return this.visitRelationshipDeclaration(thing, parameters);
        } else {
            throw new Error('Unrecognised type: ' + typeof thing + ', value: ' + util.inspect(thing, { showHidden: true, depth: null }));
        }
    }

    /**
     * Visitor design pattern
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitClassDeclaration(classDeclaration, parameters) {
        debug('entering visitClassDeclaration', classDeclaration.getName());

        parameters.stack.push(classDeclaration.getFullyQualifiedName());

        // Walk over all of the properties of this class and its super classes.
        const properties = classDeclaration.getProperties();
        for(let n=0; n < properties.length; n++) {
            const property = properties[n];
            if( property.accept(this, parameters) ) {
                return true;
            }
        }

        parameters.stack.pop();
        return false;
    }

    /**
     * Visitor design pattern
     * @param {Field} field - the object being visited
     * @param {Object} parameters - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitField(field, parameters) {
        debug('entering visitField', field.getName());
        if(field.isPrimitive()) {
            return false;
        }

        let type = field.getParent().getModelFile().
            getModelManager().getType(field.getFullyQualifiedTypeName());

        debug('stack', parameters.stack );
        if( parameters.stack.includes(type.getFullyQualifiedName()) ) {
            return true;
        }
        else {
            return this.visit(type, parameters);
        }
    }

    /**
     * Visitor design pattern
     * @param {EnumDeclaration} enumDeclaration - the object being visited
     * @param {Object} parameters - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitEnumDeclaration(enumDeclaration, parameters) {
        debug('entering visitEnumDeclaration', enumDeclaration.getName());
        return false;
    }

    /**
     * Visitor design pattern
     * @param {RelationshipDeclaration} relationshipDeclaration - the object being visited
     * @param {Object} parameters - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitRelationshipDeclaration(relationshipDeclaration, parameters) {
        debug('entering visitRelationship', relationshipDeclaration.getName());
        return false;
    }
}

module.exports = RecursionDetectionVisitor;
