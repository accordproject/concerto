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

const ModelManager = require('../lib/modelmanager');
const Concerto = require('../index').Concerto;

let concertoModel = `
namespace org.accordproject.test

enum Department {
    o ENGINEERING
    o HR
    o SALES
    o MARKETING
}

abstract concept Animal {
    o String name
}

concept Dog extends Animal {
}

concept Cat extends Animal {
}


participant Employee identified by ssn {
    o String ssn
    o String name optional
    o Department department optional
    o Animal[] pets optional
}
`;

const modelManager = new ModelManager();
modelManager.addCTOFile( concertoModel, 'test.cto');
const obj = {
    $class : 'org.accordproject.test.Employee',
    ssn: '123456789',
    name: 'Dan',
    pets : [
        {
            $class : 'org.accordproject.test.Cat',
            name : 'Bella'
        }
    ]
};

try {
    const concerto = new Concerto(modelManager);
    concerto.validate(obj);
    console.log(`Valid instance: ${concerto.getIdentifier(obj)}`);
}
catch(err) {
    console.log(err.message);
}
