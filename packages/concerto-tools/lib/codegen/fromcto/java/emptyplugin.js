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

const AbstractPlugin = require('../../abstractplugin');

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
/* istanbul ignore next */
if (global === undefined) {
    const { ClassDeclaration, EnumDeclaration } = require('@accordproject/concerto-core');
}

/**
 * Simple plug-in class for code-generation. This lists functions that can be passed to extend the default code-generation behavior.
 */
class EmptyPlugin extends AbstractPlugin {
    /**
     * Additional imports to generate in classes
     * @param {ClassDeclaration} clazz - the clazz being visited
     * @param {Object} parameters  - the parameter
     */
    addClassImports(clazz, parameters) {
    }

    /**
     * Additional annotations to generate in classes
     * @param {ClassDeclaration} clazz - the clazz being visited
     * @param {Object} parameters  - the parameter
     */
    addClassAnnotations(clazz, parameters) {
    }

    /**
     * Additional methods to generate in classes
     * @param {ClassDeclaration} clazz - the clazz being visited
     * @param {Object} parameters  - the parameter
     */
    addClassMethods(clazz, parameters) {
    }

    /**
     * Additional annotations to generate in enums
     * @param {EnumDeclaration} enumDecl - the enum being visited
     * @param {Object} parameters  - the parameter
     */
    addEnumAnnotations(enumDecl, parameters) {
    }

}

module.exports = EmptyPlugin;
