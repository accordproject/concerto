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

const TypedStack = require('./serializer/typedstack');
const getTypeDeclaration = require('./concerto').getTypeDeclaration;
const ObjectValidator = require('./serializer/objectvalidator');

/**
 * Validates the instance against its model.
 * @param {*} obj the input object
 * @param {*} modelManager the model manager
 * @param {*} [options] the validation options
 * @throws {Error} - if the instance if invalid with respect to the model
 */
function validate(obj, modelManager, options) {
    const classDeclaration = getTypeDeclaration(obj, modelManager);
    const parameters = {};
    parameters.stack = new TypedStack(obj);
    parameters.modelManager = modelManager;
    const objectValidator = new ObjectValidator(options);
    classDeclaration.accept(objectValidator, parameters);
}

module.exports.validate = validate;