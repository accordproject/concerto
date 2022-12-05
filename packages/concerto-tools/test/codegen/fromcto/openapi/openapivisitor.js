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

const { expect } = require('chai');
const chai = require('chai');
chai.should();

const ModelManager = require('@accordproject/concerto-core').ModelManager;
const OpenApiVisitor = require('../../../../lib/codegen/fromcto/openapi/openapivisitor.js');

const MODEL_SIMPLE = `
namespace test

enum Color {
  o RED
  o GREEN
  o BLUE
}

scalar Email extends String

@resource
concept Person identified by id {
  o String id
  o Email email
  o Color color
}
`;

describe('OpenApi (samples)', function () {

    describe('samples', () => {
        it('should use custom title and version for simple model', () => {
            const modelManager = new ModelManager();
            modelManager.addCTOModel( MODEL_SIMPLE );
            const visitor = new OpenApiVisitor();
            const spec = modelManager.accept(visitor, { openApiTitle: 'My Fancy API', openApiVersion: '0.0.1'});
            expect(spec.info.title).equal('My Fancy API');
            expect(spec.info.version).equal('0.0.1');
        });
    });
});
