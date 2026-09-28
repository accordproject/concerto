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

import { TypedStack } from '@accordproject/concerto-util';
import Resource from './resource';

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type ResourceValidator from '../serializer/resourcevalidator';
/* eslint-enable no-unused-vars */

// P5-12c (accordproject/concerto-rust#293): `validate`, `setPropertyValue`
// and `addArrayValue` validate in one Rust engine call each
// (src/engine/validate-resource.ts). The `ResourceValidator` visitor below
// runs only when the engine cannot take the value
// (`EngineFastPathUnsupported`), or, in `setPropertyValue`, for a string,
// number or boolean on a plain primitive field with no validator, where the
// visitor is the cheaper path (validate-resource.ts, `visitorIsCheaper`). See serializer.ts's identical preamble for
// why `loadEngine` takes a non-literal specifier.
import { createRequire } from 'module';
declare const __webpack_require__: unknown;
declare const __non_webpack_require__: NodeRequire;
// Memoised per specifier (P5-06), as in serializer.ts.
/* istanbul ignore next */
const engineModules: { [specifier: string]: any } = {};
/* istanbul ignore next */
const loadEngine = (specifier: string) =>
    engineModules[specifier] ??
    (engineModules[specifier] =
        typeof __webpack_require__ === 'function' ? __non_webpack_require__(specifier) : typeof module !== 'undefined' && typeof module.require === 'function' ? module.require(specifier) : typeof (globalThis as any).module?.require === 'function' ? (globalThis as any).module.require(specifier) : createRequire(__filename)(specifier));

/**
 * ValidatedResource is a Resource that can validate that property
 * changes (or the whole instance) do not violate the structure of
 * the type information associated with the instance.
 * @extends Resource
 * @see See {@link Resource}
 * @class
 * @memberof module:concerto-core
 */
class ValidatedResource extends Resource {
    $validator: ResourceValidator;
    /**
     * This constructor should not be called directly.
     * Use the Factory class to create instances.
     *
     * <p>
     * <strong>Note: Only to be called by framework code. Applications should
     * retrieve instances from {@link Factory}</strong>
     * </p>
     * @param {ModelManager} modelManager - The ModelManager for this instance
     * @param {ClassDeclaration} classDeclaration - The class declaration for this instance.
     * @param {string} ns - The namespace this instance.
     * @param {string} type - The type this instance.
     * @param {string} id - The identifier of this instance.
     * @param {string} timestamp - The timestamp of this instance
     * @param {ResourceValidator} resourceValidator - The validator to use for this instance
     * @private
     */
    constructor(modelManager, classDeclaration, ns, type, id, timestamp, resourceValidator) {
        super(modelManager, classDeclaration, ns, type, id, timestamp);
        this.$validator = resourceValidator;
    }

    /**
     * Sets a property, validating that it does not violate the model
     * @param {string} propName - the name of the field
     * @param {string} value - the value of the property
     * @throws {Error} if the value is not compatible with the model definition for the field
     */
    setPropertyValue(propName, value) {
        let classDeclaration = this.getClassDeclaration();
        let field = classDeclaration.getProperty(propName);

        if (!field) {
            throw new Error('The instance with id ' +
                this.getIdentifier() + ' trying to set field ' +
                propName + ' which is not declared in the model.');
        }
        // else {
        //     this.log( 'Validating field ' + field + ' with data ' + value );
        // }

        const rootResourceIdentifier = this.getFullyQualifiedIdentifier();
        if (!loadEngine('../engine/validate-resource').validateProperty(this, propName, value, rootResourceIdentifier, field)) {
            const parameters:any = {};
            parameters.stack = new TypedStack(value);
            parameters.modelManager = this.getModelManager();
            parameters.rootResourceIdentifier = rootResourceIdentifier;
            field.accept(this.$validator, parameters);
        }
        super.setPropertyValue(propName,value);
    }

    /**
     * Adds an array property value, validating that it does not violate the model
     * @param {string} propName - the name of the field
     * @param {string} value - the value of the property
     * @throws {Error} if the value is not compatible with the model definition for the field
     */
    addArrayValue(propName, value) {
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

        let newArray: unknown[] = [];
        if(this[propName]) {
            newArray = this[propName].slice(0);
        }
        newArray.push(value);
        const rootResourceIdentifier = this.getFullyQualifiedIdentifier();
        if (!loadEngine('../engine/validate-resource').validateProperty(this, propName, newArray, rootResourceIdentifier)) {
            const parameters = {
                stack: new TypedStack(newArray),
                modelManager: this.getModelManager(),
                rootResourceIdentifier,
            };
            field.accept(this.$validator, parameters);
        }
        super.addArrayValue(propName, value);
    }

    /**
     * Validates the instance against its model.
     *
     * @throws {Error} - if the instance if invalid with respect to the model
     */
    validate() {
        const classDeclaration = this.getClassDeclaration();
        const rootResourceIdentifier = this.getFullyQualifiedIdentifier();
        if (loadEngine('../engine/validate-resource').validateResource(this, rootResourceIdentifier)) {
            return;
        }
        const parameters:any = {};
        parameters.stack = new TypedStack(this);
        parameters.modelManager = this.getModelManager();
        parameters.rootResourceIdentifier = rootResourceIdentifier;
        classDeclaration.accept(this.$validator, parameters);
    }
}

export { ValidatedResource };
export default ValidatedResource;
