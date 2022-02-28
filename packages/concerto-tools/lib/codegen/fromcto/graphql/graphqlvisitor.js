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

const util = require('util');

/**
* Convert the contents of a ModelManager to GraphQL types, based on
* the https://spec.graphql.org/June2018/ specification.
* Set a fileWriter property (instance of FileWriter) on the parameters
* object to control where the generated code is written to disk.
*
* @private
* @class
* @memberof module:concerto-tools
*/
class GraphQLVisitor {
    /**
    * Constructor.
    * @param {boolean} [namespaces] - whether or not namespaces should be used.
    */
    constructor(namespaces) {
        this.namespaces = !!namespaces;
    }

    /**
    * Visitor design pattern
    * @param {Object} thing - the object being visited
    * @param {Object} parameters  - the parameter
    * @return {Object} the result of visiting or null
    * @private
    */
    visit(thing, parameters) {
        if (thing.isModelManager?.()) {
            return this.visitModelManager(thing, parameters);
        } else if (thing.isModelFile?.()) {
            return this.visitModelFile(thing, parameters);
        } else if (thing.isField?.()) {
            return this.visitField(thing, parameters);
        } else if (thing.isRelationship?.()) {
            return this.visitRelationship(thing, parameters);
        } else if (thing.isEnumValue?.()) {
            return this.visitEnumValueDeclaration(thing, parameters);
        } else if (thing.isClassDeclaration?.()) {
            return this.visitClassDeclaration(thing, parameters);
        }
        else {
            throw new Error('Unrecognised ' + util.inspect(thing, {showHidden: false, depth: 1}) );
        }
    }

    /**
    * Visitor design pattern
    * @param {ModelManager} modelManager - the object being visited
    * @param {Object} parameters  - the parameter
    * @return {Object} the result of visiting or null
    * @private
    */
    visitModelManager(modelManager, parameters) {
        parameters.decorators = {};

        parameters.fileWriter.openFile('model.gql');
        parameters.fileWriter.writeLine(0, 'scalar DateTime' );

        modelManager.getModelFiles().forEach((decl) => {
            decl.accept(this, parameters);
        });

        Object.keys(parameters.decorators).forEach( decoratorName => {
            parameters.fileWriter.writeBeforeLine( 0, this.decoratorAsDirectiveString(parameters.decorators[decoratorName], parameters) );
        });
        parameters.fileWriter.closeFile();
        return null;
    }

    /**
    * Visitor design pattern
    * @param {ModelFile} modelFile - the object being visited
    * @param {Object} parameters  - the parameter
    * @return {Object} the result of visiting or null
    * @private
    */
    visitModelFile(modelFile, parameters) {
        parameters.fileWriter.writeLine(0, `# namespace ${modelFile.getNamespace()}` );
        modelFile.getAllDeclarations().forEach((decl) => {
            decl.accept(this, parameters);
        });
        return null;
    }

    /**
    * Visitor design pattern
    * @param {ClassDeclaration} classDeclaration - the object being visited
    * @param {Object} parameters  - the parameter
    * @return {Object} the result of visiting or null
    * @private
    */
    visitClassDeclaration(classDeclaration, parameters) {
        const type = classDeclaration.isEnum() ? 'enum ' : 'type ';

        const typeName = this.toGraphQLName(this.namespaces ? classDeclaration.getFullyQualifiedName() : classDeclaration.getName());
        let decorators = this.decoratorsAsString(classDeclaration.getDecorators(), parameters);
        parameters.fileWriter.writeLine(0, type + typeName + decorators + ' {' );

        classDeclaration.getProperties().forEach((property) => {
            property.accept(this, parameters);
        });

        // Ensure we have at least one property
        // See: https://github.com/graphql/graphql-spec/issues/568#issuecomment-468788779
        if(classDeclaration.getProperties().length ===0) {
            parameters.fileWriter.writeLine(1, '_: Boolean' );
        }

        parameters.fileWriter.writeLine(0, '}' );

        return null;
    }

    /**
    * Visitor design pattern
    * @param {Field} field - the object being visited
    * @param {Object} parameters  - the parameter
    * @return {Object} the result of visiting or null
    * @private
    */
    visitField(field, parameters) {
        let type = this.toGraphQLType( this.namespaces ? field.getFullyQualifiedTypeName() : field.getType() );

        if(field.isArray()) {
            type = `[${type}]`;
        }

        if(!field.isOptional()) {
            type = `${type}!`;
        }

        const fieldName = this.toGraphQLName(field.getName());
        let decorators = this.decoratorsAsString(field.getDecorators(), parameters);
        parameters.fileWriter.writeLine(1, `${fieldName}: ${type}${decorators}`);
        return null;
    }

    /**
    * Visitor design pattern
    * @param {EnumValueDeclaration} enumValueDeclaration - the object being visited
    * @param {Object} parameters  - the parameter
    * @return {Object} the result of visiting or null
    * @private
    */
    visitEnumValueDeclaration(enumValueDeclaration, parameters) {
        parameters.fileWriter.writeLine(1, enumValueDeclaration.getName());
        return null;
    }

    /**
    * Visitor design pattern
    * @param {Relationship} relationship - the object being visited
    * @param {Object} parameters  - the parameter
    * @return {Object} the result of visiting or null
    * @private
    */
    visitRelationship(relationship, parameters) {
        let type = 'ID';

        if(relationship.isArray()) {
            type = `[${type}]`;
        }

        if(!relationship.isOptional()) {
            type = `${type}!`;
        }

        parameters.fileWriter.writeLine(1, `${relationship.getName()}: ${type} # ${relationship.getType()}`);
        return null;
    }

    /**
    * Converts a Decorator to a GraphQL directive string, to be placed
    * on a type or a field
    * @param {Decorator} decorator - the decorator
    * @param {Object} parameters  - the parameters
    * @return {String} the decorator as a GraphQL string
    * @private
    */
    decoratorAsString(decorator, parameters) {
        parameters.decorators[decorator.getName()] = decorator;
        let argsAsText = '';
        const args = decorator.getArguments();
        if(args.length > 1 && args.length % 2 === 0) {
            argsAsText += '(';
            for(let n=0; n < args.length; n=n+2) {
                const name = args[n].toString();
                const value = args[n+1];
                if(typeof value === 'object') {
                    const array = value.array ? '[]' : '';
                    argsAsText = argsAsText + `${name}: "${value.name}${array}"`;
                }
                else {
                    argsAsText = argsAsText + `${name}: ${JSON.stringify(value)}`;
                }
                if(n < args.length-2) {
                    argsAsText += ',';
                }
            }
            argsAsText += ')';
        }

        return (`@${decorator.getName()}${argsAsText}`);
    }

    /**
    * Converts a Decorator to the definition of a directive
    * that can be placed on an OBJECT or a FIELD_DEFINTION. Concerto doesn't
    * have a model for Decorators, so we have to infer one from an instance.
    * We use the last instance in the file to infer a model. :-/
    * @param {Decorator} decorator - the decorator
    * @param {Object} parameters  - the parameters
    * @return {String} the decorator as a GraphQL directive string
    * @private
    */
    decoratorAsDirectiveString(decorator, parameters) {
        let argsAsText = '';
        const args = decorator.getArguments();
        if(args.length > 1 && args.length % 2 === 0) {
            argsAsText += '(';
            for(let n=0; n < args.length; n=n+2) {
                const name = args[n].toString();
                const value = args[n+1];
                switch(typeof value) {
                case 'number':
                    if(Number.isInteger(value)) {
                        argsAsText += `${name}: Int`;
                    }
                    else {
                        argsAsText += `${name}: Float`;
                    }
                    break;
                case 'boolean':
                    argsAsText += `${name}: Boolean`;
                    break;
                case 'object':
                case 'string':
                    argsAsText += `${name}: String`;
                    break;
                }
                if(n < args.length-2) {
                    argsAsText += '\n';
                }
            }
            argsAsText += ')';
        }
        return (`directive @${decorator.getName()}${argsAsText} on OBJECT | FIELD_DEFINITION`);
    }
    /**
    * @param {Decorator[]} decorators - the decorators
    * @param {Object} parameters  - the parameters
    * @return {String} the decorators as a GraphQL string
    * @private
    */
    decoratorsAsString(decorators, parameters) {
        let decoratorsAsString = '';
        if(decorators) {
            decorators.forEach( decorator => decoratorsAsString = decoratorsAsString + ' ' + this.decoratorAsString(decorator, parameters));
        }
        return decoratorsAsString;
    }

    /**
     * Converts a Concerto type to a GraphQL type
     * @param {string} type the Concerto type
     * @returns {string} the GraphQL type
     */
    toGraphQLType(type) {
        switch(type) {
        case 'Integer':
        case 'Long':
            return 'Int';
        case 'Double':
            return 'Float';
        default:
            return this.toGraphQLName(type);
        }
    }

    /**
     * Escapes characters in a Concerto name to make them legal in GraphQL
     * @param {string} name Concerto name
     * @returns {string} a GraphQL legal name
     */
    toGraphQLName(name) {
        // $ is unfortunately a restricted character in GraphQL!
        return name.replace('$', '_').replace(/\./g, '_');
    }
}

module.exports = GraphQLVisitor;