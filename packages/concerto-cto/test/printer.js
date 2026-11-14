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

const fs = require('fs');
const chai = require('chai');

// eslint-disable-next-line no-unused-vars
const should = chai.should();
chai.use(require('chai-things'));
chai.use(require('chai-as-promised'));

const { Printer, Parser } = require('../src');

/**
 * Get the name and content of all cto files
 * @returns {*} an array of name/content tuples
 */
function getCTOFiles() {
    const result = [];
    const files = fs.readdirSync('./test/cto');

    files.forEach(function(file) {
        if(file.endsWith('.json') && !file.endsWith('.no-location.json')) {
            const ctoFile = file.split('.').slice(0, -1).join('.') + '.cto';
            const content = fs.readFileSync('./test/cto/' + ctoFile, 'utf8').trimEnd();
            const ast = fs.readFileSync('./test/cto/' + file, 'utf8');
            result.push({file, content, ast});
        }
    });

    return result;
}

describe('parser', () => {
    getCTOFiles().forEach(({ file, content, ast }) => {
        it(`Should print ${file}`, () => {
            const cto = Printer.toCTO(JSON.parse(ast)).trimEnd();
            cto.should.equal(content);
        });
    });

    it('Should throw error for invalid import', () => {
        (() => Printer.toCTO({
            $class: 'concerto.metamodel@1.0.0.Model',
            namespace: 'org.acme@1.0.0',
            imports: [{
                $class: 'foo'
            }],
            declarations: [],
        })).should.throw(Error, 'Unrecognized import');
    });

    it('Should throw error for a self-extending declaration', () => {
        (() => Printer.toCTO({
            '$class': 'concerto.metamodel@1.0.0.Model',
            'namespace': 'com.acme@1.0.0',
            'declarations': [
                {
                    '$class': 'concerto.metamodel@1.0.0.AssetDeclaration',
                    'name': 'Self_Extending',
                    'isAbstract': false,
                    'properties': [
                        {
                            '$class': 'concerto.metamodel@1.0.0.StringProperty',
                            'name': 'foo',
                            'isArray': false,
                            'isOptional': true
                        }
                    ],
                    'superType': {
                        '$class': 'concerto.metamodel@1.0.0.TypeIdentifier',
                        'name': 'Self_Extending'
                    }
                }
            ]
        })).should.throw(Error, 'The declaration "Self_Extending" cannot extend itself.');
    });

    it('Should escape quotes and backslashes in String default values', () => {
        const cto = Printer.toCTO({
            $class: 'concerto.metamodel@1.0.0.Model',
            namespace: 'org.acme@1.0.0',
            imports: [],
            declarations: [{
                $class: 'concerto.metamodel@1.0.0.ConceptDeclaration',
                name: 'C',
                isAbstract: false,
                properties: [{
                    $class: 'concerto.metamodel@1.0.0.StringProperty',
                    name: 'quoted',
                    isArray: false,
                    isOptional: false,
                    defaultValue: 'he said "hi"'
                }, {
                    $class: 'concerto.metamodel@1.0.0.StringProperty',
                    name: 'slashed',
                    isArray: false,
                    isOptional: false,
                    defaultValue: 'a\b'
                }]
            }],
        });
        cto.should.include('default="he said \\"hi\\""');
        cto.should.include('default="a\\b"');
    });

    it('Should produce parseable CTO for String defaults containing quotes', () => {
        const cto = Printer.toCTO({
            $class: 'concerto.metamodel@1.0.0.Model',
            namespace: 'org.acme@1.0.0',
            imports: [],
            declarations: [{
                $class: 'concerto.metamodel@1.0.0.ConceptDeclaration',
                name: 'C',
                isAbstract: false,
                properties: [{
                    $class: 'concerto.metamodel@1.0.0.StringProperty',
                    name: 'quoted',
                    isArray: false,
                    isOptional: false,
                    defaultValue: 'he said "hi"'
                }]
            }],
        });
        const reparsed = Parser.parse(cto);
        reparsed.declarations[0].properties[0].defaultValue.should.equal('he said "hi"');
    });

    it('Should escape quotes in decorator string arguments', () => {
        const cto = Printer.toCTO({
            $class: 'concerto.metamodel@1.0.0.Model',
            namespace: 'org.acme@1.0.0',
            imports: [],
            declarations: [{
                $class: 'concerto.metamodel@1.0.0.ConceptDeclaration',
                name: 'C',
                isAbstract: false,
                decorators: [{
                    $class: 'concerto.metamodel@1.0.0.Decorator',
                    name: 'Term',
                    arguments: [{
                        $class: 'concerto.metamodel@1.0.0.DecoratorString',
                        value: 'he said "hi"'
                    }]
                }],
                properties: []
            }],
        });
        const reparsed = Parser.parse(cto);
        reparsed.declarations[0].decorators[0].arguments[0].value.should.equal('he said "hi"');
    });

    it('Should escape forward slashes and line terminators in regex validators', () => {
        const cto = Printer.toCTO({
            $class: 'concerto.metamodel@1.0.0.Model',
            namespace: 'org.acme@1.0.0',
            imports: [],
            declarations: [{
                $class: 'concerto.metamodel@1.0.0.ConceptDeclaration',
                name: 'C',
                isAbstract: false,
                properties: [{
                    $class: 'concerto.metamodel@1.0.0.StringProperty',
                    name: 'path',
                    isArray: false,
                    isOptional: false,
                    validator: {
                        $class: 'concerto.metamodel@1.0.0.StringRegexValidator',
                        pattern: 'a/b',
                        flags: ''
                    }
                }]
            }],
        });
        cto.should.include('regex=/a\\/b/');
        const reparsed = Parser.parse(cto);
        const pattern = reparsed.declarations[0].properties[0].validator.pattern;
        new RegExp(pattern).test('a/b').should.equal(true);
    });

    it('Should handle ImportTypes with aliased types', () => {
        const result = Printer.toCTO({
            $class: 'concerto.metamodel@1.0.0.Model',
            namespace: 'org.acme@1.0.0',
            imports: [{
                $class: 'concerto.metamodel@1.0.0.ImportTypes',
                namespace: 'org.example@1.0.0',
                types: ['Person', 'Address'],
                aliasedTypes: [
                    { name: 'Person', aliasedName: 'Individual' },
                    { name: 'Address', aliasedName: 'Location' }
                ],
                uri: 'https://example.org/models/example.cto'
            }],
            declarations: [],
        });
        result.should.include('import org.example@1.0.0.{Person as Individual,Address as Location}');
        result.should.include('from https://example.org/models/example.cto');
    });

    it('Should handle ImportAll type', () => {
        const result = Printer.toCTO({
            $class: 'concerto.metamodel@1.0.0.Model',
            namespace: 'org.acme@1.0.0',
            imports: [{
                $class: 'concerto.metamodel@1.0.0.ImportAll',
                namespace: 'org.example@1.0.0',
                uri: 'https://example.org/models/example.cto'
            }],
            declarations: [],
        });
        result.should.include('import org.example@1.0.0.*');
        result.should.include('from https://example.org/models/example.cto');
    });

    it('Should skip ImportTypes with empty types array', () => {
        const result = Printer.toCTO({
            $class: 'concerto.metamodel@1.0.0.Model',
            namespace: 'org.acme@1.0.0',
            imports: [{
                $class: 'concerto.metamodel@1.0.0.ImportTypes',
                namespace: 'org.example@1.0.0',
                types: [],
                aliasedTypes: []
            }],
            declarations: [],
        });
        result.should.not.include('import org.example');
    });

    it('Should skip ImportTypes with empty types array and orphaned aliasedTypes', () => {
        const result = Printer.toCTO({
            $class: 'concerto.metamodel@1.0.0.Model',
            namespace: 'org.acme@1.0.0',
            imports: [{
                $class: 'concerto.metamodel@1.0.0.ImportTypes',
                namespace: 'org.example@1.0.0',
                types: [],
                aliasedTypes: [
                    { name: 'Person', aliasedName: 'Individual' }
                ]
            }],
            declarations: [],
        });
        result.should.not.include('import org.example');
        result.should.not.include('Person');
        result.should.not.include('Individual');
    });

    it('Should not print aliases for types that were filtered out', () => {
        const result = Printer.toCTO({
            $class: 'concerto.metamodel@1.0.0.Model',
            namespace: 'org.acme@1.0.0',
            imports: [{
                $class: 'concerto.metamodel@1.0.0.ImportTypes',
                namespace: 'org.example@1.0.0',
                types: ['Address'],
                aliasedTypes: [
                    { name: 'Person', aliasedName: 'Individual' }
                ]
            }],
            declarations: [],
        });
        result.should.include('import org.example@1.0.0.{Address}');
        result.should.not.include('Person');
        result.should.not.include('Individual');
    });

    it('Should print Double range bounds using decimal notation', () => {
        const result = Printer.toCTO({
            $class: 'concerto.metamodel@1.0.0.Model',
            namespace: 'org.acme@1.0.0',
            declarations: [
                {
                    $class: 'concerto.metamodel@1.0.0.ConceptDeclaration',
                    name: 'Sample',
                    isAbstract: false,
                    properties: [
                        {
                            $class: 'concerto.metamodel@1.0.0.DoubleProperty',
                            name: 'value',
                            isArray: false,
                            isOptional: false,
                            validator: {
                                $class: 'concerto.metamodel@1.0.0.DoubleDomainValidator',
                                lower: 0,
                                upper: 1
                            }
                        }
                    ]
                }
            ]
        });

        result.should.include('o Double value range=[0.0,1.0]');
    });

    it('Should print scientific notation Double range bounds without rounding to zero', () => {
        const result = Printer.toCTO({
            $class: 'concerto.metamodel@1.0.0.Model',
            namespace: 'org.acme@1.0.0',
            declarations: [
                {
                    $class: 'concerto.metamodel@1.0.0.ConceptDeclaration',
                    name: 'Sample',
                    isAbstract: false,
                    properties: [
                        {
                            $class: 'concerto.metamodel@1.0.0.DoubleProperty',
                            name: 'value',
                            isArray: false,
                            isOptional: false,
                            validator: {
                                $class: 'concerto.metamodel@1.0.0.DoubleDomainValidator',
                                lower: 1e-7,
                                upper: 1
                            }
                        }
                    ]
                }
            ]
        });

        result.should.include('o Double value range=[0.0000001,1.0]');
    });

    it('Should not print default value when defaultValue is null', () => {
        const result = Printer.toCTO({
            $class: 'concerto.metamodel@1.0.0.Model',
            namespace: 'org.acme@1.0.0',
            declarations: [
                {
                    $class: 'concerto.metamodel@1.0.0.ConceptDeclaration',
                    name: 'Sample',
                    isAbstract: false,
                    properties: [
                        {
                            $class: 'concerto.metamodel@1.0.0.IntegerProperty',
                            name: 'intProp',
                            isArray: false,
                            isOptional: false,
                            defaultValue: null
                        },
                        {
                            $class: 'concerto.metamodel@1.0.0.LongProperty',
                            name: 'longProp',
                            isArray: false,
                            isOptional: false,
                            defaultValue: null
                        },
                        {
                            $class: 'concerto.metamodel@1.0.0.DoubleProperty',
                            name: 'doubleProp',
                            isArray: false,
                            isOptional: false,
                            defaultValue: null
                        },
                        {
                            $class: 'concerto.metamodel@1.0.0.StringProperty',
                            name: 'stringProp',
                            isArray: false,
                            isOptional: false,
                            defaultValue: null
                        },
                        {
                            $class: 'concerto.metamodel@1.0.0.DateTimeProperty',
                            name: 'dateTimeProp',
                            isArray: false,
                            isOptional: false,
                            defaultValue: null
                        },
                        {
                            $class: 'concerto.metamodel@1.0.0.ObjectProperty',
                            name: 'objProp',
                            type: {
                                $class: 'concerto.metamodel@1.0.0.TypeIdentifier',
                                name: 'Sample'
                            },
                            isArray: false,
                            isOptional: false,
                            defaultValue: null
                        }
                    ]
                },
                {
                    $class: 'concerto.metamodel@1.0.0.IntegerScalar',
                    name: 'IntScalar',
                    defaultValue: null
                },
                {
                    $class: 'concerto.metamodel@1.0.0.DoubleScalar',
                    name: 'DoubleScalar',
                    defaultValue: null
                },
                {
                    $class: 'concerto.metamodel@1.0.0.StringScalar',
                    name: 'StringScalar',
                    defaultValue: null
                }
            ]
        });

        result.should.not.include('default=');
        const reparsed = Parser.parse(result);
        reparsed.declarations[0].properties.forEach((p) => {
            should.not.exist(p.defaultValue);
        });
    });

    it('Should print falsy default values correctly', () => {
        const result = Printer.toCTO({
            $class: 'concerto.metamodel@1.0.0.Model',
            namespace: 'org.acme@1.0.0',
            declarations: [
                {
                    $class: 'concerto.metamodel@1.0.0.ConceptDeclaration',
                    name: 'Sample',
                    isAbstract: false,
                    properties: [
                        {
                            $class: 'concerto.metamodel@1.0.0.IntegerProperty',
                            name: 'zeroInt',
                            isArray: false,
                            isOptional: false,
                            defaultValue: 0
                        },
                        {
                            $class: 'concerto.metamodel@1.0.0.DoubleProperty',
                            name: 'zeroDouble',
                            isArray: false,
                            isOptional: false,
                            defaultValue: 0
                        },
                        {
                            $class: 'concerto.metamodel@1.0.0.StringProperty',
                            name: 'emptyStr',
                            isArray: false,
                            isOptional: false,
                            defaultValue: ''
                        },
                        {
                            $class: 'concerto.metamodel@1.0.0.BooleanProperty',
                            name: 'falseBool',
                            isArray: false,
                            isOptional: false,
                            defaultValue: false
                        }
                    ]
                }
            ]
        });

        result.should.include('o Integer zeroInt default=0');
        result.should.include('o Double zeroDouble default=0.0');
        result.should.include('o String emptyStr default=""');
        result.should.include('o Boolean falseBool default=false');
        const reparsed = Parser.parse(result);
        reparsed.declarations[0].properties[0].defaultValue.should.equal(0);
        reparsed.declarations[0].properties[1].defaultValue.should.equal(0);
        reparsed.declarations[0].properties[2].defaultValue.should.equal('');
        reparsed.declarations[0].properties[3].defaultValue.should.equal(false);
    });

    it('Should print single-bounded validator ranges when other bound is null', () => {
        const result = Printer.toCTO({
            $class: 'concerto.metamodel@1.0.0.Model',
            namespace: 'org.acme@1.0.0',
            declarations: [
                {
                    $class: 'concerto.metamodel@1.0.0.ConceptDeclaration',
                    name: 'Sample',
                    isAbstract: false,
                    properties: [
                        {
                            $class: 'concerto.metamodel@1.0.0.IntegerProperty',
                            name: 'intLowerOnly',
                            isArray: false,
                            isOptional: false,
                            validator: {
                                $class: 'concerto.metamodel@1.0.0.IntegerDomainValidator',
                                lower: 10,
                                upper: null
                            }
                        },
                        {
                            $class: 'concerto.metamodel@1.0.0.IntegerProperty',
                            name: 'intUpperOnly',
                            isArray: false,
                            isOptional: false,
                            validator: {
                                $class: 'concerto.metamodel@1.0.0.IntegerDomainValidator',
                                lower: null,
                                upper: 10
                            }
                        },
                        {
                            $class: 'concerto.metamodel@1.0.0.LongProperty',
                            name: 'longLowerOnly',
                            isArray: false,
                            isOptional: false,
                            validator: {
                                $class: 'concerto.metamodel@1.0.0.LongDomainValidator',
                                lower: 100,
                                upper: null
                            }
                        },
                        {
                            $class: 'concerto.metamodel@1.0.0.LongProperty',
                            name: 'longUpperOnly',
                            isArray: false,
                            isOptional: false,
                            validator: {
                                $class: 'concerto.metamodel@1.0.0.LongDomainValidator',
                                lower: null,
                                upper: 100
                            }
                        },
                        {
                            $class: 'concerto.metamodel@1.0.0.DoubleProperty',
                            name: 'doubleLowerOnly',
                            isArray: false,
                            isOptional: false,
                            validator: {
                                $class: 'concerto.metamodel@1.0.0.DoubleDomainValidator',
                                lower: 5.5,
                                upper: null
                            }
                        },
                        {
                            $class: 'concerto.metamodel@1.0.0.DoubleProperty',
                            name: 'doubleUpperOnly',
                            isArray: false,
                            isOptional: false,
                            validator: {
                                $class: 'concerto.metamodel@1.0.0.DoubleDomainValidator',
                                lower: null,
                                upper: 5.5
                            }
                        },
                        {
                            $class: 'concerto.metamodel@1.0.0.StringProperty',
                            name: 'strMinOnly',
                            isArray: false,
                            isOptional: false,
                            lengthValidator: {
                                $class: 'concerto.metamodel@1.0.0.StringLengthValidator',
                                minLength: 3,
                                maxLength: null
                            }
                        },
                        {
                            $class: 'concerto.metamodel@1.0.0.StringProperty',
                            name: 'strMaxOnly',
                            isArray: false,
                            isOptional: false,
                            lengthValidator: {
                                $class: 'concerto.metamodel@1.0.0.StringLengthValidator',
                                minLength: null,
                                maxLength: 10
                            }
                        },
                        {
                            $class: 'concerto.metamodel@1.0.0.StringProperty',
                            name: 'arraySizeMinOnly',
                            isArray: true,
                            isOptional: false,
                            sizeValidator: {
                                $class: 'concerto.metamodel@1.0.0.CollectionSizeValidator',
                                minSize: 1,
                                maxSize: null
                            }
                        },
                        {
                            $class: 'concerto.metamodel@1.0.0.StringProperty',
                            name: 'arraySizeMaxOnly',
                            isArray: true,
                            isOptional: false,
                            sizeValidator: {
                                $class: 'concerto.metamodel@1.0.0.CollectionSizeValidator',
                                minSize: null,
                                maxSize: 5
                            }
                        }
                    ]
                }
            ]
        });

        result.should.include('o Integer intLowerOnly range=[10,]');
        result.should.include('o Integer intUpperOnly range=[,10]');
        result.should.include('o Long longLowerOnly range=[100,]');
        result.should.include('o Long longUpperOnly range=[,100]');
        result.should.include('o Double doubleLowerOnly range=[5.5,]');
        result.should.include('o Double doubleUpperOnly range=[,5.5]');
        result.should.include('o String strMinOnly length=[3,]');
        result.should.include('o String strMaxOnly length=[,10]');
        result.should.include('o String[] arraySizeMinOnly size=[1,]');
        result.should.include('o String[] arraySizeMaxOnly size=[,5]');

        const reparsed = Parser.parse(result);
        reparsed.declarations[0].properties[0].validator.lower.should.equal(10);
        should.not.exist(reparsed.declarations[0].properties[0].validator.upper);
        reparsed.declarations[0].properties[1].validator.upper.should.equal(10);
        should.not.exist(reparsed.declarations[0].properties[1].validator.lower);
        reparsed.declarations[0].properties[4].validator.lower.should.equal(5.5);
        should.not.exist(reparsed.declarations[0].properties[4].validator.upper);
        reparsed.declarations[0].properties[5].validator.upper.should.equal(5.5);
        should.not.exist(reparsed.declarations[0].properties[5].validator.lower);
    });

    it('Should normalize and escape regex pattern when flags is null', () => {
        const result = Printer.toCTO({
            $class: 'concerto.metamodel@1.0.0.Model',
            namespace: 'org.acme@1.0.0',
            declarations: [
                {
                    $class: 'concerto.metamodel@1.0.0.ConceptDeclaration',
                    name: 'Sample',
                    isAbstract: false,
                    properties: [
                        {
                            $class: 'concerto.metamodel@1.0.0.StringProperty',
                            name: 'path',
                            isArray: false,
                            isOptional: false,
                            validator: {
                                $class: 'concerto.metamodel@1.0.0.StringRegexValidator',
                                pattern: 'foo/bar',
                                flags: null
                            }
                        }
                    ]
                }
            ]
        });

        result.should.include('regex=/foo\\/bar/');
        const reparsed = Parser.parse(result);
        const pattern = reparsed.declarations[0].properties[0].validator.pattern;
        new RegExp(pattern).test('foo/bar').should.equal(true);
    });

    it('Should not print validators when all bounds or pattern are null or omitted', () => {
        const result = Printer.toCTO({
            $class: 'concerto.metamodel@1.0.0.Model',
            namespace: 'org.acme@1.0.0',
            declarations: [
                {
                    $class: 'concerto.metamodel@1.0.0.ConceptDeclaration',
                    name: 'Sample',
                    isAbstract: false,
                    properties: [
                        {
                            $class: 'concerto.metamodel@1.0.0.DoubleProperty',
                            name: 'doubleProp',
                            isArray: false,
                            isOptional: false,
                            validator: {
                                $class: 'concerto.metamodel@1.0.0.DoubleDomainValidator',
                                lower: null,
                                upper: null
                            }
                        },
                        {
                            $class: 'concerto.metamodel@1.0.0.IntegerProperty',
                            name: 'intProp',
                            isArray: false,
                            isOptional: false,
                            validator: {
                                $class: 'concerto.metamodel@1.0.0.IntegerDomainValidator',
                                lower: null,
                                upper: null
                            }
                        },
                        {
                            $class: 'concerto.metamodel@1.0.0.LongProperty',
                            name: 'longProp',
                            isArray: false,
                            isOptional: false,
                            validator: {
                                $class: 'concerto.metamodel@1.0.0.LongDomainValidator',
                                lower: null,
                                upper: null
                            }
                        },
                        {
                            $class: 'concerto.metamodel@1.0.0.StringProperty',
                            name: 'strProp',
                            isArray: false,
                            isOptional: false,
                            validator: {
                                $class: 'concerto.metamodel@1.0.0.StringRegexValidator',
                                pattern: null,
                                flags: null
                            },
                            lengthValidator: {
                                $class: 'concerto.metamodel@1.0.0.StringLengthValidator',
                                minLength: null,
                                maxLength: null
                            }
                        },
                        {
                            $class: 'concerto.metamodel@1.0.0.StringProperty',
                            name: 'arrayProp',
                            isArray: true,
                            isOptional: false,
                            sizeValidator: {
                                $class: 'concerto.metamodel@1.0.0.CollectionSizeValidator',
                                minSize: null,
                                maxSize: null
                            }
                        }
                    ]
                },
                {
                    $class: 'concerto.metamodel@1.0.0.DoubleScalar',
                    name: 'DoubleScalar',
                    validator: {
                        $class: 'concerto.metamodel@1.0.0.DoubleDomainValidator',
                        lower: null,
                        upper: null
                    }
                },
                {
                    $class: 'concerto.metamodel@1.0.0.IntegerScalar',
                    name: 'IntScalar',
                    validator: {
                        $class: 'concerto.metamodel@1.0.0.IntegerDomainValidator',
                        lower: null,
                        upper: null
                    }
                },
                {
                    $class: 'concerto.metamodel@1.0.0.LongScalar',
                    name: 'LongScalar',
                    validator: {
                        $class: 'concerto.metamodel@1.0.0.LongDomainValidator',
                        lower: null,
                        upper: null
                    }
                },
                {
                    $class: 'concerto.metamodel@1.0.0.StringScalar',
                    name: 'StringScalar',
                    lengthValidator: {
                        $class: 'concerto.metamodel@1.0.0.StringLengthValidator',
                        minLength: null,
                        maxLength: null
                    }
                }
            ]
        });

        result.should.not.include('range=');
        result.should.not.include('length=');
        result.should.not.include('size=');
        result.should.not.include('regex=');
        const reparsed = Parser.parse(result);
        should.exist(reparsed);
    });

    it('Should escape quotes and backslashes in ObjectProperty default values', () => {
        const result = Printer.toCTO({
            $class: 'concerto.metamodel@1.0.0.Model',
            namespace: 'org.acme@1.0.0',
            declarations: [
                {
                    $class: 'concerto.metamodel@1.0.0.ConceptDeclaration',
                    name: 'Sample',
                    isAbstract: false,
                    properties: [
                        {
                            $class: 'concerto.metamodel@1.0.0.ObjectProperty',
                            name: 'objWithQuote',
                            type: {
                                $class: 'concerto.metamodel@1.0.0.TypeIdentifier',
                                name: 'Sample'
                            },
                            isArray: false,
                            isOptional: false,
                            defaultValue: 'hello"world'
                        }
                    ]
                }
            ]
        });

        result.should.include('default="hello\\"world"');
        const reparsed = Parser.parse(result);
        reparsed.declarations[0].properties[0].defaultValue.should.equal('hello"world');
    });

    it('Should handle empty decorators array without inserting spurious newlines or indentation', () => {
        const result = Printer.toCTO({
            $class: 'concerto.metamodel@1.0.0.Model',
            namespace: 'org.acme@1.0.0',
            declarations: [
                {
                    $class: 'concerto.metamodel@1.0.0.ConceptDeclaration',
                    name: 'Sample',
                    isAbstract: false,
                    decorators: [],
                    properties: [
                        {
                            $class: 'concerto.metamodel@1.0.0.StringProperty',
                            name: 'field',
                            isArray: false,
                            isOptional: false,
                            decorators: []
                        }
                    ]
                },
                {
                    $class: 'concerto.metamodel@1.0.0.MapDeclaration',
                    name: 'SampleMap',
                    decorators: [],
                    key: {
                        $class: 'concerto.metamodel@1.0.0.StringMapKeyType',
                        decorators: []
                    },
                    value: {
                        $class: 'concerto.metamodel@1.0.0.StringMapValueType',
                        decorators: []
                    }
                }
            ]
        });

        result.should.equal('namespace org.acme@1.0.0\n\nconcept Sample {\n  o String field\n}\n\nmap SampleMap {\n  o String\n  o String\n}');
        const reparsed = Parser.parse(result);
        should.exist(reparsed);
    });

    it('Should handle concept declaration without properties array', () => {
        const result = Printer.toCTO({
            $class: 'concerto.metamodel@1.0.0.Model',
            namespace: 'org.acme@1.0.0',
            declarations: [
                {
                    $class: 'concerto.metamodel@1.0.0.ConceptDeclaration',
                    name: 'EmptyConcept',
                    isAbstract: false
                }
            ]
        });

        result.should.include('concept EmptyConcept {\n}');
        const reparsed = Parser.parse(result);
        reparsed.declarations[0].name.should.equal('EmptyConcept');
    });
});
