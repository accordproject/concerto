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

        it('should throw when decorators are not imported/declared - property', () => {
            validatedModelManager.addCTOModel(`namespace test@1.0.0
concept Person {
   @Hide
   o String ssn
}`, 'test.cto', true);

            (() => {
                validatedModelManager.validateModelFiles();
            }).should.throw(/Undeclared type "Hide"/);
        });

        it('should throw when decorators are not imported/declared - declaration', () => {
            validatedModelManager.addCTOModel(`namespace test@1.0.0
@Hide
concept Person {
   o String ssn
}`, 'test.cto', true);

            (() => {
                validatedModelManager.validateModelFiles();
            }).should.throw(/Undeclared type "Hide"/);
        });

        it('should throw when decorators are not imported/declared - namespace', () => {
            validatedModelManager.addCTOModel(`@Hide
namespace test@1.0.0
concept Person {
   o String ssn
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
            }).should.throw(/IllegalModelException: Decorator Hide/);
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
            }).should.throw(/IllegalModelException: Decorator Hide/);
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
            }).should.throw(/IllegalModelException: Decorator Hide/);
        });

        it('should not throw when decorator has valid object argument', () => {
            validatedModelManager.addCTOModel(`namespace test@1.0.0
import concerto.decorator@1.0.0.Decorator

abstract concept Category {}
concept HR extends Category {}

concept Hide extends Decorator {
    o Category category
}

concept Person {
   @Hide(HR)
   o String ssn
}`, 'test.cto', true);
            validatedModelManager.validateModelFiles();
        });

        it('should throw when decorator has invalid object argument - type checking', () => {
            validatedModelManager.addCTOModel(`namespace test@1.0.0
import concerto.decorator@1.0.0.Decorator

abstract concept Category {}
concept HR extends Category {}
concept Name {}

concept Hide extends Decorator {
    o Category category optional
}

concept Person {
   @Hide(Name)
   o String ssn
}`, 'test.cto', true);
            (() => {
                validatedModelManager.validateModelFiles();
            }).should.throw(/IllegalModelException: Decorator Hide/);
        });

        it('should throw when decorator has invalid object argument - primitive', () => {
            validatedModelManager.addCTOModel(`namespace test@1.0.0
import concerto.decorator@1.0.0.Decorator

concept Hide extends Decorator {
    o Concept concept
}

concept Person {
   @Hide("foo")
   o String ssn
}`, 'test.cto', true);
            (() => {
                validatedModelManager.validateModelFiles();
            }).should.throw(/IllegalModelException: Decorator Hide/);
        });

        it('should throw when decorator has missing object argument', () => {
            validatedModelManager.addCTOModel(`namespace test@1.0.0
import concerto.decorator@1.0.0.Decorator

concept Hide extends Decorator {
    o Concept concept
}

concept Person {
   @Hide(Missing)
   o String ssn
}`, 'test.cto', true);
            (() => {
                validatedModelManager.validateModelFiles();
            }).should.throw(/IllegalModelException: Decorator Hide/);
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
            }).should.throw(/IllegalModelException: Decorator Hide/);
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
            }).should.throw(/IllegalModelException: Decorator Hide/);
        });

        it('should not throw when decorators have missing optional arguments', () => {
            validatedModelManager.addCTOModel(`@Hide(false)
namespace test@1.0.0
import concerto.decorator@1.0.0.Decorator
@Hide(true)
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