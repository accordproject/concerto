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

const { TypedStack } = require('@accordproject/concerto-util');
const Resource = require('./resource');

/**
 * CustomResource is a Resource that is designed to be extended by
 * generated client classes.
 * @abstract
 */
class CustomResource extends Resource {
    /**
     * Constructor.
     * @param {unknown} opaque Opaque data
     */
    constructor(opaque) {
        // These properties are internals and should not be exposed to the caller.
        const { modelManager, classDeclaration, ns, type, id, timestamp, resourceValidator } = opaque;
        super(modelManager, classDeclaration, ns, type, id, timestamp);
        this.$validator = resourceValidator;
    }

    /**
     * Sets a property. If validation is enabled, then the property value is first validated
     * to ensure that it does not violate the model.
     * @param {string} propName - the name of the field
     * @param {string} value - the value of the property
     * @throws {Error} if the value is not compatible with the model definition for the field
     */
    setPropertyValue(propName, value) {
        // Shortcut if validation not enabled.
        if (!this.$validator) {
            super.setPropertyValue(propName,value);
            return;
        }

        let classDeclaration = this.getClassDeclaration();
        let field = classDeclaration.getProperty(propName);

        if (!field) {
            throw new Error('The instance with id ' +
                this.getIdentifier() + ' trying to set field ' +
                propName + ' which is not declared in the model.');
        }

        const parameters = {};
        parameters.stack = new TypedStack(value);
        parameters.modelManager = this.getModelManager();
        parameters.rootResourceIdentifier = this.getFullyQualifiedIdentifier();
        field.accept(this.$validator, parameters);
        super.setPropertyValue(propName,value);
    }

    /**
     * Adds an array property value. If validation is enabled, then the property value is
     * first validated to ensure that it does not violate the model.
     * @param {string} propName - the name of the field
     * @param {string} value - the value of the property
     * @throws {Error} if the value is not compatible with the model definition for the field
     */
    addArrayValue(propName, value) {
        // Shortcut if validation not enabled.
        if (!this.$validator) {
            super.addArrayValue(propName,value);
            return;
        }

        let classDeclaration = this.getClassDeclaration();
        let field = classDeclaration.getProperty(propName);

        if (!field) {
            throw new Error('The instance with id ' +
                this.getIdentifier() + ' trying to set field ' +
                propName + ' which is not declared in the model.');
        }

        if (!field.isArray()) {
            throw new Error('The instance with id ' +
                this.getIdentifier() + ' trying to add array item ' +
                propName + ' which is not declared as an array in the model.');
        }

        const parameters = {};
        let newArray = [];
        if(this[propName]) {
            newArray = this[propName].slice(0);
        }
        newArray.push(value);
        parameters.stack = new TypedStack(newArray);
        parameters.modelManager = this.getModelManager();
        parameters.rootResourceIdentifier = this.getFullyQualifiedIdentifier();
        field.accept(this.$validator, parameters);
        super.addArrayValue(propName, value);
    }

    /**
     * Validates the instance against its model. If validation is not enabled, then an error
     * will be thrown.
     *
     * @throws {Error} - if the instance if invalid with respect to the model
     */
    validate() {
        // Throw error if validation not enabled.
        if (!this.$validator) {
            throw new Error('validation is not enabled');
        }

        const classDeclaration = this.getClassDeclaration();
        const parameters = {};
        parameters.stack = new TypedStack(this);
        parameters.modelManager = this.getModelManager();
        parameters.rootResourceIdentifier = this.getFullyQualifiedIdentifier();
        classDeclaration.accept(this.$validator, parameters);
    }
}

module.exports = CustomResource;
