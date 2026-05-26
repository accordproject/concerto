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

const chai = require('chai');

// eslint-disable-next-line no-unused-vars
const should = chai.should();
chai.use(require('chai-things'));
chai.use(require('chai-as-promised'));

const { Vocabulary } = require('../src');

describe('Vocabulary', () => {

    it('constructor - missing vocabulary manager', () => {
        should.Throw(() => new Vocabulary(), Error);
    });

    it('constructor - missing vocabulary object', () => {
        const vocabularyManager = {};
        should.Throw(() => new Vocabulary(vocabularyManager), Error);
    });

    it('constructor - missing vocabulary declarations', () => {
        const vocabularyManager = {};
        const voc = {};
        should.Throw(() => new Vocabulary(vocabularyManager, voc), Error);
    });

    it('constructor - missing vocabulary locale', () => {
        const vocabularyManager = {};
        const voc = {
            declarations: []
        };
        should.Throw(() => new Vocabulary(vocabularyManager, voc), Error);
    });

    it('constructor - missing vocabulary namespace', () => {
        const vocabularyManager = {};
        const voc = {
            declarations: [],
            locale: 'en'
        };
        should.Throw(() => new Vocabulary(vocabularyManager, voc), Error);
    });

    it('constructor - invalid locale', () => {
        const vocabularyManager = {};
        const voc = {
            declarations: [],
            locale: 'en_US',
            namespace: 'org.acme@1.0.0'
        };
        should.Throw(() => new Vocabulary(vocabularyManager, voc), Error);
    });

    it('constructor - invalid locale case', () => {
        const vocabularyManager = {};
        const voc = {
            declarations: [],
            locale: 'en-US',
            namespace: 'org.acme@1.0.0'
        };
        should.Throw(() => new Vocabulary(vocabularyManager, voc), Error);
    });

    it('constructor', () => {
        const vocabularyManager = {};
        const obj = {
            declarations: [],
            locale: 'en-us',
            namespace: 'org.acme@1.0.0'
        };
        const voc = new Vocabulary(vocabularyManager, obj);
        voc.should.not.be.null;
    });

    it('toJSON', () => {
        const vocabularyManager = {};
        const obj = {
            declarations: [],
            locale: 'en',
            namespace: 'org.acme@1.0.0'
        };
        const voc = new Vocabulary(vocabularyManager, obj);
        const json = voc.toJSON();
        json.should.not.be.null;
    });

    it('isValidLocale - invalid locale', () => {
        should.Throw(() => Vocabulary.validateLocale('en-US'), Error);
    });

    it('isValidLocale - valid locale', () => {
        should.not.Throw(() => Vocabulary.validateLocale('en-us'), Error);
    });

    it('getTerm - without namespace term', () => {
        const vocabularyManager = {};
        const obj = {
            declarations: [],
            locale: 'en',
            namespace: 'org.acme'
        };
        const voc = new Vocabulary(vocabularyManager, obj);
        const term = voc.getTerm();
        should.not.exist(term);
    });

    it('getTerm - namespace term', () => {
        const vocabularyManager = {};
        const obj = {
            declarations: [],
            locale: 'en',
            namespace: 'org.acme',
            term: 'term of org.acme'
        };
        const voc = new Vocabulary(vocabularyManager, obj);
        const term = voc.getTerm();
        should.equal(term, obj.term);
    });

    describe('getTerm / getElementTerms - falsy property values', () => {
        let voc;
        beforeEach(() => {
            voc = new Vocabulary({}, {
                locale: 'en',
                namespace: 'org.falsy@1.0.0',
                declarations: [
                    {
                        Widget: 'A widget',
                        properties: [
                            { enabled: false },
                            { count: 0 },
                            { label: '' }
                        ]
                    },
                    { Flag: false }
                ]
            });
        });

        it('getTerm - property with boolean false value', () => {
            const term = voc.getTerm('Widget', 'enabled');
            term.should.equal(false);
        });

        it('getTerm - property with numeric 0 value', () => {
            const term = voc.getTerm('Widget', 'count');
            term.should.equal(0);
        });

        it('getTerm - property with empty string value', () => {
            const term = voc.getTerm('Widget', 'label');
            term.should.equal('');
        });

        it('getTerm - declaration with boolean false value', () => {
            const term = voc.getTerm('Flag');
            term.should.equal(false);
        });

        it('getElementTerms - property with boolean false value', () => {
            const terms = voc.getElementTerms('Widget', 'enabled');
            should.exist(terms);
            terms.enabled.should.equal(false);
        });

        it('getElementTerms - property with numeric 0 value', () => {
            const terms = voc.getElementTerms('Widget', 'count');
            should.exist(terms);
            terms.count.should.equal(0);
        });

        it('getElementTerms - property with empty string value', () => {
            const terms = voc.getElementTerms('Widget', 'label');
            should.exist(terms);
            terms.label.should.equal('');
        });
    });

    describe('getTerm - property existence checks', () => {
        it('should find property with string value', () => {
            const vocabularyManager = {};
            const obj = {
                declarations: [{
                    TestDecl: 'Test Declaration',
                    properties: [
                        { propWithString: 'a valid string' }
                    ]
                }],
                locale: 'en',
                namespace: 'org.test'
            };
            const voc = new Vocabulary(vocabularyManager, obj);
            const term = voc.getTerm('TestDecl', 'propWithString');
            term.should.equal('a valid string');
        });

        it('should find property with empty string value', () => {
            const vocabularyManager = {};
            const obj = {
                declarations: [{
                    TestDecl: 'Test Declaration',
                    properties: [
                        { propWithEmptyString: '' }
                    ]
                }],
                locale: 'en',
                namespace: 'org.test'
            };
            const voc = new Vocabulary(vocabularyManager, obj);
            const term = voc.getTerm('TestDecl', 'propWithEmptyString');
            term.should.equal('');
        });

        it('should find property with null value', () => {
            const vocabularyManager = {};
            const obj = {
                declarations: [{
                    TestDecl: 'Test Declaration',
                    properties: [
                        { propWithNull: null }
                    ]
                }],
                locale: 'en',
                namespace: 'org.test'
            };
            const voc = new Vocabulary(vocabularyManager, obj);
            const term = voc.getTerm('TestDecl', 'propWithNull');
            (term === null).should.be.true;
        });

        it('should return null for non-existent property', () => {
            const vocabularyManager = {};
            const obj = {
                declarations: [{
                    TestDecl: 'Test Declaration',
                    properties: [
                        { existingProp: 'value' }
                    ]
                }],
                locale: 'en',
                namespace: 'org.test'
            };
            const voc = new Vocabulary(vocabularyManager, obj);
            const term = voc.getTerm('TestDecl', 'nonExistentProp');
            (term === null).should.be.true;
        });
    });

    describe('getElementTerms - property existence checks', () => {
        it('should find property object with string value', () => {
            const vocabularyManager = {};
            const obj = {
                declarations: [{
                    TestDecl: 'Test Declaration',
                    properties: [
                        { propWithString: 'a valid string' }
                    ]
                }],
                locale: 'en',
                namespace: 'org.test'
            };
            const voc = new Vocabulary(vocabularyManager, obj);
            const terms = voc.getElementTerms('TestDecl', 'propWithString');
            terms.propWithString.should.equal('a valid string');
        });

        it('should find property object with empty string value', () => {
            const vocabularyManager = {};
            const obj = {
                declarations: [{
                    TestDecl: 'Test Declaration',
                    properties: [
                        { propWithEmptyString: '' }
                    ]
                }],
                locale: 'en',
                namespace: 'org.test'
            };
            const voc = new Vocabulary(vocabularyManager, obj);
            const terms = voc.getElementTerms('TestDecl', 'propWithEmptyString');
            terms.propWithEmptyString.should.equal('');
        });

        it('should find property object with null value', () => {
            const vocabularyManager = {};
            const obj = {
                declarations: [{
                    TestDecl: 'Test Declaration',
                    properties: [
                        { propWithNull: null }
                    ]
                }],
                locale: 'en',
                namespace: 'org.test'
            };
            const voc = new Vocabulary(vocabularyManager, obj);
            const terms = voc.getElementTerms('TestDecl', 'propWithNull');
            (terms.propWithNull === null).should.be.true;
        });

        it('should return undefined for non-existent property', () => {
            const vocabularyManager = {};
            const obj = {
                declarations: [{
                    TestDecl: 'Test Declaration',
                    properties: [
                        { existingProp: 'value' }
                    ]
                }],
                locale: 'en',
                namespace: 'org.test'
            };
            const voc = new Vocabulary(vocabularyManager, obj);
            const terms = voc.getElementTerms('TestDecl', 'nonExistentProp');
            should.not.exist(terms);
        });
    });
});
