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
const ModelUtil = require('./modelutil');
const { MetaModelNamespace } = require('@accordproject/concerto-metamodel');

/**
 * Utility functions to work with
 * [DecoratorCommandSet](https://models.accordproject.org/concerto/decorators.cto)
 * @memberof module:concerto-core
 */
class DecoratorExtractor {
    /**
     * The action to be performed to extract all, only vocab or only non-vocab decorators
     */
    static Action = {
        EXTRACT_ALL: 0,
        EXTRACT_VOCAB: 1,
        EXTRACT_NON_VOCAB: 2
    };

    /**
     * Create the DecoratorExtractor.
     * @constructor
     * @param {boolean} removeDecoratorsFromModel - flag to determine whether to remove decorators from source model
     * @param {string} locale - locale for extracted vocabularies
     * @param {string} dcs_version - version string
     * @param {Object} sourceModelAst - the ast of source models
     * @param {int} [action=DecoratorExtractor.Action.EXTRACT_ALL]  - the action to be performed
     */
    constructor(removeDecoratorsFromModel, locale, dcs_version, sourceModelAst, action = DecoratorExtractor.Action.EXTRACT_ALL) {
        this.extractionDictionary = {};
        this.removeDecoratorsFromModel = removeDecoratorsFromModel;
        this.locale = locale;
        this.dcs_version = dcs_version;
        this.sourceModelAst = sourceModelAst;
        this.updatedModelAst = sourceModelAst;
        if (action) {
            if (Object.values(DecoratorExtractor.Action).includes(action)) {
                this.action = action;
            } else {
                this.action = DecoratorExtractor.Action.EXTRACT_ALL;
            }
        }
    }

    /**
     * Returns if the decorator is vocab or not
     * @param {string} decoractorName - the name of decorator
     * @returns {boolean} - returns true if the decorator is a vocabulary decorator else false
     * @private
     */
    isVocabDecorator(decoractorName) {
        const vocabPattern = /^Term_/;
        return decoractorName === 'Term' || vocabPattern.test(decoractorName);
    }
    /**
    * Adds a key-value pair to a dictionary (object) if the key exists,
    * or creates a new key with the provided value.
    *
    * @param {string} key - The key to add or update.
    * @param {any} value - The value to add or update.
    * @param {Object} options - options containing target
    * @param {string} options.declaration - Target declaration
    * @param {string} options.property - Target property
    * @param {string} options.mapElement - Target map element
    * @private
    */
    constructDCSDictionary( key, value, options) {
        const val = {
            declaration:options?.declaration || '',
            property:options?.property || '',
            mapElement:options?.mapElement || '',
            dcs: JSON.stringify(value),
        };
        if (this.extractionDictionary[key] && Array.isArray(this.extractionDictionary[key])) {
            this.extractionDictionary[key].push(val);
        } else {
            this.extractionDictionary[key] = [val];
        }
    }
    /**
     * Transforms the collected decorators into proper decorator command sets
     * @param {Array<Object>} dcsObjects - the collection of collected decorators
     * @param {string} namespace - the current namespace
     * @param {Array<Object>} decoratorData - the collection of existing decorator command sets
     * @returns {Array<Object>} - the collection of decorator command sets
     * @private
     */
    transformNonVocabularyDecorators(dcsObjects, namespace, decoratorData){
        const {name, version} = ModelUtil.parseNamespace(namespace);
        const nameOfDcs = name;
        const versionOfDcs = version;
        if (dcsObjects?.length > 0){
            const dcmsForNamespace = {
                '$class': `org.accordproject.decoratorcommands@${this.dcs_version}.DecoratorCommandSet`,
                'name': nameOfDcs,
                'version': versionOfDcs,
                'commands': dcsObjects
            };
            decoratorData.push(dcmsForNamespace);
        }
        return decoratorData;
    }
    /**
     * Transforms the collected vocabularies into proper vocabulary command sets
     * @param {Array<Object>} vocabObject - the collection of collected vocabularies
     * @param {string} namespace - the current namespace
     * @param {Array<Object>} vocabData - the collection of existing vocabularies command sets
     * @returns {Array<Object>} - the collection of vocabularies command sets
     * @private
     */
    transformVocabularyDecorators(vocabObject, namespace, vocabData){
        if (Object.keys(vocabObject).length > 0 ){
            let strVoc = '';
            strVoc = strVoc + `locale: ${this.locale}\n`;
            strVoc = strVoc + `namespace: ${namespace}\n`;
            strVoc = strVoc + 'declarations:\n';
            Object.keys(vocabObject).forEach(decl =>{
                if (vocabObject[decl].term){
                    strVoc += `  - ${decl}: ${vocabObject[decl].term}\n`;
                }
                const otherProps = Object.keys(vocabObject[decl]).filter((str)=>str !== 'term' && str !== 'propertyVocabs');
                if(otherProps.length > 0){
                    if (!vocabObject[decl].term){
                        strVoc += `  - ${decl}: ${decl}\n`;
                    }
                    otherProps.forEach(key =>{
                        strVoc += `    ${key}: ${vocabObject[decl][key]}\n`;
                    });
                }
                if (vocabObject[decl].propertyVocabs && Object.keys(vocabObject[decl].propertyVocabs).length > 0){
                    if (!vocabObject[decl].term && otherProps.length === 0){
                        strVoc += `  - ${decl}: ${decl}\n`;
                    }
                    strVoc += '    properties:\n';
                    Object.keys(vocabObject[decl].propertyVocabs).forEach(prop =>{
                        strVoc += `      - ${prop}: ${vocabObject[decl].propertyVocabs[prop].term || ''}\n`;
                        const otherProps = Object.keys(vocabObject[decl].propertyVocabs[prop]).filter((str)=>str !== 'term');
                        otherProps.forEach(key =>{
                            strVoc += `        ${key}: ${vocabObject[decl].propertyVocabs[prop][key]}\n`;
                        });
                    });
                }
            });
            vocabData.push(strVoc);
        }
        return vocabData;
    }
    /**
     * Constructs Target object for a given model
     * @param {string} namespace - the current namespace
     * @param {Object} obj - the ast of the model
     * @returns {Object} - the target object
     * @private
     */
    constructTarget(namespace, obj){
        const target = {
            '$class': `org.accordproject.decoratorcommands@${this.dcs_version}.CommandTarget`,
            'namespace':namespace
        };
        if (obj.declaration && obj.declaration !== ''){
            target.declaration = obj.declaration;
        }
        if (obj.property && obj.property !== ''){
            target.property = obj.property;
        }
        if (obj.mapElement && obj.mapElement !== ''){
            target.mapElement = obj.mapElement;
        }
        return target;
    }

    /**
     * Parses the dict data into an array of decorator jsons
     * @param {Array<Object>} dcsObjects - the array of collected dcs objects
     * @param {Object} dcs - the current dcs json to be parsed
     * @param {String} DCS_VERSION - the version string
     * @param {Object} target - target object for the command
     * @returns {Array<Object>} - the array of collected dcs objects with the current dcs
     * @private
     */
    parseNonVocabularyDecorators(dcsObjects, dcs, DCS_VERSION, target){
        const decotatorObj = {
            '$class': 'concerto.metamodel@1.0.0.Decorator',
            'name': dcs.name,
        };
        if (dcs.arguments){
            const args = dcs.arguments.map((arg)=>{
                return {
                    '$class':arg.$class,
                    'value':arg.value
                };
            });
            decotatorObj.arguments = args;
        }
        let dcsObject = {
            '$class': `org.accordproject.decoratorcommands@${DCS_VERSION}.Command`,
            'type': 'UPSERT',
            'target': target,
            'decorator': decotatorObj,
        };
        dcsObjects.push(dcsObject);
        return dcsObjects;
    }
    /**
     * @param {Object} dictVoc - the collection of collected vocabularies
     * @param {Object} decl - the declaration object
     * @param {Object} dcs - the current dcs json to be parsed
     * @returns {Object} - the collection of collected vocabularies with current dcs
     * @private
     */
    parseVocabularies(dictVoc, decl, dcs){
        dictVoc[decl.declaration] = dictVoc[decl.declaration] || { propertyVocabs: {} };
        if (decl.property !== ''){
            if (!dictVoc[decl.declaration].propertyVocabs[decl.property]){
                dictVoc[decl.declaration].propertyVocabs[decl.property] = {};
            }
            if (dcs.name === 'Term'){
                dictVoc[decl.declaration].propertyVocabs[decl.property].term = dcs.arguments[0].value;
            }
            else {
                const extensionKey = dcs.name.split('Term_')[1];
                dictVoc[decl.declaration].propertyVocabs[decl.property][extensionKey] = dcs.arguments[0].value;
            }
        }
        else {
            if (dcs.name === 'Term'){
                dictVoc[decl.declaration].term = dcs.arguments[0].value;
            }
            else {
                const extensionKey = dcs.name.split('Term_')[1];
                dictVoc[decl.declaration][extensionKey] = dcs.arguments[0].value;
            }
        }
        return dictVoc;
    }
    /**
    * parses the extracted decorators and generates arrays of decorator command set and vocabularies
    *
    * @returns {Object} - constructed DCS Dict and processed models ast
    * @private
    */
    transformDecoratorsAndVocabularies(){
        let decoratorData = [];
        let vocabData = [];
        Object.keys(this.extractionDictionary).forEach(namespace => {
            const jsonData = this.extractionDictionary[namespace];
            let dcsObjects = [];
            let vocabObject = {};
            jsonData.forEach(obj =>{
                const decos = JSON.parse(obj.dcs);
                const target = this.constructTarget(namespace, obj);
                decos.forEach(dcs =>{
                    const isVocab = this.isVocabDecorator(dcs.name);
                    if (!isVocab && this.action !== DecoratorExtractor.Action.EXTRACT_VOCAB){
                        dcsObjects = this.parseNonVocabularyDecorators(dcsObjects, dcs, this.dcs_version, target);
                    }
                    if (isVocab && this.action !== DecoratorExtractor.Action.EXTRACT_NON_VOCAB){
                        vocabObject = this.parseVocabularies(vocabObject, obj, dcs);
                    }
                });
            });
            if(this.action !== DecoratorExtractor.Action.EXTRACT_VOCAB){
                decoratorData = this.transformNonVocabularyDecorators(dcsObjects, namespace, decoratorData);
            }
            if(this.action !== DecoratorExtractor.Action.EXTRACT_NON_VOCAB){
                vocabData = this.transformVocabularyDecorators(vocabObject, namespace, vocabData);
            }
        });
        return {
            decoratorCommandSet: decoratorData,
            vocabularies: vocabData
        };
    }
    /**
     * Filter vocab or non-vocab decorators
     * @param {Object} decorators - the collection of decorators
     * @returns {Object} - the collection of filtered decorators
     * @private
     */
    filterDecorators(decorators){
        if (this.action === DecoratorExtractor.Action.EXTRACT_ALL){
            return undefined;
        }
        else if(this.action === DecoratorExtractor.Action.EXTRACT_VOCAB){
            return decorators.filter((dcs) => {
                return !this.isVocabDecorator(dcs.name);
            });
        }
        else if(this.action === DecoratorExtractor.Action.EXTRACT_NON_VOCAB){
            return decorators.filter((dcs) => {
                return this.isVocabDecorator(dcs.name);
            });
        }
    }
    /**
    * Process the map declarations to extract the decorators.
    *
    * @param {Object} declaration - The source AST of the model
    * @param {string} namespace - namespace of the model
    * @returns {Object} - processed map declarations ast
    * @private
    */
    processMapDeclaration(declaration, namespace){
        if (declaration.key){
            if (declaration.key.decorators){
                const constructOptions = {
                    declaration: declaration.name,
                    mapElement: 'KEY'
                };
                this.constructDCSDictionary(namespace, declaration.key.decorators, constructOptions);
                declaration.key.decorators = this.filterDecorators(declaration.key.decorators);
            }
        }
        if (declaration.value){
            if (declaration.value.decorators){
                const constructOptions = {
                    declaration: declaration.name,
                    mapElement: 'VALUE'
                };
                this.constructDCSDictionary(namespace, declaration.value.decorators, constructOptions);
                declaration.value.decorators = this.filterDecorators(declaration.value.decorators);
            }
        }
        return declaration;
    }

    /**
    * Process the properties to extract the decorators.
    *
    * @param {Object} sourceProperties - The source AST of the property
    * @param {string} declarationName - The name of source declaration
    * @param {string} namespace - namespace of the model
    * @returns {Object} - processed properties ast
    * @private
    */
    processProperties(sourceProperties, declarationName, namespace){
        const processedProperties = sourceProperties.map(property => {
            if (property.decorators){
                const constructOptions = {
                    declaration: declarationName,
                    property: property.name
                };
                this.constructDCSDictionary(namespace, property.decorators, constructOptions );
                property.decorators = this.filterDecorators(property.decorators);
            }
            return property;
        });
        return processedProperties;
    }

    /**
    * Process the declarations to extract the decorators.
    *
    * @param {Object} sourceDecl - The source AST of the model
    * @param {string} namespace - namespace of the model
    * @returns {Object} - processed declarations ast
    * @private
    */
    processDeclarations(sourceDecl, namespace){
        const processedDecl = sourceDecl.map(decl => {
            if (decl.decorators) {
                const constructOptions = {
                    declaration: decl.name,
                };
                this.constructDCSDictionary(namespace, decl.decorators, constructOptions);
                decl.decorators = this.filterDecorators(decl.decorators);
            }
            if (decl.$class === `${MetaModelNamespace}.MapDeclaration`) {
                const processedMapDecl = this.processMapDeclaration(decl, namespace);
                decl = processedMapDecl;
            }
            if (decl.properties) {
                const processedProperties = this.processProperties(decl.properties, decl.name, namespace);
                decl.properties = processedProperties;
            }
            return decl;
        });
        return processedDecl;
    }

    /**
    * Process the models to extract the decorators.
    *
    * @private
    */
    processModels(){
        const processedModels = this.sourceModelAst.models.map(model =>{
            if ((model?.decorators.length > 0)){
                this.constructDCSDictionary(model.namespace, model.decorators, {});
                model.decorators = this.filterDecorators(model.decorators);
            }
            const processedDecl = this.processDeclarations(model.declarations, model.namespace);
            model.declarations = processedDecl;
            return model;
        });
        this.updatedModelAst = {
            ...this.updatedModelAst,
            models: processedModels
        };
    }

    /**
    * Collects the decorators and vocabularies and updates the modelManager depending
    * on the options.
    *
    * @returns {Object} - constructed DCS Dict and processed models ast
    * @private
    */
    extract() {
        this.processModels();
        const updatedModelManager = new ModelManager();
        updatedModelManager.fromAst(this.updatedModelAst);
        const extractedDecosAndVocabs = this.transformDecoratorsAndVocabularies();
        return {
            updatedModelManager,
            decoratorCommandSet: extractedDecosAndVocabs.decoratorCommandSet,
            vocabularies: extractedDecosAndVocabs.vocabularies
        };
    }
}
module.exports = DecoratorExtractor;
