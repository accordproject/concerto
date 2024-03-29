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
const fs = require('fs');
const Util = require('../composer/composermodelutility');

require('chai').should();
const sinon = require('sinon');

describe('EventDeclaration', () => {

    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('#validate', () => {

        it('Check the system type',()=>{
            let model = `
            namespace com.test

            event E {
                o String euid
            }`;
            const modelManager = new ModelManager();
            Util.addComposerModel(modelManager);
            const modelFile = modelManager.addCTOModel(model, 'awesome.cto' );

            let ed = modelFile.getEventDeclaration('E');
            ed.validate();

        });
    });


    describe('#parse', () => {

        it('should parse a valid file', () => {

            const fileName = 'test/data/model/events.cto';
            let modelDefinitions = fs.readFileSync(fileName, 'utf8');
            const modelManager = new ModelManager();
            Util.addComposerModel(modelManager);
            const modelFile = modelManager.addCTOModel(modelDefinitions, fileName );

            const abstractEvent = modelFile.getEventDeclaration('AbstractEvent');
            abstractEvent.getFullyQualifiedName().should.equal('org.acme.AbstractEvent');
            abstractEvent.isAbstract().should.be.true;
            abstractEvent.isEvent().should.be.true;
            abstractEvent.validate();
            abstractEvent.declarationKind().should.equal('EventDeclaration');

            const concreteEvent = modelFile.getEventDeclaration('ConcreteEvent');
            concreteEvent.getFullyQualifiedName().should.equal('org.acme.ConcreteEvent');
            concreteEvent.isAbstract().should.be.false;

            const derivedEvent = modelFile.getEventDeclaration('DerivedEvent');
            derivedEvent.getFullyQualifiedName().should.equal('org.acme.DerivedEvent');
            derivedEvent.isAbstract().should.be.false;
        });
    });
});
