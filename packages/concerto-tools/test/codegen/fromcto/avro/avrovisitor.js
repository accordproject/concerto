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

const { InMemoryWriter } = require('@accordproject/concerto-util');
const chai = require('chai');
chai.should();

const ModelManager = require('@accordproject/concerto-core').ModelManager;
const AvroVisitor = require('../../../../lib/codegen/fromcto/avro/avrovisitor.js');

const MODEL_SIMPLE = `
namespace test@1.0.0

enum Color {
  o RED
  o GREEN
  o BLUE
}

scalar Email extends String

@resource
concept Person identified by email {
  o Email email
  o Color color
}
`;

describe('Avro', function () {

    describe('samples', () => {
        it('should use custom properties', () => {
            const modelManager = new ModelManager();
            modelManager.addCTOModel( MODEL_SIMPLE );
            const visitor = new AvroVisitor();
            const fileWriter = new InMemoryWriter();
            modelManager.accept(visitor, {
                avroProtocolName: 'FancyProtocol',
                fileWriter
            });
            const files = fileWriter.getFilesInMemory();
            const file = files.get('test@1.0.0.avdl');
            file.should.match(/protocol FancyProtocol/);
        });

        it('should throw an error when an unrecognised type is supplied', () => {
            let thing = 'Something of unrecognised type';
            const visitor = new AvroVisitor();
            const param = {};
            (() => {
                visitor.visit(thing, param);
            }).should.throw('Unrecognised type: string, value: \'Something of unrecognised type\'');
        });
    });
});
