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
chai.use(require('chai-things'));
chai.use(require('chai-as-promised'));

const ModelManager = require('../lib/modelmanager');
const validate = require('../lib/validator').validate;

describe('validator', () => {

    let modelManager;

    beforeEach(() => {
        modelManager = new ModelManager();

        modelManager.addModelFile( `
namespace org.accordproject.test

participant Person identified by ssn {
    o String ssn
}

participant Customer extends Person {
    o String customerId
}

`, 'test.cto');
    });

    afterEach(() => {
    });

    describe('#validate', () => {

        it('should validate a valid obj', () => {
            const obj = {
                $class : 'org.accordproject.test.Customer',
                ssn: '123456789',
                customerId: '001',
            };

            validate(obj, modelManager);
        });

        it('should fail an invalid obj', () => {
            const obj = {
                $class : 'org.accordproject.test.Customer',
                ssn: '123456789',
                name: 'Dan',
            };

            (() => {
                validate(obj, modelManager);
            }).should.throw(/Instance 123456789 has a property named name which is not declared in org.accordproject.test.Customer/);
        });
    });

});
