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
/**
 * Internal Decorator Utility Class
 * @private
 * @class
 * @memberof module:concerto-core
 */
class DecoratorUtil {
    /**
     * Parses the dict data into an array of decorator jsons
     * @param {Array<Object>} dcsObjects - the array of collected dcs objects
     * @param {Object} dcs - the current dcs json to be parsed
     * @param {String} DCS_VERSION - the version string
     * @param {Object} target - target object for the command
     * @returns {Array<Object>} - the array of collected dcs objects with the current dcs
     * @private
     */
    static parseNonVocabularyDecorators(dcsObjects, dcs, DCS_VERSION, target){
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
    static parseVocabularies(dictVoc, decl, dcs){
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
    * Adds a key-value pair to a dictionary (object) if the key exists,
    * or creates a new key with the provided value.
    *
    * @param {Object} dictionary - The dictionary (object) to which to add the key-value pair.
    * @param {string} key - The key to add or update.
    * @param {any} value - The value to add or update.
    * @param {Object} options - options containing target
    * @param {string} options.declaration - Target declaration
    * @param {string} options.property - Target property
    * @param {string} options.mapElement - Target map element
    * @returns {Object} - constructed DCS Dict
    * @private
    */
    static constructDCSDictionary(dictionary, key, value, options) {
        const val = {
            declaration:options?.declaration || '',
            property:options?.property || '',
            mapElement:options?.mapElement || '',
            dcs: JSON.stringify(value),
        };
        if (dictionary[key] && Array.isArray( dictionary[key])) {
            dictionary[key].push(val);
        } else {
            dictionary[key] = [val];
        }
        return dictionary;
    }
    /**
     * Transforms the collected decorators into proper decorator command sets
     * @param {Array<Object>} dcsObjects - the collection of collected decorators
     * @param {string} DCS_VERSION - the version string
     * @param {string} namespace - the current namespace
     * @param {Array<Object>} decoratorData - the collection of existing decorator command sets
     * @returns {Array<Object>} - the collection of decorator command sets
     * @private
     */
    static transformNonVoabularyDecorators(dcsObjects, DCS_VERSION, namespace, decoratorData){
        const {name, version} = ModelUtil.parseNamespace(namespace);
        const nameOfDcs = name;
        const versionOfDcs = version;
        if (dcsObjects?.length > 0){
            const dcmsForNamespace = {
                '$class': `org.accordproject.decoratorcommands@${DCS_VERSION}.DecoratorCommandSet`,
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
     * @param {string} locale - the locale of vocabulary
     * @param {string} namespace - the current namespace
     * @param {Array<Object>} vocabData - the collection of existing vocabularies command sets
     * @returns {Array<Object>} - the collection of vocabularies command sets
     * @private
     */
    static transformVoabularyDecorators(vocabObject, locale, namespace, vocabData){
        if (Object.keys(vocabObject).length > 0 ){
            let strVoc = '';
            strVoc = strVoc+`locale: ${locale}\n`;
            strVoc = strVoc+`namespace: ${namespace}\n`;
            strVoc = strVoc+'declarations:\n';
            Object.keys(vocabObject).forEach(decl =>{
                if (vocabObject[decl].term){
                    strVoc += `  - ${decl}: ${vocabObject[decl].term}\n`;
                    const otherProps = Object.keys(vocabObject[decl]).filter((str)=>str!=='term' && str!=='propertyVocabs');
                    otherProps.forEach(key =>{
                        strVoc += `    ${key}: ${vocabObject[decl][key]}\n`;
                    });
                }
                if (vocabObject[decl].propertyVocabs && Object.keys(vocabObject[decl].propertyVocabs).length>0){
                    if (!vocabObject[decl].term){
                        strVoc += `  - ${decl}: ${decl}\n`;
                    }
                    strVoc += '    properties:\n';
                    Object.keys(vocabObject[decl].propertyVocabs).forEach(prop =>{
                        strVoc += `      - ${prop}: ${vocabObject[decl].propertyVocabs[prop].term}\n`;
                        const otherProps = Object.keys(vocabObject[decl].propertyVocabs[prop]).filter((str)=>str!=='term');
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
    * parses the extracted decorators and generates arrays of decorator command set and vocabularies
    *
    * @param {Object} extractionDictionary - extracted decorators and vocabularies
    * @param {String} DCS_VERSION - dcs_version
    * @param {String} locale - locale for vocabularies
    * @returns {Object} - constructed DCS Dict and processed models ast
    * @private
    */
    static parseDecosAndVocabs(extractionDictionary, DCS_VERSION, locale){
        let decoratorData = [];
        let vocabData = [];
        Object.keys(extractionDictionary).forEach(namespace => {
            const jsonData = extractionDictionary[namespace];
            const patternToDetermineVocab = /^Term_/i;
            let dcsObjects = [];
            let vocabObject = {};
            jsonData.forEach(obj =>{
                const decos = JSON.parse(obj.dcs);
                const target = {
                    '$class': `org.accordproject.decoratorcommands@${DCS_VERSION}.CommandTarget`,
                    'namespace':namespace
                };
                if (obj.declaration && obj.declaration!==''){
                    target.declaration = obj.declaration;
                }
                if (obj.property && obj.property!==''){
                    target.property = obj.property;
                }
                if (obj.mapElement && obj.mapElement!==''){
                    target.mapElement = obj.mapElement;
                }
                decos.forEach(dcs =>{
                    if (dcs.name !== 'Term' && !patternToDetermineVocab.test(dcs.name)){
                        dcsObjects = this.parseNonVocabularyDecorators(dcsObjects, dcs, DCS_VERSION, target);
                    }
                    else{
                        vocabObject = this.parseVocabularies(vocabObject, obj, dcs);
                    }
                });
            });
            decoratorData = this.transformNonVoabularyDecorators(dcsObjects, DCS_VERSION, namespace, decoratorData);
            vocabData = this.transformVoabularyDecorators(vocabObject, locale, namespace, vocabData);
        });
        return {
            decoratorCommandSet: decoratorData,
            vocabularies: vocabData
        };
    }

    /**
    * Process the properties to extract the decorators.
    *
    * @param {Object} sourceProperties - The source AST of the property
    * @param {string} declarationName - The name of source declaration
    * @param {Object} extractionDictionary - the collection of extracted decorators
    * @param {boolean} removeDecoratorsFromModel - flag to decide whether to remove decorators or not
    * @param {string} namespace - namespace of the model
    * @returns {Object} - constructed DCS Dict and processed declarations ast
    * @private
    */
    static processProperties(sourceProperties, declarationName, extractionDictionary, removeDecoratorsFromModel, namespace){
        const processedProperties=sourceProperties.map(property => {
            if (property.decorators){
                const constructOptions = {
                    declaration: declarationName,
                    property: property.name
                };
                extractionDictionary = DecoratorUtil.constructDCSDictionary(extractionDictionary, namespace, property.decorators, constructOptions );
            }
            if (removeDecoratorsFromModel){
                property.decorators = undefined;
            }
            return property;
        });
        return {
            processedProperties,
            extractionDictionary
        };
    }
    /**
    * Process the map declarations to extract the decorators.
    *
    * @param {Object} declaration - The source AST of the model
    * @param {Object} extractionDictionary - the collection of extracted decorators
    * @param {boolean} removeDecoratorsFromModel - flag to decide whether to remove decorators or not
    * @param {string} namespace - namespace of the model
    * @returns {Object} - constructed DCS Dict and processed declarations ast
    * @private
    */
    static processMapDeclaration(declaration, extractionDictionary, removeDecoratorsFromModel, namespace){
        if (declaration.key){
            if (declaration.key.decorators){
                const constructOptions = {
                    declaration: declaration.name,
                    mapElement: 'KEY'
                };
                extractionDictionary = DecoratorUtil.constructDCSDictionary(extractionDictionary, namespace, declaration.key.decorators, constructOptions);
                if (removeDecoratorsFromModel){
                    declaration.key.decorators = undefined;
                }
            }
        }
        if (declaration.value){
            if (declaration.value.decorators){
                const constructOptions = {
                    declaration: declaration.name,
                    mapElement: 'VALUE'
                };
                extractionDictionary = DecoratorUtil.constructDCSDictionary(extractionDictionary, namespace, declaration.value.decorators, constructOptions);
                if (removeDecoratorsFromModel){
                    declaration.value.decorators = undefined;
                }
            }
        }
        return {
            declaration,
            extractionDictionary
        };
    }
    /**
    * Process the declarations to extract the decorators.
    *
    * @param {Object} sourceDecl - The source AST of the model
    * @param {Object} extractionDictionary - the collection of extracted decorators
    * @param {boolean} removeDecoratorsFromModel - flag to decide whether to remove decorators or not
    * @param {string} namespace - namespace of the model
    * @returns {Object} - constructed DCS Dict and processed declarations ast
    * @private
    */
    static processDeclarations(sourceDecl, extractionDictionary, removeDecoratorsFromModel, namespace){
        const processedDecl = sourceDecl.map(decl => {
            if (decl.decorators) {
                const constructOptions = {
                    declaration: decl.name,
                };
                extractionDictionary = DecoratorUtil.constructDCSDictionary(extractionDictionary, namespace, decl.decorators, constructOptions);
            }
            if (removeDecoratorsFromModel){
                decl.decorators = undefined;
            }
            if (decl.$class.endsWith('.MapDeclaration')) {
                const processedMapDeclData = this.processMapDeclaration(decl, extractionDictionary, removeDecoratorsFromModel, namespace);
                decl = processedMapDeclData.declaration;
                extractionDictionary=processedMapDeclData.extractionDictionary;
            }
            if (decl.properties) {
                const processedPropertiesData = this.processProperties(decl.properties, decl.name, extractionDictionary, removeDecoratorsFromModel, namespace);
                decl.properties = processedPropertiesData.processedProperties;
                extractionDictionary = processedPropertiesData.extractionDictionary;
            }
            return decl;
        });
        return {
            processedDecl,
            extractionDictionary
        };
    }
    /**
    * Process the models to extract the decorators.
    *
    * @param {Object} sourceAst - The source AST of the model
    * @param {boolean} removeDecoratorsFromModel - flag to decide whether to remove decorators or not
    * @returns {Object} - constructed DCS Dict and processed models ast
    * @private
    */
    static processModels(sourceAst, removeDecoratorsFromModel){
        let extractionDictionary = {};
        const processedModels = sourceAst.models.map(model =>{
            if ((model?.decorators.length > 0)){
                extractionDictionary = DecoratorUtil.constructDCSDictionary(extractionDictionary, model.namespace, model.decorators, {});
                if (removeDecoratorsFromModel){
                    model.decorators = undefined;
                }
            }
            const processedDeclData = this.processDeclarations(model.declarations, extractionDictionary, removeDecoratorsFromModel, model.namespace);
            model.declarations = processedDeclData.processedDecl;
            extractionDictionary = processedDeclData.extractionDictionary;
            return model;
        });
        return {
            processedModels,
            extractionDictionary
        };
    }

    /**
    * Collects the decorators and vocabularies and updated the modelManager depending
    * on the options passed.
    *
    * @param {ModelManager} modelManager - Source modelManager
    * @param {boolean} removeDecoratorsFromModel - flag to remove decorators from source
    * @param {String} locale - locale for vocabularies
    * @param {String} DCS_VERSION - dcs_version
    * @returns {Object} - constructed DCS Dict and processed models ast
    * @private
    */
    static collectExtractedDecoratorsAndProcessedModels(modelManager, removeDecoratorsFromModel, locale, DCS_VERSION) {
        const sourceAst = modelManager.getAst(true);
        const processedData = this.processModels(sourceAst,removeDecoratorsFromModel);
        const processedAST={
            ...sourceAst,
            models: processedData.processedModels,
        };
        const updatedModelManager = new ModelManager();
        updatedModelManager.fromAst(processedAST);
        const extractedDecosAndVocabs = this.parseDecosAndVocabs(processedData.extractionDictionary, DCS_VERSION, locale);
        return {
            updatedModelManager,
            decoratorCommandSet: extractedDecosAndVocabs.decoratorCommandSet,
            vocabularies: extractedDecosAndVocabs.vocabularies
        };
    }
}
module.exports = DecoratorUtil;
