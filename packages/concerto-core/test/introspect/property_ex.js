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
const IllegalModelException = require('../../lib/introspect/illegalmodelexception');
const TypeNotFoundException = require('../../lib/typenotfoundexception');
const sinon = require('sinon');
const Util = require('../composer/composermodelutility');

const chai = require('chai');
chai.should();
chai.use(require('chai-things'));

describe('Property', function () {

    let modelManager;

    const levelOneModel = `namespace org.acme.l1
    participant Person identified by ssn {
      o String ssn
    }
    asset Car identified by vin {
      o String vin
      -->Person owner
    }
    `;

    before(function () {
        modelManager = new ModelManager();
        Util.addComposerModel(modelManager);
    });

    beforeEach(function () {
        modelManager.addCTOModel(levelOneModel);
    });

    afterEach(function () {
        modelManager.clearModelFiles();
    });

    describe('#getFullyQualifiedTypeName', function() {
        it('should throw if no parent', function () {
            const person = modelManager.getType('org.acme.l1.Car');
            const field = person.getProperty('owner');
            // stub the getType method to return null
            sinon.stub(field, 'getParent').callsFake(function(){return null;});

            (function () {
                field.getFullyQualifiedTypeName();
            }).should.throw(/Property owner does not have a parent./);
        });
        it('should throw if parent has no ModelFile', function () {
            const person = modelManager.getType('org.acme.l1.Car');
            const field = person.getProperty('owner');
            // stub the getType method to return null
            sinon.stub(person, 'getModelFile').callsFake(function(){return null;});
            
            try{
                field.getFullyQualifiedTypeName();
            }catch(err){
                err.should.be.an.instanceOf(IllegalModelException);
                err.message.should.match(/Parent of property owner does not have a ModelFile!/)
            }
        });
        it('should throw if ModelFile fails to find type', function () {
            const person = modelManager.getType('org.acme.l1.Car');
            const field = person.getProperty('owner');
            // stub the getType method to return null
            sinon.stub(person.getModelFile(), 'getFullyQualifiedTypeName').callsFake(function(){return null;});

            try{
                field.getFullyQualifiedTypeName();
            }catch(err){
                err.should.be.an.instanceOf(TypeNotFoundException);
                err.message.should.match(/Failed to find fully qualified type name for property owner with type Person/)
            }
        });
        it('toString works', function () {
            const person = modelManager.getType('org.acme.l1.Car');
            const field = person.getProperty('owner');
            field.toString().should.equal('RelationshipDeclaration {name=owner, type=org.acme.l1.Person, array=false, optional=false}');
        });
    });
});
