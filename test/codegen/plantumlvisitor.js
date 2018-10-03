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

require('chai').should();
const ModelManager = require('../../lib/modelmanager');
const PlantUMLVisitor = require('../../lib/codegen/fromcto/plantuml/plantumlvisitor');
const FileWriter = require('../../lib/codegen/filewriter');

const fs = require('fs');
const path = require('path');

describe('PlantUMLVisitor', function(){

    it('should generate PlantUML from the ModelManager for animaltracking BusinessNetworkDefinition', function() {

        const animaltrackingModel = fs.readFileSync(path.resolve(__dirname, '../data/model/animaltracking.cto'), 'utf8');

        // create and populate the ModelManager with a model file
        const modelManager = new ModelManager();
        modelManager.addModelFile(animaltrackingModel,'animaltracking.cto');

        let visitor = new PlantUMLVisitor();
        let parameters = {};
        parameters.fileWriter = new FileWriter('./out/animaltracking');
        modelManager.accept(visitor, parameters);

        // check the file exists
        fs.accessSync('./out/animaltracking/model.uml', fs.F_OK);
    });

    it('coverage for random object',function(){

        let fakeObj = {accept: function(){}};
        let visitor = new PlantUMLVisitor();
        (()=>{
            visitor.visit(fakeObj,{});
        })
            .should.throw(/Unrecognised/);
    });
});