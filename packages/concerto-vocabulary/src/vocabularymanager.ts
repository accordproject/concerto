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

import YAML from 'yaml';
import { MetaModelNamespace } from '@accordproject/concerto-metamodel';
import Vocabulary = require('./vocabulary');
import { ModelUtil, ModelManager, DecoratorManager } from '@accordproject/concerto-core';

const DC_NAMESPACE = 'org.accordproject.decoratorcommands@0.4.0';

/**
 * Converts a camel case string to a sentence
 * @param {string} text input
 * @returns {string} modified string
 */
function camelCaseToSentence(text: string): string {
    const result = text.replace(/([A-Z]+)/g, ' $1').trim();
    return result.charAt(0).toUpperCase() + result.slice(1);
}

/**
* A vocabulary manager for concerto models. The vocabulary manager
* stores and provides API access to a set of vocabulary files, where each file
* is associated with a BCP-47 language tag and a Concerto namespace.
* @see https://datatracker.ietf.org/doc/html/rfc5646#section-2
* @class
* @memberof module:concerto-vocabulary
*/
class VocabularyManager {
    public vocabularies: Record<string, Vocabulary>;
    public missingTermGenerator: any;
    public enableDcsNamespaceTarget: any;

    /**
     * Create the VocabularyManager
     * @param {*} [options] options to configure vocabulary lookup
     * @param {*} [options.missingTermGenerator] A function to call for missing terms. The function
     * @param {*} [options.enableDcsNamespaceTarget] A boolean to enable the namespace target in the DCS
     * should accept namespace, locale, declarationName, propertyName as arguments
     * @constructor
     */
    constructor(options?: any) {
        this.vocabularies = {}; // key is namespace/locale, value is a Vocabulary object
        this.missingTermGenerator = options ? options.missingTermGenerator : null;
        this.enableDcsNamespaceTarget = options?.enableDcsNamespaceTarget;
    }

    /**
     * Computes a term in English based on declaration and property name.
     * @param {string} namespace the namespace
     * @param {string} locale the BCP-47 locale identifier
     * @param {string} declarationName the name of a concept or enum
     * @param {string} [propertyName] the name of a property (optional)
     * @returns {string} the term or null if it does not exist
     */
    static englishMissingTermGenerator(namespace: string, locale: string, declarationName: string, propertyName?: string): string {
        // @ts-ignore
        if(DecoratorManager.isNamespaceTargetEnabled(this.enableDcsNamespaceTarget) && !declarationName){
            return camelCaseToSentence(ModelUtil.parseNamespace(namespace).name);
        }
        const firstPart = propertyName ? propertyName.replace('$', '') + ' of the' : '';
        return camelCaseToSentence(firstPart + declarationName);
    }

    /**
     * Removes all vocabularies
     */
    clear() {
        this.vocabularies = {};
    }

    /**
     * Removes a vocabulary from the vocabulary manager
     * @param {string} namespace the namespace for the vocabulary
     * @param {string} locale the BCP-47 locale identifier
     */
    removeVocabulary(namespace: string, locale: string) {
        delete this.vocabularies[`${namespace}/${locale}`];
    }

    /**
     * Adds a vocabulary to the vocabulary manager
     * @param {string} contents the YAML string for the vocabulary
     * @returns {Vocabulary} the vocabulary the was added
     */
    addVocabulary(contents: any): Vocabulary {
        if (!contents) {
            throw new Error('Vocabulary contents must be specified');
        }
        const voc = new Vocabulary(this, YAML.parse(contents));

        const existing = Object.values(this.vocabularies).find(v => v.getIdentifier() === voc.getIdentifier());
        if (existing) {
            throw new Error('Vocabulary has already been added.');
        }
        this.vocabularies[voc.getIdentifier()] = voc;
        return voc;
    }

    /**
     * Finds the vocabulary for a requested locale, removing language
     * identifiers from the locale until the locale matches, or if no
     * vocabulary is found, null is returned
     * @param {string} requestedLocale the BCP-47 locale identifier
     * @param {Vocabulary[]} vocabularies the vocabularies to match against
     * @param {*} [options] options to configure vocabulary lookup
     * @param {*} [options.localeMatcher] Pass 'lookup' to find a general vocabulary, if available
     * @returns {Vocabulary} the most specific vocabulary, or null
     */
    static findVocabulary(requestedLocale: string, vocabularies: Vocabulary[], options?: any): Vocabulary | null {
        let locale = requestedLocale;
        let done = false;
        do {
            const voc = vocabularies.find(v => v.getLocale() === locale);
            if (voc) {
                return voc;
            }

            if (options?.localeMatcher !== 'lookup') {
                done = true;
                break;
            }

            const pos = locale.lastIndexOf('-');
            if (pos === -1) {
                done = true;
                break;
            }
            locale = locale.substring(0, pos);
        } while (!done);
        return null;
    }

    /**
     * Gets a vocabulary for a given namespace plus locale
     * @param {string} namespace the namespace for the vocabulary
     * @param {string} locale the BCP-47 locale identifier
     * @param {*} [options] options to configure vocabulary lookup
     * @param {*} [options.localeMatcher] Pass 'lookup' to find a general vocabulary, if available
     * @returns {Vocabulary} the vocabulary or null if no vocabulary exists for the locale
     */
    getVocabulary(namespace: string, locale: string, options?: any): Vocabulary | null {
        const vocs = this.getVocabulariesForNamespace(namespace);
        return VocabularyManager.findVocabulary(locale.toLowerCase(), vocs, options);
    }

    /**
     * Gets all the vocabulary files for a given namespace
     * @param {string} namespace the namespace
     * @returns {Vocabulary[]} the array of vocabularies
     */
    getVocabulariesForNamespace(namespace: string): Vocabulary[] {
        return Object.values(this.vocabularies).filter(v => v.getNamespace() === namespace);
    }

    /**
     * Gets all the vocabulary files for a given locale
     * @param {string} locale the BCP-47 locale identifier
     * @returns {Vocabulary[]} the array of vocabularies
     */
    getVocabulariesForLocale(locale: string): Vocabulary[] {
        return Object.values(this.vocabularies).filter(v => v.getLocale() === locale.toLowerCase());
    }

    /**
     * Resolve the term for a property, looking up terms from a more general vocabulary
     * if required, and resolving properties using an object manager, allowing terms defined
     * on super types to be automatically resolved.
     * @param {ModelManager} modelManager the model manager
     * @param {string} namespace the namespace
     * @param {string} locale the BCP-47 locale identifier
     * @param {string} declarationName the name of a concept or enum
     * @param {string} [propertyName] the name of a property (optional)
     * @param {string} [identifier] the identifier of the term (optional)
     * @returns {string} the term or null if it does not exist
     */
    resolveTerm(modelManager: ModelManager, namespace: string, locale: string, declarationName: string, propertyName?: string, identifier?: string): string | null {
        const modelFile = modelManager.getModelFile(namespace);
        // @ts-ignore
        const classDecl = modelFile ? (modelFile as any).getType(declarationName) : null;
        const property = propertyName ? classDecl ? classDecl.getProperty(propertyName) : null : null;
        return this.getTerm(property ? property.getNamespace() : namespace, locale, property ? (property.getParent() as any).getName() : declarationName, propertyName, identifier);
    }

    /**
     * Resolve the terms for a property, looking up terms from a more general vocabulary
     * if required, and resolving properties using an object manager, allowing terms defined
     * on super types to be automatically resolved.
     * @param {ModelManager} modelManager the model manager
     * @param {string} namespace the namespace
     * @param {string} locale the BCP-47 locale identifier
     * @param {string} declarationName the name of a concept or enum
     * @param {string} [propertyName] the name of a property (optional)
     * @returns {*} the terms or null if it does not exist
     */
    resolveTerms(modelManager: ModelManager, namespace: string, locale: string, declarationName: string, propertyName?: string) {
        const modelFile = modelManager.getModelFile(namespace);
        // @ts-ignore
        const classDecl = modelFile ? (modelFile as any).getType(declarationName) : null;
        let property;
        if(classDecl && !classDecl.isScalarDeclaration()) {
            if(classDecl.isMapDeclaration()) {
                if(propertyName === 'KEY') {
                    property = classDecl.getKey();
                } else if(propertyName === 'VALUE') {
                    property = classDecl.getValue();
                }
            } else {
                property = propertyName ? classDecl ? classDecl.getProperty(propertyName) : null : null;
            }
        }
        return this.getTerms(property ? property.getNamespace() : namespace, locale, property ? (property.getParent() as any).getName() : declarationName, propertyName);
    }

    /**
     * Gets the term for a concept, enum or property, looking up terms
     * from a more general vocabulary if required
     * @param {string} namespace the namespace
     * @param {string} locale the BCP-47 locale identifier
     * @param {string} declarationName the name of a concept or enum
     * @param {string} [propertyName] the name of a property (optional)
     * @param {string} [identifier] the identifier of the term (optional)
     * @returns {string} the term or null if it does not exist
     */
    getTerm(namespace: string, locale: string, declarationName: string, propertyName?: string, identifier?: string): string | null {
        const voc = this.getVocabulary(namespace, locale);
        let term = null;
        if (voc) {
            term = voc.getTerm(declarationName, propertyName, identifier);
        }
        if (term) {
            return term;
        }
        else {
            const dashIndex = locale.lastIndexOf('-');
            if (dashIndex >= 0) {
                return this.getTerm(namespace, locale.substring(0, dashIndex), declarationName, propertyName, identifier);
            }
            else {
                return this.missingTermGenerator ? this.missingTermGenerator(namespace, locale, declarationName, propertyName) : null;
            }
        }
    }

    /**
     * Gets the term for a concept, enum or property, looking up terms
     * from a more general vocabulary if required
     * @param {string} namespace the namespace
     * @param {string} locale the BCP-47 locale identifier
     * @param {string} declarationName the name of a concept or enum
     * @param {string} [propertyName] the name of a property (optional)
     * @returns {*} the terms or null if it does not exist
     */
    getTerms(namespace: string, locale: string, declarationName: string, propertyName?: string): any {
        const voc = this.getVocabulary(namespace, locale);
        let term = null;
        if (voc) {
            term = voc.getElementTerms(declarationName, propertyName);
        }
        if (term) {
            return term;
        }
        else {
            const dashIndex = locale.lastIndexOf('-');
            if (dashIndex >= 0) {
                return this.getTerms(namespace, locale.substring(0, dashIndex), declarationName, propertyName);
            }
            else {
                let missingKey = propertyName ? propertyName : declarationName;
                // @ts-ignore
                if(DecoratorManager.isNamespaceTargetEnabled(this.enableDcsNamespaceTarget)){
                    missingKey = missingKey? missingKey : 'term';
                }
                return this.missingTermGenerator ? { [missingKey]: this.missingTermGenerator(namespace, locale, declarationName, propertyName) } : null;
            }
        }
    }

    /**
     * Creates a DecoractorCommandSet with @Term decorators
     * to decorate all model elements based on the vocabulary for a locale.
     * Pass the return value to the DecoratorManager.decorateModel to apply
     * the decorators to a ModelManager.
     * @param {ModelManager} modelManager - the Model Manager
     * @param {string} locale the BCP-47 locale identifier
     * @returns {*} the decorator command set used to decorate the model.
     */
    generateDecoratorCommands(modelManager: ModelManager, locale: string): any {
        const decoratorCommandSet: any = {
            '$class': `${DC_NAMESPACE}.DecoratorCommandSet`,
            'name': `terms-${locale}`,
            'version': '1.0.0',
            'commands': []
        };

        const getPropertyNames = (declaration: any) => {
            if (declaration.getProperties) {
                return declaration.getProperties().map((property: any) => property.getName());
            } else if(declaration.isMapDeclaration?.()) {
                return ['KEY', 'VALUE'];
            } else {
                return [];
            }
        };

        // @ts-ignore
        (modelManager as any).getModelFiles().forEach((model: any) => {
            // @ts-ignore
            if(DecoratorManager.isNamespaceTargetEnabled(this.enableDcsNamespaceTarget)) {
                const terms = this.resolveTerms(modelManager, model.getNamespace(), locale, ''); 
                if (terms) {
                    Object.keys(terms).forEach( term => {
                        if(term === 'term') {
                            decoratorCommandSet.commands.push({
                                '$class': `${DC_NAMESPACE}.Command`,
                                'type': 'UPSERT',
                                'target': {
                                    '$class': `${DC_NAMESPACE}.CommandTarget`,
                                    'namespace': model.getNamespace(),
                                },
                                'decorator': {
                                    '$class': `${MetaModelNamespace}.Decorator`,
                                    'name': 'Term',
                                    'arguments': [
                                        {
                                            '$class': `${MetaModelNamespace}.DecoratorString`,
                                            'value': terms[term]
                                        },
                                    ]
                                }
                            });
                        }
                        else if(term.localeCompare('declarations') && term.localeCompare('namespace') && term.localeCompare('locale')) {
                            decoratorCommandSet.commands.push({
                                '$class': `${DC_NAMESPACE}.Command`,
                                'type': 'UPSERT',
                                'target': {
                                    '$class': `${DC_NAMESPACE}.CommandTarget`,
                                    'namespace': model.getNamespace(),
                                },
                                'decorator': {
                                    '$class': `${MetaModelNamespace}.Decorator`,
                                    'name': `Term_${term}`,
                                    'arguments': [
                                        {
                                            '$class': `${MetaModelNamespace}.DecoratorString`,
                                            'value': terms[term]
                                        },
                                    ]
                                }
                            });
                        }
                    });
                }
            }
            model.getAllDeclarations().forEach((decl: any) => {
                const terms = this.resolveTerms(modelManager, model.getNamespace(), locale, decl.getName());
                if (terms) {
                    Object.keys(terms).forEach( term => {
                        if(term === decl.getName()) {
                            decoratorCommandSet.commands.push({
                                '$class': `${DC_NAMESPACE}.Command`,
                                'type': 'UPSERT',
                                'target': {
                                    '$class': `${DC_NAMESPACE}.CommandTarget`,
                                    'namespace': model.getNamespace(),
                                    'declaration': decl.getName(),
                                },
                                'decorator': {
                                    '$class': `${MetaModelNamespace}.Decorator`,
                                    'name': 'Term',
                                    'arguments': [
                                        {
                                            '$class': `${MetaModelNamespace}.DecoratorString`,
                                            'value': terms[term]
                                        },
                                    ]
                                }
                            });
                        }
                        else if(term.localeCompare('properties')) {
                            decoratorCommandSet.commands.push({
                                '$class': `${DC_NAMESPACE}.Command`,
                                'type': 'UPSERT',
                                'target': {
                                    '$class': `${DC_NAMESPACE}.CommandTarget`,
                                    'namespace': model.getNamespace(),
                                    'declaration': decl.getName(),
                                },
                                'decorator': {
                                    '$class': `${MetaModelNamespace}.Decorator`,
                                    'name': `Term_${term}`,
                                    'arguments': [
                                        {
                                            '$class': `${MetaModelNamespace}.DecoratorString`,
                                            'value': terms[term]
                                        },
                                    ]
                                }
                            });
                        }
                    });
                }

                const propertyNames = getPropertyNames(decl);
                propertyNames.forEach((propertyName: string) => {
                    const propertyTerms = this.resolveTerms(modelManager, model.getNamespace(), locale, decl.getName(), propertyName);
                    if (propertyTerms) {
                        Object.keys(propertyTerms).forEach( term => {
                            const propertyType = propertyName === 'KEY' || propertyName === 'VALUE'  ? 'mapElement' : 'property';
                            if(term === propertyName) {
                                decoratorCommandSet.commands.push({
                                    '$class': `${DC_NAMESPACE}.Command`,
                                    'type': 'UPSERT',
                                    'target': {
                                        '$class': `${DC_NAMESPACE}.CommandTarget`,
                                        'namespace': model.getNamespace(),
                                        'declaration': decl.getName(),
                                        [propertyType]: propertyName
                                    },
                                    'decorator': {
                                        '$class': `${MetaModelNamespace}.Decorator`,
                                        'name': 'Term',
                                        'arguments': [
                                            {
                                                '$class': `${MetaModelNamespace}.DecoratorString`,
                                                'value': propertyTerms[term]
                                            },
                                        ]
                                    }
                                });
                            }
                            else {
                                decoratorCommandSet.commands.push({
                                    '$class': `${DC_NAMESPACE}.Command`,
                                    'type': 'UPSERT',
                                    'target': {
                                        '$class': `${DC_NAMESPACE}.CommandTarget`,
                                        'namespace': model.getNamespace(),
                                        'declaration': decl.getName(),
                                        [propertyType]: propertyName
                                    },
                                    'decorator': {
                                        '$class': `${MetaModelNamespace}.Decorator`,
                                        'name': `Term_${term}`,
                                        'arguments': [
                                            {
                                                '$class': `${MetaModelNamespace}.DecoratorString`,
                                                'value': propertyTerms[term]
                                            },
                                        ]
                                    }
                                });
                            }
                        });
                    }
                });
            });
        });
        return decoratorCommandSet;
    }

    /**
     * Validates the terms in the vocabulary against the namespaces and declarations
     * within a ModelManager
     * @param {ModelManager} modelManager - the Model Manager
     * @param {string} locale the BCP-47 locale identifier
     * @returns {*} the result of validation
     */
    validate(modelManager: ModelManager): any {
        // missing vocabularies
        // @ts-ignore
        const missingVocabularies = (modelManager as any).getModelFiles()
            .map((m: any) => this.getVocabulariesForNamespace(m.getNamespace()).length === 0 ? m.getNamespace() : null)
            .filter((m: any) => m !== null);

        // additional vocabularies
        const additionalVocabularies = Object.values(this.vocabularies)
            .filter(v => !modelManager.getModelFile(v.getNamespace()));

        const result: any = {
            missingVocabularies,
            additionalVocabularies,
            vocabularies: {}
        };

        // validate the models against the vocs
        Object.values(this.vocabularies)
            .forEach(voc => {
                const vocResult: any = {
                    locale: voc.getLocale(),
                    namespace: voc.getNamespace(),
                    missingTerms: [],
                    additionalTerms: []
                };

                const model = modelManager.getModelFile(voc.getNamespace());
                if (model) {
                    const errors = voc.validate(model);
                    if (errors.missingTerms) {
                        vocResult.missingTerms = vocResult.missingTerms.concat(errors.missingTerms);
                    }
                    if (errors.additionalTerms) {
                        vocResult.additionalTerms = vocResult.additionalTerms.concat(errors.additionalTerms);
                    }

                    result.vocabularies[`${vocResult.namespace}/${vocResult.locale}`] = vocResult;
                }
            });
        return result;
    }
}

export = VocabularyManager;