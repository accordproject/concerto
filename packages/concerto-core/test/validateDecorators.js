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

// const chai = require('chai');
// const should = chai.should();

describe('ModelManager', () => {

    let validatedModelManager = null;
    let modelManager = null;

    beforeEach(() => {
        validatedModelManager = new ModelManager({
            strict: true, decoratorValidation: {
                missingDecorator: 'error',
                invalidDecorator: 'error'
            }
        });
        modelManager = new ModelManager({strict: true});
    });

    afterEach(() => {
    });

    describe('#unvalidateDecorators', () => {
        it('should not throw when decorators are declared', () => {
            modelManager.addCTOModel(`namespace test@1.0.0
import concerto.decorator@1.0.0.Decorator
concept Hide extends Decorator {
    o Boolean hidden optional
}

concept Person {
   o String name
   @Hide
   o String ssn
   @Hide(false)
   o Integer age
}`, 'test.cto', true);
            modelManager.validateModelFiles();
        });

        it('should not throw when decorators are undeclared', () => {
            modelManager.addCTOModel(`namespace test@1.0.0
concept Person {
   o String name
   @Hide
   o String ssn
   o Integer age
}`, 'test.cto', true);
            modelManager.validateModelFiles();
        });
    });


    describe('#validateDecorators', () => {
        it('should not throw when decorators are declared', () => {
            validatedModelManager.addCTOModel(`namespace test@1.0.0
import concerto.decorator@1.0.0.Decorator
concept Hide extends Decorator {
    o Boolean hidden optional
}

concept Person {
   o String name
   @Hide
   o String ssn
   @Hide(false)
   o Integer age
}`, 'test.cto', true);
            validatedModelManager.validateModelFiles();
        });

        it('should not throw when using all argument types', () => {
            validatedModelManager.addCTOModel(`namespace test@1.0.0
import concerto.decorator@1.0.0.Decorator
concept Hide extends Decorator {
   o Boolean bool
   o String str
   o Integer int
   o Long long
   o Double d
   o Concept concept
}

concept Person {
o String name
o String ssn
@Hide(false, "test", 1, 2, 3.5, Concept)
o Integer age
}`, 'test.cto', true);
            validatedModelManager.validateModelFiles();
        });

        it('should throw when decorators are not imported/declared', () => {
            validatedModelManager.addCTOModel(`namespace test@1.0.0
concept Person {
   o String name
   @Hide
   o String ssn
   @Hide(false)
   o Integer age
}`, 'test.cto', true);

            (() => {
                validatedModelManager.validateModelFiles();
            }).should.throw(/Undeclared type "Hide"/);
        });

        it('should throw when decorators are declared but have invalid arguments', () => {
            validatedModelManager.addCTOModel(`namespace test@1.0.0
import concerto.decorator@1.0.0.Decorator
concept Hide extends Decorator {
    o Boolean hidden optional
}
concept Person {
   o String name
   @Hide
   o String ssn
   @Hide("foo")
   o Integer age
}`, 'test.cto', true);
            (() => {
                validatedModelManager.validateModelFiles();
            }).should.throw(/Decorator Hide has invalid decorator argument. Expected boolean. Found string, with value "foo"/);
        });

        it('should throw when decorator has invalid string argument', () => {
            validatedModelManager.addCTOModel(`namespace test@1.0.0
import concerto.decorator@1.0.0.Decorator
concept Hide extends Decorator {
    o String test
}
concept Person {
   @Hide(false)
   o String ssn
}`, 'test.cto', true);
            (() => {
                validatedModelManager.validateModelFiles();
            }).should.throw(/Decorator Hide has invalid decorator argument. Expected string. Found boolean, with value false/);
        });

        it('should throw when decorator has invalid number argument', () => {
            validatedModelManager.addCTOModel(`namespace test@1.0.0
import concerto.decorator@1.0.0.Decorator
concept Hide extends Decorator {
    o Integer test
}
concept Person {
   @Hide(false)
   o String ssn
}`, 'test.cto', true);
            (() => {
                validatedModelManager.validateModelFiles();
            }).should.throw(/Decorator Hide has invalid decorator argument. Expected number. Found boolean, with value false/);
        });

        it('should throw when decorator has invalid object argument', () => {
            validatedModelManager.addCTOModel(`namespace test@1.0.0
import concerto.decorator@1.0.0.Decorator
concept Hide extends Decorator {
    o Concept test
}
concept Person {
   @Hide(false)
   o String ssn
}`, 'test.cto', true);
            (() => {
                validatedModelManager.validateModelFiles();
            }).should.throw(/Decorator Hide has invalid decorator argument. Expected object. Found boolean, with value false/);
        });


        it('should throw when decorators do not have enough arguments', () => {
            validatedModelManager.addCTOModel(`namespace test@1.0.0
import concerto.decorator@1.0.0.Decorator
concept Hide extends Decorator {
    o Boolean hidden
}
concept Person {
   o String name
   @Hide
   o String ssn
   o Integer age
}`, 'test.cto', true);
            (() => {
                validatedModelManager.validateModelFiles();
            }).should.throw(/Decorator Hide has too few arguments. Required properties are: \[hidden\]/);
        });

        it('should throw when decorators have too many arguments', () => {
            validatedModelManager.addCTOModel(`namespace test@1.0.0
import concerto.decorator@1.0.0.Decorator
concept Hide extends Decorator {
    o Boolean hidden
}
concept Person {
   o String name
   @Hide(true, "test")
   o String ssn
   o Integer age
}`, 'test.cto', true);
            (() => {
                validatedModelManager.validateModelFiles();
            }).should.throw(/Decorator Hide has too many arguments. Properties are: \[hidden\]/);
        });

        it('should not throw when decorators have missing optional arguments', () => {
            validatedModelManager.addCTOModel(`namespace test@1.0.0
import concerto.decorator@1.0.0.Decorator
concept Hide extends Decorator {
    o Boolean hidden
    o String description optional
}

@Hide(true)
concept Person {
   o String name
   @Hide(false)
   o String ssn
   o Integer age
}`, 'test.cto', true);
            validatedModelManager.validateModelFiles();
        });
    });
});