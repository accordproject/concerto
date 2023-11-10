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
     * @param {Object} jsonData - the model ast for a particular namespace
     * @param {String} namespace - the namespace for which parsing is to be done
     * @param {String} DCS_VERSION - the version string
     * @returns {Array<Object>} - the parsed decorator command set array
     * @private
     */
    static parseNonVocabularyDecorators(jsonData, namespace, DCS_VERSION){
        const patternToDetermineVocab = /^Term_/i;
        const dcsObjects = [];
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
                }
            });
        });
        return dcsObjects;
    }
    /**
     * @param {Object} jsonData - the model ast for a particular namespace
     * @returns {Object} - the parsed vocab set object
     * @private
     */
    static parseVocabularies(jsonData){
        let dictVoc = {};
        const patternToDetermineVocab = /^Term_/i;
        jsonData.forEach(obj =>{
            const decos = JSON.parse(obj.dcs);
            decos.forEach(dcs =>{
                if (dcs.name === 'Term' || patternToDetermineVocab.test(dcs.name)){
                    dictVoc[obj.declaration] = dictVoc[obj.declaration] || { propertyVocabs: {} };
                    if (obj.property !== ''){
                        if (!dictVoc[obj.declaration].propertyVocabs[obj.property]){
                            dictVoc[obj.declaration].propertyVocabs[obj.property] = {};
                        }
                        if (dcs.name === 'Term'){
                            dictVoc[obj.declaration].propertyVocabs[obj.property].term = dcs.arguments[0].value;
                        }
                        else {
                            const extensionKey = dcs.name.split('Term_')[1];
                            dictVoc[obj.declaration].propertyVocabs[obj.property][extensionKey] = dcs.arguments[0].value;
                        }
                    }
                    else {
                        if (dcs.name === 'Term'){
                            dictVoc[obj.declaration].term = dcs.arguments[0].value;
                        }
                        else {
                            const extensionKey = dcs.name.split('Term_')[1];
                            dictVoc[obj.declaration][extensionKey] = dcs.arguments[0].value;
                        }
                    }
                }
            });

        });
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
    * Adds a key-value pair to a dictionary (object) if the key exists,
    * or creates a new key with the provided value.
    *
    * @param {Object} extractionDictionary - extracted decorators and vocabularies
    * @param {String} DCS_VERSION - dcs_version
    * @param {String} locale - locale for vocabularies
    * @returns {Object} - constructed DCS Dict and processed models ast
    * @private
    */
    static parseDecosAndVocabs(extractionDictionary, DCS_VERSION, locale){
        const decoratorData = [];
        const vocabData = [];
        Object.keys(extractionDictionary).forEach(namespace => {
            const {name, version} = ModelUtil.parseNamespace(namespace);
            const nameOfDcs = name;
            const versionOfDcs = version;
            const jsonData = extractionDictionary[namespace];
            const dcsObjects = this.parseNonVocabularyDecorators(jsonData, namespace, DCS_VERSION);
            const vocabObject = this.parseVocabularies(jsonData);
            if (dcsObjects?.length > 0){
                const dcmsForNamespace = {
                    '$class': `org.accordproject.decoratorcommands@${DCS_VERSION}.DecoratorCommandSet`,
                    'name': nameOfDcs,
                    'version': versionOfDcs,
                    'commands': dcsObjects
                };
                decoratorData.push(dcmsForNamespace);
            }
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
        });
        return {
            decoratorCommandSet: decoratorData,
            vocabularies: vocabData
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
        let extractionDictionary = {};
        const sourceAst = modelManager.getAst(true);
        const processedModels = sourceAst.models.map(model =>{
            if ((model?.decorators.length > 0)){
                extractionDictionary = DecoratorUtil.constructDCSDictionary(extractionDictionary, model.namespace, model.decorators, {});
                if (removeDecoratorsFromModel){
                    model.decorators = undefined;
                }
            }
            const processedDecl = model.declarations.map(decl => {
                if (decl.decorators) {
                    const constructOptions = {
                        declaration: decl.name,
                    };
                    extractionDictionary = DecoratorUtil.constructDCSDictionary(extractionDictionary, model.namespace, decl.decorators, constructOptions);
                }
                if (removeDecoratorsFromModel){
                    decl.decorators = undefined;
                }
                if (decl.$class.endsWith('.MapDeclaration')) {
                    if (decl.key){
                        if (decl.key.decorators){
                            const constructOptions = {
                                declaration: decl.name,
                                mapElement: 'KEY'
                            };
                            extractionDictionary = DecoratorUtil.constructDCSDictionary(extractionDictionary, model.namespace, decl.key.decorators, constructOptions);
                            decl.key.decorators = undefined;
                        }
                    }
                    if (decl.value){
                        if (decl.value.decorators){
                            const constructOptions = {
                                declaration: decl.name,
                                mapElement: 'VALUE'
                            };
                            extractionDictionary = DecoratorUtil.constructDCSDictionary(extractionDictionary, model.namespace, decl.value.decorators, constructOptions);
                            decl.value.decorators = undefined;
                        }
                    }
                }
                if (decl.properties) {
                    const processedProperties = decl.properties.map(property => {
                        if (property.decorators){
                            const constructOptions = {
                                declaration: decl.name,
                                property: property.name
                            };
                            extractionDictionary = DecoratorUtil.constructDCSDictionary(extractionDictionary, model.namespace, property.decorators, constructOptions );
                        }
                        if (removeDecoratorsFromModel){
                            property.decorators = undefined;
                        }
                        return property;
                    });
                    decl.properties = processedProperties;
                }
                return decl;
            });
            model.declarations = processedDecl;
            return model;
        });
        const processedAST={
            ...sourceAst,
            models: processedModels,
        };
        const updatedModelManager = new ModelManager();
        updatedModelManager.fromAst(processedAST);
        const extractedDecosAndVocabs = this.parseDecosAndVocabs(extractionDictionary, DCS_VERSION, locale);
        return {
            updatedModelManager,
            decoratorCommandSet: extractedDecosAndVocabs.decoratorCommandSet,
            vocabularies: extractedDecosAndVocabs.vocabularies
        };
    }
}
module.exports = DecoratorUtil;