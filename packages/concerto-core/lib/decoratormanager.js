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

const Decorator = require('./introspect/decorator');

/**
 * Utility functions to work with
 * [DecoratorCommandSet](https://models.accordproject.org/concerto/decorators.cto)
 * @memberof module:concerto-core
 */
class DecoratorManager {
    /**
     * Applies all the decorator commands from the DecoratorCommandSet
     * to the ModelManager. Note that the ModelManager is modifed.
     * @param {ModelManager} modelManager the model manager
     * @param {*} decoratorCommandSet the DecoratorCommandSet object
     */
    static decorateModels(modelManager, decoratorCommandSet) {
        let declarations = [];
        modelManager.getModelFiles().forEach(mf => {
            const decls = mf.getAllDeclarations();
            declarations = declarations.concat(decls);
        });
        declarations.forEach(decl => {
            decoratorCommandSet.commands.forEach(command => {
                this.executeCommand(decl, command);
            });
        });
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
     * @param {Decorated} decorated the type to apply the decorator to
     * @param {string} type the command type
     * @param {Decorator} newDecorator the decorator to add
     */
    static applyDecorator(decorated, type, newDecorator) {
        if (type === 'UPSERT') {
            decorated.upsertDecorator(newDecorator.getName(), newDecorator);
        }
        else if (type === 'APPEND') {
            decorated.addDecorator(newDecorator);
        }
        else {
            throw new Error(`Unknown command type ${type}`);
        }
    }

    /**
     * Executes a Command against a ClassDeclaration, adding
     * decorators to the ClassDeclaration, or its properties, as required.
     * @param {ClassDeclaration} declaration the class declaration
     * @param {*} command the Command object from the
     * org.accordproject.decoratorcommands model
     */
    static executeCommand(declaration, command) {
        const { target, decorator, type } = command;
        if (this.isMatch(target.namespace, declaration.getNamespace()) &&
            this.isMatch(target.declaration, declaration.getName())) {
            if (!target.property && !target.type) {
                const newDecorator = new Decorator(declaration, decorator);
                this.applyDecorator(declaration, type, newDecorator);
            }
            else {
                declaration.getProperties().forEach(property => {
                    if (this.isMatch(target.property, property.getName()) &&
                        this.isMatch(target.type, property.getType())) {
                        const newDecorator = new Decorator(property, decorator);
                        this.applyDecorator(property, type, newDecorator);
                    }
                });
            }
        }
    }
}

module.exports = DecoratorManager;
