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

const ModelManager = require('../../lib/modelmanager');
const IdentifiedDeclaration = require('../../lib/introspect/identifieddeclaration');

require('chai').should();

describe('IdentifiedDeclaration', () => {

    beforeEach(() => {
    });

    afterEach(() => {
    });

    describe('#hasInstance', () => {

        it('should identify instance', () => {
            const mm = new ModelManager();
            mm.addModelFile( `
namespace test

asset Order {
    o Double price
}
            `, 'test.cto');

            const order = mm.getType('test.Order');
            order.should.not.be.null;
            (order instanceof IdentifiedDeclaration).should.be.true;
        });
    });

    describe('#identified', () => {

        it('should create a system identifier', () => {
            const mm = new ModelManager();
            mm.addModelFile( `
namespace test

asset Order {
    o Double price
}
            `, 'test.cto');

            const order = mm.getType('test.Order');
            order.should.not.be.null;
            order.getProperties().length.should.equal(2);
            order.getIdentifierFieldName().should.equal('$identifier');
        });

        it('should allow declaring system identifier', () => {
            const mm = new ModelManager();
            mm.addModelFile( `
namespace test

asset Order {
    o Double price
}
            `, 'test.cto');

            const order = mm.getType('test.Order');
            order.should.not.be.null;
            order.getProperties().length.should.equal(2);
            order.getIdentifierFieldName().should.equal('$identifier');
        });

        it('should allow declaring explicit identifier', () => {
            const mm = new ModelManager();
            mm.addModelFile( `
namespace test

asset Order identified by sku {
    o String sku
    o Double price
}
            `, 'test.cto');

            const order = mm.getType('test.Order');
            order.should.not.be.null;
            order.getProperties().length.should.equal(3); // XXX Assets always have an identifier
            order.getIdentifierFieldName().should.equal('sku');
            order.isSystemIdentified().should.be.false;
            order.isExplicitlyIdentified().should.be.true;
        });

        it('should not allow overriding explicit identifier', () => {
            const mm = new ModelManager();

            (() => {
                mm.addModelFile( `
                namespace test

                asset Order identified by sku {
                    o String sku
                    o Double price
                }

                asset FancyOrder identified extends Order {
                }

                            `, 'test.cto');
            }).should.throw(/Super class test.Order has an explicit identifier sku that cannot be redeclared./);
        });

        it('should not allow overriding system identifier', () => {
            const mm = new ModelManager();

            (() => {
                mm.addModelFile( `
                namespace test

                asset FancyOrder identified {
                    o String sku
                }

                            `, 'test.cto');
            }).should.throw(/Class "FancyOrder" has more than one field named "\$identifier". File 'test.cto': line 4 column 17, to line 6 column 18. /);
        });

        it('should not allow overriding explicit identifier with a system identifier', () => {
            const mm = new ModelManager();

            (() => {
                mm.addModelFile( `
                namespace test

                asset Order identified by sku {
                    o Double price
                    o String sku
                }

                asset FancyOrder identified extends Order {
                    o String model
                }

                            `, 'test.cto');
            }).should.throw(/Super class test.Order has an explicit identifier sku that cannot be redeclared./);
        });

        it('should not allow overriding explicit identifier with an explicit identifier', () => {
            const mm = new ModelManager();

            (() => {
                mm.addModelFile( `
                namespace test

                asset Order identified by sku {
                    o Double price
                    o String sku
                }

                asset FancyOrder identified by model extends Order {
                    o String model
                }

                            `, 'test.cto');
            }).should.throw(/Super class test.Order has an explicit identifier sku that cannot be redeclared./);
        });

        it('should not allow field called $identifier', () => {
            const mm = new ModelManager();

            (() => {
                mm.addModelFile( `
                namespace test

                asset Order {
                    o String $identifier
                }`, 'test.cto');
            }).should.throw(/Invalid field name \$identifier/);
        });

        it('should allow abstract assets without an identifier', () => {
            const mm = new ModelManager();
            mm.addModelFile( `
                namespace test

                abstract asset Order {
                    o Double price
                }

                asset FancyOrder identified by sku extends Order {
                    o String sku
                }
                `, 'test.cto');

            const order = mm.getType('test.Order');
            order.should.not.be.null;
            order.getProperties().length.should.equal(2); // XXX Assets always have an identifier
            order.isSystemIdentified().should.be.true;
            order.isExplicitlyIdentified().should.be.false;
        });

    });
});
