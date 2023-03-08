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

const { DirectedGraph, ConcertoGraphVisitor } = require('../../lib/common/common.js');
const { ModelManager } = require('@accordproject/concerto-core');
const fs = require('fs');
const { expect } = require('expect');

const chai = require('chai');
const { InMemoryWriter } = require('@accordproject/concerto-util');
chai.should();
chai.use(require('chai-as-promised'));
chai.use(require('chai-things'));

describe('graph', function () {
    let modelManager = null;

    beforeEach(function() {
        modelManager = new ModelManager();
        const cto = fs.readFileSync('./test/codegen/fromcto/data/model/hr.cto', 'utf-8');
        modelManager.addCTOModel(cto, 'hr.cto');
    });


    describe('#visitor', function () {
        it('should visit a model manager', function () {
            const visitor = new ConcertoGraphVisitor();
            visitor.should.not.be.null;
            const writer = new InMemoryWriter();

            const graph = new DirectedGraph();
            modelManager.accept(visitor, { graph });

            writer.openFile('graph.mmd');
            graph.print(writer);
            writer.closeFile();
            expect(writer.data.get('graph.mmd')).toEqual(`flowchart LR
   \`org.acme.hr@1.0.0.State\`
   \`org.acme.hr@1.0.0.State\` --> \`concerto@1.0.0.Concept\`
   \`org.acme.hr@1.0.0.Address\`
   \`org.acme.hr@1.0.0.Address\` --> \`concerto@1.0.0.Concept\`
   \`org.acme.hr@1.0.0.Address\` --> \`org.acme.hr@1.0.0.State\`
   \`org.acme.hr@1.0.0.Company\`
   \`org.acme.hr@1.0.0.Company\` --> \`concerto@1.0.0.Concept\`
   \`org.acme.hr@1.0.0.Company\` --> \`org.acme.hr@1.0.0.Address\`
   \`org.acme.hr@1.0.0.Department\`
   \`org.acme.hr@1.0.0.Department\` --> \`concerto@1.0.0.Concept\`
   \`org.acme.hr@1.0.0.Equipment\`
   \`org.acme.hr@1.0.0.Equipment\` --> \`concerto@1.0.0.Asset\`
   \`org.acme.hr@1.0.0.LaptopMake\`
   \`org.acme.hr@1.0.0.LaptopMake\` --> \`concerto@1.0.0.Concept\`
   \`org.acme.hr@1.0.0.Laptop\`
   \`org.acme.hr@1.0.0.Laptop\` --> \`org.acme.hr@1.0.0.Equipment\`
   \`org.acme.hr@1.0.0.Laptop\` --> \`org.acme.hr@1.0.0.LaptopMake\`
   \`org.acme.hr@1.0.0.SSN\`
   \`org.acme.hr@1.0.0.Person\`
   \`org.acme.hr@1.0.0.Person\` --> \`concerto@1.0.0.Participant\`
   \`org.acme.hr@1.0.0.Person\` --> \`org.acme.hr@1.0.0.Address\`
   \`org.acme.hr@1.0.0.Person\` --> \`org.acme.hr@1.0.0.SSN\`
   \`org.acme.hr@1.0.0.Employee\`
   \`org.acme.hr@1.0.0.Employee\` --> \`org.acme.hr@1.0.0.Person\`
   \`org.acme.hr@1.0.0.Employee\` --> \`org.acme.hr@1.0.0.Department\`
   \`org.acme.hr@1.0.0.Employee\` --> \`org.acme.hr@1.0.0.Address\`
   \`org.acme.hr@1.0.0.Employee\` --> \`org.acme.hr@1.0.0.Equipment\`
   \`org.acme.hr@1.0.0.Employee\` --> \`org.acme.hr@1.0.0.Manager\`
   \`org.acme.hr@1.0.0.Contractor\`
   \`org.acme.hr@1.0.0.Contractor\` --> \`org.acme.hr@1.0.0.Person\`
   \`org.acme.hr@1.0.0.Contractor\` --> \`org.acme.hr@1.0.0.Company\`
   \`org.acme.hr@1.0.0.Contractor\` --> \`org.acme.hr@1.0.0.Manager\`
   \`org.acme.hr@1.0.0.Manager\`
   \`org.acme.hr@1.0.0.Manager\` --> \`org.acme.hr@1.0.0.Employee\`
   \`org.acme.hr@1.0.0.Manager\` --> \`org.acme.hr@1.0.0.Person\`
   \`org.acme.hr@1.0.0.CompanyEvent\`
   \`org.acme.hr@1.0.0.CompanyEvent\` --> \`concerto@1.0.0.Event\`
   \`org.acme.hr@1.0.0.Onboarded\`
   \`org.acme.hr@1.0.0.Onboarded\` --> \`org.acme.hr@1.0.0.CompanyEvent\`
   \`org.acme.hr@1.0.0.Onboarded\` --> \`org.acme.hr@1.0.0.Employee\`
   \`org.acme.hr@1.0.0.ChangeOfAddress\`
   \`org.acme.hr@1.0.0.ChangeOfAddress\` --> \`concerto@1.0.0.Transaction\`
   \`org.acme.hr@1.0.0.ChangeOfAddress\` --> \`org.acme.hr@1.0.0.Person\`
   \`org.acme.hr@1.0.0.ChangeOfAddress\` --> \`org.acme.hr@1.0.0.Address\`
`);
        });

        it('should visit find a connected subgraph', function () {
            const visitor = new ConcertoGraphVisitor();
            visitor.should.not.be.null;
            const writer = new InMemoryWriter();

            const graph = new DirectedGraph();
            modelManager.accept(visitor, { graph });

            const connectedGraph = graph.findConnectedGraph('org.acme.hr@1.0.0.ChangeOfAddress');
            expect(connectedGraph.hasEdge('org.acme.hr@1.0.0.ChangeOfAddress', 'org.acme.hr@1.0.0.Person'));

            const filteredModelManager = modelManager.filter(declaration => connectedGraph.hasVertex(declaration.getFullyQualifiedName()));

            expect(filteredModelManager.getModelFiles()).toHaveLength(1);
            expect(filteredModelManager.getModelFiles()[0].getAllDeclarations()).toHaveLength(5);

            writer.openFile('graph.mmd');
            connectedGraph.print(writer);
            writer.closeFile();
            expect(writer.data.get('graph.mmd')).toEqual(`flowchart LR
   \`org.acme.hr@1.0.0.State\`
   \`org.acme.hr@1.0.0.State\` --> \`concerto@1.0.0.Concept\`
   \`org.acme.hr@1.0.0.Address\`
   \`org.acme.hr@1.0.0.Address\` --> \`concerto@1.0.0.Concept\`
   \`org.acme.hr@1.0.0.Address\` --> \`org.acme.hr@1.0.0.State\`
   \`org.acme.hr@1.0.0.SSN\`
   \`org.acme.hr@1.0.0.Person\`
   \`org.acme.hr@1.0.0.Person\` --> \`concerto@1.0.0.Participant\`
   \`org.acme.hr@1.0.0.Person\` --> \`org.acme.hr@1.0.0.Address\`
   \`org.acme.hr@1.0.0.Person\` --> \`org.acme.hr@1.0.0.SSN\`
   \`org.acme.hr@1.0.0.ChangeOfAddress\`
   \`org.acme.hr@1.0.0.ChangeOfAddress\` --> \`concerto@1.0.0.Transaction\`
   \`org.acme.hr@1.0.0.ChangeOfAddress\` --> \`org.acme.hr@1.0.0.Person\`
   \`org.acme.hr@1.0.0.ChangeOfAddress\` --> \`org.acme.hr@1.0.0.Address\`
`);
        });
    });
});
