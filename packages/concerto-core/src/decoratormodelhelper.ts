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

const decoratorModelAst = require('./decoratormodel.json');

/**
 * Gets the decorator 'concerto.decorator' model
 * @returns {object} decoratorModelFile, decoratorModelCto and decoratorModelAst
 */
function getDecoratorModel() {
    const decoratorModelFile = 'concerto_decorator_1.0.0.cto';
    const ns = 'concerto.decorator@1.0.0'; // Define namespace variable
    const decoratorModelCto = `namespace ${ns}
    abstract concept Decorator {}
    concept DotNetNamespace extends Decorator {
       o String namespace
    }`;
    const ast = JSON.parse(JSON.stringify(decoratorModelAst));
    ast.namespace = ns; // <--- FIX: Explicitly set the namespace
    return { decoratorModelFile, decoratorModelCto, decoratorModelAst: ast };
}

module.exports = { getDecoratorModel };
