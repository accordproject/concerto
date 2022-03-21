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

const ModelManager = require('./modelmanager');

/**
 * Utility functions to work with
 * [DecoratorCommandSet](https://models.accordproject.org/concerto/decorators.cto)
 * @memberof module:concerto-core
 */
class DecoratorManager {
    /**
     * Applies all the decorator commands from the DecoratorCommandSet
     * to the ModelManager.
     * @param {ModelManager} modelManager the input model manager
     * @param {*} decoratorCommandSet the DecoratorCommandSet object
     * @returns {ModelManager} a new model manager with the decorations applied
     */
    static decorateModels(modelManager, decoratorCommandSet) {
        const ast = modelManager.getAst(true);
        const decoratedAst = JSON.parse(JSON.stringify(ast));
        decoratedAst.models.forEach(model => {
            model.declarations.forEach(decl => {
                decoratorCommandSet.commands.forEach(command => {
                    this.executeCommand(model.namespace, decl, command);
                });
            });
        });
        const newModelManager = new ModelManager();
        newModelManager.fromAst(decoratedAst);
        return newModelManager;
    }

    /**
     * Compares two values
     * @param {string | null} test the value to test (lhs)
     * @param {string} value the value to compare (rhs)
     * @returns {Boolean} true if the lhs is falsy or test === value
     */
    static isMatch(test, value) {
        return test ? test === value : true;
    }

    /**
     * Applies a decorator to a decorated model element.
     * @param {*} decorated the type to apply the decorator to
     * @param {string} type the command type
     * @param {*} newDecorator the decorator to add
     */
    static applyDecorator(decorated, type, newDecorator) {
        if (type === 'UPSERT') {
            let updated = false;
            if(decorated.decorators) {
                for (let n = 0; n < decorated.decorators.length; n++) {
                    let decorator = decorated.decorators[n];
                    if (decorator.name === newDecorator.name) {
                        decorated.decorators[n] = newDecorator;
                        updated = true;
                    }
                }
            }

            if (!updated) {
                decorated.decorators ? decorated.decorators.push(newDecorator)
                    : decorated.decorators = [newDecorator];
            }
        }
        else if (type === 'APPEND') {
            decorated.decorators ? decorated.decorators.push(newDecorator)
                : decorated.decorators = [newDecorator];
        }
        else {
            throw new Error(`Unknown command type ${type}`);
        }
    }

    /**
     * Executes a Command against a ClassDeclaration, adding
     * decorators to the ClassDeclaration, or its properties, as required.
     * @param {string} namespace the namespace for the declaration
     * @param {*} declaration the class declaration
     * @param {*} command the Command object from the
     * org.accordproject.decoratorcommands model
     */
    static executeCommand(namespace, declaration, command) {
        const { target, decorator, type } = command;
        if (this.isMatch(target.namespace, namespace) &&
            this.isMatch(target.declaration, declaration.name)) {
            if (!target.property && !target.type) {
                this.applyDecorator(declaration, type, decorator);
            }
            else {
                declaration.properties.forEach(property => {
                    if (this.isMatch(target.property, property.name) &&
                        this.isMatch(target.type, property.$class)) {
                        this.applyDecorator(property, type, decorator);
                    }
                });
            }
        }
    }
}

module.exports = DecoratorManager;
