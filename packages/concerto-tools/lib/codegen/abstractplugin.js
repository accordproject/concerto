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

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
/* istanbul ignore next */
if (global === undefined) {
    const { ClassDeclaration, EnumDeclaration } = require('@accordproject/concerto-core');
}
/* eslint-enable no-unused-vars */

/**
 * Simple plug-in class for code-generation. This lists functions that can be passed to extend the default code-generation behavior.
 */
class AbstractPlugin {
    /**
     * Additional imports to generate in classes
     * @param {ClassDeclaration} clazz - the clazz being visited
     * @param {Object} parameters  - the parameter
     * @param {Object} options  - the visitor options
     */
    addClassImports(clazz, parameters, options) {
        throw new Error('addClassImport not implemented in default plugin');
    }

    /**
     * Additional annotations to generate in classes
     * @param {ClassDeclaration} clazz - the clazz being visited
     * @param {Object} parameters  - the parameter
     * @param {Object} options  - the visitor options
     */
    addClassAnnotations(clazz, parameters, options) {
        throw new Error('addClassAnnotations not implemented in default plugin');
    }

    /**
     * Additional methods to generate in classes
     * @param {ClassDeclaration} clazz - the clazz being visited
     * @param {Object} parameters  - the parameter
     * @param {Object} options  - the visitor options
     */
    addClassMethods(clazz, parameters, options) {
        throw new Error('addClassMethods not implemented in default plugin');
    }

    /**
     * Additional annotations to generate in enums
     * @param {EnumDeclaration} enumDecl - the enum being visited
     * @param {Object} parameters  - the parameter
     * @param {Object} options  - the visitor options
     */
    addEnumAnnotations(enumDecl, parameters, options) {
        throw new Error('addEnumAnnotations not implemented in default plugin');
    }

}

module.exports = AbstractPlugin;
