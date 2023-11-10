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
     * @param {Object} decoratorDict the input dict
     * @param {String} DCS_VERSION - the version string
     * @returns {Array<Object>} the parsed decorator command set array
     * @private
     */
    static parseNonVocabularyDecorators(decoratorDict, DCS_VERSION){
        const data = [];
        Object.keys(decoratorDict).forEach(namespace =>{
            const {name, version} = ModelUtil.parseNamespace(namespace);
            const nameOfDcs = name;
            const versionOfDcs = version;
            const dcsObjects = [];
            const jsonData = decoratorDict[namespace];
            const patternToDetermineVocab = /^Term_/i;
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
            const dcmsForNamespace = {
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
            if (JSON.stringify(decoratorDict[namespace]).includes('Term') ||
            JSON.stringify(decoratorDict[namespace]).includes('Term_')){
                let strVoc = '';
                strVoc = strVoc+`locale: ${locale}\n`;
                strVoc = strVoc+`namespace: ${namespace}\n`;
                strVoc = strVoc+'declarations:\n';
                const jsonData = decoratorDict[namespace];
                const dictVoc = {};
                jsonData.forEach(obj =>{
                    if (!dictVoc[obj.declaration]){
                        dictVoc[obj.declaration] = {
                            propertyVocabs: {}
                        };
                    }
                    const decos = JSON.parse(obj.dcs);
                    decos.forEach(dcs =>{
                        if (dcs.name === 'Term' || patternToDetermineVocab.test(dcs.name)){
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
                Object.keys(dictVoc).forEach(decl =>{
                    if (dictVoc[decl].term){
                        strVoc += `  - ${decl}: ${dictVoc[decl].term}\n`;
                        const otherProps = Object.keys(dictVoc[decl]).filter((str)=>str!=='term' && str!=='propertyVocabs');
                        otherProps.forEach(key =>{
                            strVoc += `    ${key}: ${dictVoc[decl][key]}\n`;
                        });
                    }
                    if (dictVoc[decl].propertyVocabs && Object.keys(dictVoc[decl].propertyVocabs).length>0){
                        if (!dictVoc[decl].term){
                            strVoc += `  - ${decl}: ${decl}\n`;
                        }
                        strVoc += '    properties:\n';
                        Object.keys(dictVoc[decl].propertyVocabs).forEach(prop =>{
                            strVoc += `      - ${prop}: ${dictVoc[decl].propertyVocabs[prop].term}\n`;
                            const otherProps = Object.keys(dictVoc[decl].propertyVocabs[prop]).filter((str)=>str!=='term');
                            otherProps.forEach(key =>{
                                strVoc += `        ${key}: ${dictVoc[decl].propertyVocabs[prop][key]}\n`;
                            });
                        });
                    }
                });
                data.push(strVoc);
            }
        });
        return data;
    }
    /**
    * Adds a key-value pair to a dictionary (object) if the key exists,
    * or creates a new key with the provided value.
    *
    * @param {Object} dictionary - The dictionary (object) to which to add the key-value pair.
    * @param {string} key - The key to add or update.
    * @param {any} value - The value to add or update.
    * @param {Object} options - The target declaration, property and mapElement.
    * @returns {Object} - constructed DCS Dict
    * @private
    */
    static constructDCSDictionary(dictionary, key, value, options) {
        const val = {
            declaration:options.declaration || '',
            property:options.property || '',
            mapElement:options.mapElement || '',
            dcs: JSON.stringify(value),
        };
        if (dictionary[key] && Array.isArray( dictionary[key])) {
            dictionary[key].push(val);
        } else {
            dictionary[key] = [val];
        }
        return dictionary;
    }
}
module.exports = DecoratorUtil;