/*
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const DcsIndexWrapper = require('../lib/DcsIndexWrapper');

const chai = require('chai');
require('chai').should();

describe('DcsIndexWrapper', function() {
    describe('constructor', function() {
        it('should correctly assign command and index properties', function() {
            const command = {
                '$class' : 'org.accordproject.decoratorcommands@0.3.0.Command',
                'type' : 'UPSERT',
                'target' : {
                    '$class' : 'org.accordproject.decoratorcommands@0.3.0.CommandTarget',
                    'namespace' : 'test@1.0.0',
                    'declaration' : 'Dictionary',
                    'type' : 'concerto.metamodel@1.0.0.StringMapKeyType'
                },
                'decorator' : {
                    '$class' : 'concerto.metamodel@1.0.0.Decorator',
                    'name' : 'DecoratesKeyByType',
                    'arguments' : []
                }
            };
            const index = 5;
            const wrapper = new DcsIndexWrapper(command, index);

            chai.expect(wrapper.getCommand()).to.deep.equal(command);
            chai.expect(wrapper.getIndex()).to.equal(index);
        });
    });
});