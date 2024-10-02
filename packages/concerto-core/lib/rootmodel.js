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

/** @type unknown */
const rootModelAst = require('./rootmodel.json');

/**
 * Gets the root 'concerto' model
 * @param {boolean} versioned if true the concerto namespace is versioned
 * @returns {object} rootModelFile, rootModelCto and rootModelAst
 */
function getRootModel(versioned) {
    const rootModelFile = versioned ? 'concerto_1.0.0.cto' : 'concerto.cto';
    const ns = versioned ? 'concerto@1.0.0' : 'concerto';
    const rootModelCto = `@DotNetNamespace("AccordProject.Concerto")
    namespace ${ns}
    abstract concept Concept {}
    abstract concept Asset identified {}
    abstract concept Participant identified {}
    abstract concept Transaction {}
    abstract concept Event {}
    abstract concept Decorator {}
    concept DotNetNamespace extends Decorator {
       o String namespace
    }`;
    const ast = JSON.parse(JSON.stringify(rootModelAst));
    ast.namespace = ns;
    return { rootModelFile, rootModelCto, rootModelAst: ast };
}

module.exports = { getRootModel };
