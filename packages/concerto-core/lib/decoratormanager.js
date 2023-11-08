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
const Serializer = require('./serializer');
const Factory = require('./factory');
const ModelUtil = require('./modelutil');
const { MetaModelNamespace } = require('@accordproject/concerto-metamodel');
const semver = require('semver');

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
/* istanbul ignore next */
if (global === undefined) {
    const ModelFile = require('./introspect/modelfile');
}
/* eslint-enable no-unused-vars */

const DCS_VERSION = '0.3.0';

const DCS_MODEL = `concerto version "^3.0.0"
namespace org.accordproject.decoratorcommands@0.3.0

import concerto.metamodel@1.0.0.Decorator

/**
 * A reference to an existing named & versioned DecoratorCommandSet
 */
concept DecoratorCommandSetReference {
    o String name
    o String version
}

/**
 * Whether to upsert or append the decorator
 */
enum CommandType {
    o UPSERT
    o APPEND
}

/**
 * Which models elements to add the decorator to. Any null
 * elements are 'wildcards'. 
 */
concept CommandTarget {
    o String namespace optional
    o String declaration optional
    o String property optional
    o String[] properties optional // property and properties are mutually exclusive
    o String type optional 
    o MapElement mapElement optional
}

/**
 * Map Declaration elements which might be used as a target
 */
enum MapElement {
    o KEY
    o VALUE
    o KEY_VALUE
}

/**
 * Applies a decorator to a given target
 */
concept Command {
    o CommandTarget target
    o Decorator decorator
    o CommandType type
}

/**
 * A named and versioned set of commands. Includes are supported for modularity/reuse.
 */
concept DecoratorCommandSet {
    o String name
    o String version
    o DecoratorCommandSetReference[] includes optional // not yet supported
    o Command[] commands
}
`;

/**
 * Intersection of two string arrays
 * @param {string[]} a the first array
 * @param {string[]} b the second array
 * @returns {string[]} returns the intersection of a and b (i.e. an
 * array of the elements they have in common)
 */
function intersect(a, b) {
    const setA = new Set(a);
    const setB = new Set(b);
    const intersection = new Set([...setA].filter((x) => setB.has(x)));
    return Array.from(intersection);
}

/**
 * Returns true if the unversioned namespace for a model
 * file is equal to a target
 * @param {ModelFile} modelFile the model file to test
 * @param {string} unversionedNamespace the unversioned namespace to test against
 * @returns {boolean} true is the unversioned namespace for the
 * model file equals unversionedNamespace
 */
function isUnversionedNamespaceEqual(modelFile, unversionedNamespace) {
    const { name } = ModelUtil.parseNamespace(modelFile.getNamespace());
    return name === unversionedNamespace;
}

/**
 * Utility functions to work with
 * [DecoratorCommandSet](https://models.accordproject.org/concerto/decorators.cto)
 * @memberof module:concerto-core
 */
class DecoratorManager {

    /**
     * Structural validation of the decoratorCommandSet against the
     * Decorator Command Set model. Note that this only checks the
     * structural integrity of the command set, it cannot check
     * whether the commands are valid with respect to a model manager.
     * Use the options.validateCommands option with decorateModels
     * method to perform semantic validation.
     * @param {*} decoratorCommandSet the DecoratorCommandSet object
     * @param {ModelFile[]} [modelFiles] an optional array of model
     * files that are added to the validation model manager returned
     * @returns {ModelManager} the model manager created for validation
     * @throws {Error} throws an error if the decoratorCommandSet is invalid
     */
    static validate(decoratorCommandSet, modelFiles) {
        const validationModelManager = new ModelManager({
            strict: true,
            metamodelValidation: true,
            addMetamodel: true,
        });
        if(modelFiles) {
            validationModelManager.addModelFiles(modelFiles);
        }
        validationModelManager.addCTOModel(
            DCS_MODEL,
            'decoratorcommands@0.3.0.cto'
        );
        const factory = new Factory(validationModelManager);
        const serializer = new Serializer(factory, validationModelManager);
        serializer.fromJSON(decoratorCommandSet);
        return validationModelManager;
    }

    /**
     * Rewrites the $class property on decoratorCommandSet classes.
     * @private
     * @param {*} decoratorCommandSet the DecoratorCommandSet object
     * @param {string} version the DCS version upgrade target
     * @returns {object} the migrated DecoratorCommandSet object
     */
    static migrateTo(decoratorCommandSet, version) {
        if (decoratorCommandSet instanceof Object) {
            for (let key in decoratorCommandSet) {
                if (key === '$class' && decoratorCommandSet[key].includes('org.accordproject.decoratorcommands')) {
                    const ns = ModelUtil.getNamespace(decoratorCommandSet.$class);
                    decoratorCommandSet[key] = decoratorCommandSet[key].replace(
                        ModelUtil.parseNamespace(ns).version,
                        DCS_VERSION);
                }
                if (decoratorCommandSet[key] instanceof Object || decoratorCommandSet[key] instanceof Array) {
                    this.migrateTo(decoratorCommandSet[key], version);
                }
            }
        }
        return decoratorCommandSet;
    }

    /**
     * Checks if the supplied decoratorCommandSet can be migrated.
     * Migrations should only take place across minor versions of the same major version.
     * @private
     * @param {*} decoratorCommandSet the DecoratorCommandSet object
     * @param {*} DCS_VERSION the DecoratorCommandSet version
     * @returns {boolean} returns true if major versions are equal
     */
    static canMigrate(decoratorCommandSet, DCS_VERSION) {
        const inputVersion = ModelUtil.parseNamespace(ModelUtil.getNamespace(decoratorCommandSet.$class)).version;
        return (semver.major(inputVersion) === semver.major(DCS_VERSION) && (semver.minor(inputVersion) < semver.minor(DCS_VERSION)));
    }

    /**
     * Applies all the decorator commands from the DecoratorCommandSet
     * to the ModelManager.
     * @param {ModelManager} modelManager the input model manager
     * @param {*} decoratorCommandSet the DecoratorCommandSet object
     * @param {object} [options] - decorator models options
     * @param {boolean} [options.validate] - validate that decorator command set is valid
     * with respect to to decorator command set model
     * @param {boolean} [options.validateCommands] - validate the decorator command set targets. Note that
     * the validate option must also be true
     * @param {boolean} [options.migrate] - migrate the decoratorCommandSet $class to match the dcs model version
     * @returns {ModelManager} a new model manager with the decorations applied
     */
    static decorateModels(modelManager, decoratorCommandSet, options) {

        if (options?.migrate && this.canMigrate(decoratorCommandSet, DCS_VERSION)) {
            decoratorCommandSet = this.migrateTo(decoratorCommandSet, DCS_VERSION);
        }

        if (options?.validate) {
            const validationModelManager = new ModelManager({
                strict: true,
                metamodelValidation: true,
                addMetamodel: true,
            });
            validationModelManager.addModelFiles(modelManager.getModelFiles());
            validationModelManager.addCTOModel(
                DCS_MODEL,
                'decoratorcommands@0.3.0.cto'
            );
            const factory = new Factory(validationModelManager);
            const serializer = new Serializer(factory, validationModelManager);
            serializer.fromJSON(decoratorCommandSet);
            if (options?.validateCommands) {
                decoratorCommandSet.commands.forEach((command) => {
                    DecoratorManager.validateCommand(
                        validationModelManager,
                        command
                    );
                });
            }
        }
        const ast = modelManager.getAst(true);
        const decoratedAst = JSON.parse(JSON.stringify(ast));
        decoratedAst.models.forEach((model) => {
            model.declarations.forEach((decl) => {
                decoratorCommandSet.commands.forEach((command) => {
                    this.executeCommand(model.namespace, decl, command);
                });
            });
        });
        const newModelManager = new ModelManager();
        newModelManager.fromAst(decoratedAst);
        return newModelManager;
    }

    /**
     * Extracts all the decorator commands from all the models in modelManager
     * @param {ModelManager} modelManager the input model manager
     * @param {object} options - decorator models options
     * @param {boolean} options.removeDecoratorsFromModel - flag to strip out decorators from models
     * @param {string} options.locale - locale for extracted vocabulary set
     * @returns {Object} a new model manager with the decorations removed and a list of extracted decorator jsons
     */
    static extractDecorators(modelManager,options) {
        options = {
            removeDecoratorsFromModel: false,
            locale:'en',
            ...options
        };
        const extractionDictionary={};
        const data = modelManager.accept(this, {options,extractionDictionary,extractDecorators:true});
        const decoratorCommandSet=(this.parseNonVocabularyDecorators(data.extractionDictionary));
        const vocabularies = this.parseVocabularies(data.extractionDictionary,options.locale);
        return {
            decoratorCommandSet,
            vocabularies,
            modelManager:data.modelManager
        };
    }
    /**
     * Parses the dict data into an array of decorator jsons
     * @param {Object} decoratorDict the input dict
     * @returns {Array<Object>} the parsed decorator command set array
     * @private
     */
    static parseNonVocabularyDecorators(decoratorDict){
        const data = [];
        Object.keys(decoratorDict).forEach((namespace)=>{
            const {name, version} = ModelUtil.parseNamespace(namespace);
            const nameOfDcs=name;
            const versionOfDcs=version;
            const dcsObjects=[];
            const jsonData=decoratorDict[namespace];
            const patternToDetermineVocab = /^Term_/i;
            jsonData.forEach((obj)=>{
                const dcs=(obj.dcs);
                const target={
                    '$class': `org.accordproject.decoratorcommands@${DCS_VERSION}.CommandTarget`,
                    'namespace':namespace
                };
                if (obj.declaration && obj.declaration!==''){
                    target.declaration=obj.declaration;
                }
                if (obj.property && obj.property!==''){
                    target.property=obj.property;
                }
                if (dcs.name!=='Term' && !patternToDetermineVocab.test(dcs.name)){
                    const decotatorObj={
                        '$class': 'concerto.metamodel@1.0.0.Decorator',
                        'name': dcs.name,
                    };
                    if (dcs.arguments){
                        const args=dcs.arguments.map(arg=>{
                            return {
                                '$class':arg.$class,
                                'value':arg.value
                            };
                        });
                        decotatorObj.arguments=args;
                    }
                    const dcsObject = {
                        '$class': `org.accordproject.decoratorcommands@${DCS_VERSION}.Command`,
                        'type': 'UPSERT',
                        'target': target,
                        'decorator': decotatorObj,
                    };
                    dcsObjects.push(dcsObject);
                }
            });
            const dcmsForNamespace={
                '$class': `org.accordproject.decoratorcommands@${DCS_VERSION}.DecoratorCommandSet`,
                'name': nameOfDcs,
                'version': versionOfDcs,
                'commands': dcsObjects
            };
            data.push(dcmsForNamespace);
        });
        return data;
    }
    /**
     * Parses the dict data into an array of decorator jsons
     * @param {Object} decoratorDict the input dict
     * @param {String} locale locale for target vocab
     * @returns {Array<Object>} the parsed decorator command set array
     * @private
     */
    static parseVocabularies(decoratorDict,locale){
        const data = [];
        const patternToDetermineVocab = /^Term_/i;
        Object.keys(decoratorDict).forEach((namespace)=>{
            let strVoc='';
            strVoc=strVoc+`locale: ${locale}\n`;
            strVoc=strVoc+`namespace: ${namespace}\n`;
            strVoc=strVoc+'declarations:\n';
            const jsonData=decoratorDict[namespace];
            let dictVoc={};
            jsonData.forEach((obj)=>{
                // check if obj.decl already in dictVoc
                if (!dictVoc[obj.declaration]){
                    dictVoc[obj.declaration]={
                        propertyVocabs:{}
                    };
                }
                const dcs=(obj.dcs);
                if (dcs.name==='Term' || patternToDetermineVocab.test(dcs.name)){
                    if (obj.property!==''){
                        if(!dictVoc[obj.declaration].propertyVocabs[obj.property]){
                            dictVoc[obj.declaration].propertyVocabs[obj.property]={};
                        }
                        if (dcs.name==='Term'){
                            dictVoc[obj.declaration].propertyVocabs[obj.property].term=dcs.arguments[0].value;
                        }
                        else{
                            const extensionKey = dcs.name.split('Term_')[1];
                            dictVoc[obj.declaration].propertyVocabs[obj.property][extensionKey]=dcs.arguments[0].value;
                        }
                    }
                    else{
                        if (dcs.name==='Term'){
                            dictVoc[obj.declaration].term=dcs.arguments[0].value;
                        }
                        else{
                            const extensionKey = dcs.name.split('Term_')[1];
                            dictVoc[obj.declaration][extensionKey]=dcs.arguments[0].value;
                        }
                    }
                }
            });
            Object.keys(dictVoc).forEach((decl)=>{
                if (dictVoc[decl].term){
                    strVoc+=`  - ${decl}: ${dictVoc[decl].term}\n`;
                    const otherProps = Object.keys(dictVoc[decl]).filter((str)=>str!=='term' && str!=='propertyVocabs');
                    otherProps.forEach((key)=>{
                        strVoc+=`    ${key}: ${dictVoc[decl][key]}\n`;
                    });
                }
                if (dictVoc[decl].propertyVocabs && Object.keys(dictVoc[decl].propertyVocabs).length>0){
                    if (!dictVoc[decl].term){
                        strVoc+=`  - ${decl}: ${decl}\n`;
                    }
                    strVoc+='    properties:\n';
                    Object.keys(dictVoc[decl].propertyVocabs).forEach((prop)=>{
                        strVoc+=`      - ${prop}: ${dictVoc[decl].propertyVocabs[prop].term}\n`;
                        const otherProps = Object.keys(dictVoc[decl].propertyVocabs[prop]).filter((str)=>str!=='term');
                        otherProps.forEach((key)=>{
                            strVoc+=`        ${key}: ${dictVoc[decl].propertyVocabs[prop][key]}\n`;
                        });
                    });
                }
            });
            data.push(strVoc);
        });
        return data;
    }
    /**
     * Visitor design pattern
     * @param {Object} thing - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Boolean} the result of visiting or null
     * @private
     */
    static visit(thing, parameters = {}) {
        if (thing.isModelManager?.()) {
            return this.visitModelManager(thing, parameters);
        } else if (thing.isModelFile?.()) {
            return this.visitModelFile(thing, parameters);
        } else if (thing.isEnum?.()) {
            return this.visitDeclaration(thing, parameters);
        } else if (thing.isClassDeclaration?.()) {
            return this.visitDeclaration(thing, parameters);
        } else if (thing.isMapDeclaration?.()) {
            return;
        } else if (thing.isScalarDeclaration?.()) {
            return this.visitScalarDeclaration(thing, parameters);
        }else if (thing.isParticipant?.()) {
            return this.visitDeclaration(thing, parameters);
        } else if (thing.isTransaction?.()) {
            return this.visitDeclaration(thing, parameters);
        } else if (thing.isEvent?.()) {
            return this.visitDeclaration(thing, parameters);
        } else if (thing.isAsset?.()) {
            return this.visitDeclaration(thing, parameters);
        } else if (thing.isTypeScalar?.()) {
            return this.visitDeclaration(thing, parameters);
        } else if (thing.isField?.()) {
            return this.visitField(thing, parameters);
        } else if (thing.isRelationship?.()) {
            return this.visitField(thing, parameters);
        } else if (thing.isEnumValue?.()) {
            return this.visitField(thing, parameters);
        } else {
            throw new Error('Unrecognised ' + JSON.stringify(thing) );
        }
    }


    /**
     * Visitor design pattern
     * @param {ModelManager} modelManager - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    static visitModelManager(modelManager, parameters) {
        if (parameters.extractDecorators){
            let updatedModelManager=modelManager;
            updatedModelManager.modelFiles=modelManager.getModelFiles().map((modelFile) => {
                if (modelFile.decorators && modelFile.decorators.length>0){
                    parameters.extractionDictionary=this.constructDCSDictionary(parameters.extractionDictionary,modelFile.namespace, modelFile.decorators,'','');
                    if (parameters.options.removeDecoratorsFromModel){
                        modelFile.removeDecorators();
                    }
                }
                parameters.namespace=modelFile.namespace;
                const data=modelFile.accept(this, parameters);
                parameters.extractionDictionary=data.extractionDictionary;
                modelFile=data.modelFile;
                return modelFile;
            });
            return {extractionDictionary:parameters.extractionDictionary,modelManager:updatedModelManager};
        }
        else{
            return null;
        }
    }

    /**
     * Visitor design pattern
     * @param {ModelFile} modelFile - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    static visitModelFile(modelFile, parameters) {
        if (parameters.extractDecorators){
            let updatedModelFile=modelFile;
            updatedModelFile.declarations=modelFile.getAllDeclarations()
                .map((decl) => {
                    if (decl.decorators && decl.decorators.length>0){
                        parameters.extractionDictionary=this.constructDCSDictionary(parameters.extractionDictionary,parameters.namespace, decl.decorators,decl.name,'');
                        if (parameters.options.removeDecoratorsFromModel){
                            decl.removeDecorators();
                        }
                    }
                    parameters.declaration= decl.name;
                    const data=decl.accept(this, parameters);
                    parameters.extractionDictionary=data.extractionDictionary;
                    decl=data.declaration;
                    return decl;
                });
            return {extractionDictionary:parameters.extractionDictionary,modelFile:updatedModelFile};
        }
        else{
            return null;
        }
    }

    /**
     * Visitor design pattern
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @param {string} type  - the type of the declaration
     * @return {Object} the result of visiting or null
     * @private
     */
    static visitDeclaration(classDeclaration, parameters) {
        if (parameters.extractDecorators){
            let updatedDeclaration=classDeclaration;
            updatedDeclaration.properties=classDeclaration.getOwnProperties().map((property) => {
                if (property.decorators && property.decorators.length>0){
                    parameters.extractionDictionary=this.constructDCSDictionary(parameters.extractionDictionary,parameters.namespace, property.decorators,parameters.declaration,property.name);
                    if (parameters.options.removeDecoratorsFromModel){
                        property.removeDecorators();
                    }
                }
                return property;
            });
            return {extractionDictionary:parameters.extractionDictionary,declaration:updatedDeclaration};
        }
        else{
            return null;
        }
    }
    /**
     * Visitor design pattern
     * @param {Field} field - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
    */
    static visitField(field, parameters) {
        if (parameters.extractDecorators){
            return parameters.extractionDictionary;
        }
        else{
            return null;
        }
    }
    /**
     * Visitor design pattern
     * @param {ScalarDeclaration} scalarDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @protected
     */
    static visitScalarDeclaration(scalarDeclaration, parameters) {
        if (parameters.extractDecorators){
            let updatedScalarDeclaration=scalarDeclaration;
            const scalarDeclarationName = scalarDeclaration.getName();
            const decos = scalarDeclaration.getDecorators();
            if (decos){
                if (decos.decorators && decos.decorators.length>0){
                    parameters.extractionDictionary=this.constructDCSDictionary(parameters.extractionDictionary,parameters.namespace, decos,scalarDeclarationName,'');
                    if (parameters.options.removeDecoratorsFromModel){
                        updatedScalarDeclaration.removeDecorators();
                    }
                }
            }
            return {extractionDictionary:parameters.extractionDictionary,declaration:updatedScalarDeclaration};
        }
        else{
            return null;
        }
    }

    /**
    * Adds a key-value pair to a dictionary (object) if the key exists,
    * or creates a new key with the provided value.
    *
    * @param {Object} dictionary - The dictionary (object) to which to add the key-value pair.
    * @param {string} key - The key to add or update.
    * @param {any} decorators - The value to add or update.
    * @param {string} declaration - The target decl.
    * @param {string} property The target property.
    * @returns {Object} - constructed DCS Dict
    * @private
    */
    static constructDCSDictionary(dictionary, key, decorators, declaration,property) {
        decorators.forEach(deco=>{
            const val = {
                declaration,
                property,
                dcs: {name: deco.name,
                    arguments:deco.ast.arguments
                },
            };
            if (dictionary[key] && Array.isArray( dictionary[key])) {
                dictionary[key].push(val);
            } else {
                dictionary[key] = [val];
            }
        });
        return dictionary;
    }

    /**
     * Throws an error if the decoractor command is invalid
     * @param {ModelManager} validationModelManager the validation model manager
     * @param {*} command the decorator command
     */
    static validateCommand(validationModelManager, command) {
        if (command.target.type) {
            validationModelManager.resolveType(
                'DecoratorCommand.type',
                command.target.type
            );
        }
        let modelFile = null;
        if (command.target.namespace) {
            modelFile = validationModelManager.getModelFile(
                command.target.namespace
            );
            if (!modelFile) {
                const { name, version } = ModelUtil.parseNamespace(
                    command.target.namespace
                );
                if (!version) {
                    // does the model file exist with any version?
                    modelFile = validationModelManager
                        .getModelFiles()
                        .find((m) => isUnversionedNamespaceEqual(m, name));
                }
            }
        }
        if (command.target.namespace && !modelFile) {
            throw new Error(
                `Decorator Command references namespace "${
                    command.target.namespace
                }" which does not exist: ${JSON.stringify(command, null, 2)}`
            );
        }

        if (command.target.namespace && command.target.declaration) {
            validationModelManager.resolveType(
                'DecoratorCommand.target.declaration',
                `${modelFile.getNamespace()}.${command.target.declaration}`
            );
        }
        if (command.target.properties && command.target.property) {
            throw new Error(
                'Decorator Command references both property and properties. You must either reference a single property or a list of properites.'
            );
        }
        if (
            command.target.namespace &&
            command.target.declaration &&
            command.target.property
        ) {
            const decl = validationModelManager.getType(
                `${modelFile.getNamespace()}.${command.target.declaration}`
            );
            const property = decl.getProperty(command.target.property);
            if (!property) {
                throw new Error(
                    `Decorator Command references property "${command.target.namespace}.${command.target.declaration}.${command.target.property}" which does not exist.`
                );
            }
        }
        if (
            command.target.namespace &&
            command.target.declaration &&
            command.target.properties
        ) {
            const decl = validationModelManager.getType(
                `${modelFile.getNamespace()}.${command.target.declaration}`
            );
            command.target.properties.forEach((commandProperty) => {
                const property = decl.getProperty(commandProperty);
                if (!property) {
                    throw new Error(
                        `Decorator Command references property "${command.target.namespace}.${command.target.declaration}.${commandProperty}" which does not exist.`
                    );
                }
            });
        }
    }


    /**
     * Applies a new decorator to the Map element
     * @private
     * @param {string} element the element to apply the decorator to
     * @param {string} target the command target
     * @param {*} declaration the map declaration
     * @param {string} type the command type
     * @param {*} newDecorator the decorator to add
     */
    static applyDecoratorForMapElement(element, target, declaration, type, newDecorator ) {
        const decl = element === 'KEY' ? declaration.key : declaration.value;
        if (target.type) {
            if (this.falsyOrEqual(target.type, decl.$class)) {
                this.applyDecorator(decl, type, newDecorator);
            }
        } else {
            this.applyDecorator(decl, type, newDecorator);
        }
    }

    /**
     * Compares two arrays. If the first argument is falsy
     * the function returns true.
     * @param {string | string[] | null} test the value to test
     * @param {string[]} values the values to compare
     * @returns {Boolean} true if the test is falsy or the intersection of
     * the test and values arrays is not empty (i.e. they have values in common)
     */
    static falsyOrEqual(test, values) {
        return Array.isArray(test)
            ? intersect(test, values).length > 0
            : test
                ? values.includes(test)
                : true;
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
            if (decorated.decorators) {
                for (let n = 0; n < decorated.decorators.length; n++) {
                    let decorator = decorated.decorators[n];
                    if (decorator.name === newDecorator.name) {
                        decorated.decorators[n] = newDecorator;
                        updated = true;
                    }
                }
            }

            if (!updated) {
                decorated.decorators
                    ? decorated.decorators.push(newDecorator)
                    : (decorated.decorators = [newDecorator]);
            }
        } else if (type === 'APPEND') {
            decorated.decorators
                ? decorated.decorators.push(newDecorator)
                : (decorated.decorators = [newDecorator]);
        } else {
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
        const { name } = ModelUtil.parseNamespace( namespace );
        if (this.falsyOrEqual(target.namespace, [namespace,name]) &&
            this.falsyOrEqual(target.declaration, [declaration.name])) {

            if (declaration.$class === `${MetaModelNamespace}.MapDeclaration`) {
                if (target.mapElement) {
                    switch(target.mapElement) {
                    case 'KEY':
                    case 'VALUE':
                        this.applyDecoratorForMapElement(target.mapElement, target, declaration, type, decorator);
                        break;
                    case 'KEY_VALUE':
                        this.applyDecoratorForMapElement('KEY', target, declaration, type, decorator);
                        this.applyDecoratorForMapElement('VALUE', target, declaration, type, decorator);
                        break;
                    }
                } else if (target.type) {
                    if (this.falsyOrEqual(target.type, declaration.key.$class)) {
                        this.applyDecorator(declaration.key, type, decorator);
                    }
                    if (this.falsyOrEqual(target.type, declaration.value.$class)) {
                        this.applyDecorator(declaration.value, type, decorator);
                    }
                }
            } else if (!(target.property || target.properties || target.type)) {
                this.applyDecorator(declaration, type, decorator);
            } else {
                // scalars are declarations but do not have properties
                if (declaration.properties) {
                    declaration.properties.forEach((property) => {
                        DecoratorManager.executePropertyCommand(
                            property,
                            command
                        );
                    });
                }
            }
        }
    }

    /**
     * Executes a Command against a Property, adding
     * decorators to the Property as required.
     * @param {*} property the property
     * @param {*} command the Command object from the
     * org.accordproject.decoratorcommands model
     */
    static executePropertyCommand(property, command) {
        const { target, decorator, type } = command;
        if (
            this.falsyOrEqual(
                target.property ? target.property : target.properties,
                [property.name]
            ) &&
            this.falsyOrEqual(target.type, [property.$class])
        ) {
            this.applyDecorator(property, type, decorator);
        }
    }
}

module.exports = DecoratorManager;
