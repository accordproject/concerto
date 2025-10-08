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

const { Printer } = require('../src');

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
});
