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
const ValidatedConcept = require('../../lib/model/validatedconcept');
const ResourceValidator = require('../../lib/serializer/resourcevalidator');
const Util = require('../composer/composermodelutility');

const sinon = require('sinon');
const chai = require('chai');
chai.should();
chai.use(require('chai-things'));

describe('ValidatedConcept', function () {

    const levelOneModel = `namespace org.acme.l1
  concept Person {
    o String name
    o String[] arrayName
  }
  asset Car identified by vin {
    o String vin
    o Person owner
  }
  `;

    let modelManager = null;
    let classDecl = null;
    let mockResourceValidator;

    before(function () {
        modelManager = new ModelManager();
        Util.addComposerModel(modelManager);
    });

    beforeEach(function () {
        modelManager.addModelFile(levelOneModel);
        classDecl = modelManager.getType('org.acme.l1.Person');
        mockResourceValidator = sinon.createStubInstance(ResourceValidator);
        mockResourceValidator.visit.returns(null);

    });

    afterEach(function () {
        modelManager.clearModelFiles();
    });

    describe('#getClassDeclaration', function() {
        it('should return the class declaraction', function () {
            const resource = new ValidatedConcept(modelManager, classDecl, 'org.acme.l1', 'Person' ,mockResourceValidator);
            resource._getClassDeclaration().should.equal(classDecl);
        });
    });

    describe('#setPropertyValue', () => {
        it (' should accept valid property - value', function (){
            const resource = new ValidatedConcept(modelManager, classDecl, 'org.acme.l1', 'Person' ,mockResourceValidator);
            resource._setPropertyValue('name','Fred Bloggs');
        });
        it (' should throw error for invalid property name', function (){
            const resource = new ValidatedConcept(modelManager, classDecl, 'org.acme.l1', 'Person' ,mockResourceValidator);
            ( () => {
                resource._setPropertyValue('namenamename','Fred Bloggs');
            }).should.throw(/Trying to set field namenamename which is not declared in the model/);
        });
        it (' should throw error for array', function (){
            const resource = new ValidatedConcept(modelManager, classDecl, 'org.acme.l1', 'Person' ,mockResourceValidator);
            ( () => {
                resource._addArrayValue('name',['Fred','Bloggs']);
            }).should.throw(/Trying to add array item name which is not declared as an array in the model/);
        });
        it (' correct path for adding an array', function (){
            const resource = new ValidatedConcept(modelManager, classDecl, 'org.acme.l1', 'Person' ,mockResourceValidator);
            resource._addArrayValue('arrayName',['Fred','Bloggs']);
        });
        it (' should throw error for invalid property name', function (){
            const resource = new ValidatedConcept(modelManager, classDecl, 'org.acme.l1', 'Person' ,mockResourceValidator);
            (()=>{
                resource._addArrayValue('invalid','Fred');
            }).should.throw(/Trying to set field invalid which is not declared in the model/);
        });
        it (' validate', function (){
            const resource = new ValidatedConcept(modelManager, classDecl, 'org.acme.l1', 'Person' ,mockResourceValidator);
            resource._validate();
        });
        it (' add two elements separately to an array property', function (){
            const resource = new ValidatedConcept(modelManager, classDecl, 'org.acme.l1', 'Person' ,mockResourceValidator);
            resource._addArrayValue('arrayName','Fred');
            resource._addArrayValue('arrayName','Bloggs');
        });

    });

});
