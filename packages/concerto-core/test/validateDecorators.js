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
const { ModelManager } = require('../src/modelmanager');

describe('ModelManager', () => {

    let validatedModelManager = null;
    let modelManager = null;

    beforeEach(() => {
        validatedModelManager = new ModelManager({
            decoratorValidation: {
                missingDecorator: 'error',
                invalidDecorator: 'error'
            }
        });
        modelManager = new ModelManager();
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
            }).should.throw(/Decorator Hide/);
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
            }).should.throw(/Decorator Hide/);
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
            }).should.throw(/Decorator Hide/);
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
            }).should.throw(/Decorator Hide/);
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
            }).should.throw(/Decorator Hide/);
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
            }).should.throw(/Decorator Hide/);
        });

        it('should allow a trailing array decorator property to take multiple type arguments', () => {
            validatedModelManager.addCTOModel(`namespace test@1.0.0
abstract concept Interface {}
concept A extends Interface {}
concept B extends Interface {}
concept Implements { o Interface[] interfaces }

@Implements(A, B)
concept C {}`, 'test.cto', true);
            validatedModelManager.validateModelFiles();
        });

        it('should name the argument position for invalid trailing array elements', () => {
            validatedModelManager.addCTOModel(`namespace test@1.0.0
abstract concept Interface {}
concept A extends Interface {}
concept NotAnInterface {}
concept Implements { o Interface[] interfaces }

@Implements(A, NotAnInterface)
concept C {}`, 'test.cto', true);
            (() => {
                validatedModelManager.validateModelFiles();
            }).should.throw(/Decorator Implements.*argument 2/);
        });

        it('should name the argument position for missing trailing array types', () => {
            validatedModelManager.addCTOModel(`namespace test@1.0.0
abstract concept Interface {}
concept A extends Interface {}
concept Implements { o Interface[] interfaces }

@Implements(A, Undefined)
concept C {}`, 'test.cto', true);
            (() => {
                validatedModelManager.validateModelFiles();
            }).should.throw(/Decorator Implements.*Undefined.*argument 2/);
        });

        it('should validate fixed properties before a trailing array', () => {
            validatedModelManager.addCTOModel(`namespace test@1.0.0
abstract concept Interface {}
concept A extends Interface {}
concept B extends Interface {}
concept Implements {
    o String label
    o Interface[] interfaces
}

@Implements("standard", A, B)
concept C {}`, 'test.cto', true);
            validatedModelManager.validateModelFiles();
        });

        it('should validate optional fixed properties before an optional trailing array', () => {
            validatedModelManager.addCTOModel(`namespace test@1.0.0
abstract concept Interface {}
concept A extends Interface {}
concept B extends Interface {}
concept Implements {
    o String label optional
    o Interface[] interfaces optional
}

@Implements("standard")
concept C {}

@Implements("standard", A, B)
concept D {}`, 'test.cto', true);
            validatedModelManager.validateModelFiles();
        });

        it('should require at least one argument for a required trailing array', () => {
            validatedModelManager.addCTOModel(`namespace test@1.0.0
abstract concept Interface {}
concept Implements { o Interface[] interfaces }

@Implements
concept C {}`, 'test.cto', true);
            (() => {
                validatedModelManager.validateModelFiles();
            }).should.throw(/Decorator Implements/);
        });

        it('should allow zero arguments for an optional trailing array', () => {
            validatedModelManager.addCTOModel(`namespace test@1.0.0
abstract concept Interface {}
concept Implements { o Interface[] interfaces optional }

@Implements
concept C {}`, 'test.cto', true);
            validatedModelManager.validateModelFiles();
        });

        it('should validate primitive trailing array elements', () => {
            validatedModelManager.addCTOModel(`namespace test@1.0.0
concept Numbers { o Integer[] values }

@Numbers(1, 2, 3)
concept C {}`, 'test.cto', true);
            validatedModelManager.validateModelFiles();
        });

        it('should name the argument position for invalid primitive trailing array elements', () => {
            validatedModelManager.addCTOModel(`namespace test@1.0.0
concept Numbers { o Integer[] values }

@Numbers(1, "two")
concept C {}`, 'test.cto', true);
            (() => {
                validatedModelManager.validateModelFiles();
            }).should.throw(/Decorator Numbers.*argument 2/);
        });

        it('should bind a required trailing array before an optional property', () => {
            validatedModelManager.addCTOModel(`namespace test@1.0.0
abstract concept Interface {}
concept A extends Interface {}
concept B extends Interface {}
concept Implements {
    o String label optional
    o Interface[] interfaces
}

@Implements(A)
concept C {}

@Implements(A, B)
concept D {}`, 'test.cto', true);
            validatedModelManager.validateModelFiles();
        });

        it('should require an argument for a required trailing array after an optional property', () => {
            validatedModelManager.addCTOModel(`namespace test@1.0.0
abstract concept Interface {}
concept Implements {
    o String label optional
    o Interface[] interfaces
}

@Implements
concept C {}`, 'test.cto', true);
            (() => {
                validatedModelManager.validateModelFiles();
            }).should.throw(/too few arguments/);
        });

        it('should not treat a non-trailing array property as variadic', () => {
            validatedModelManager.addCTOModel(`namespace test@1.0.0
abstract concept Interface {}
concept A extends Interface {}
concept B extends Interface {}
concept NotTrailing {
    o Interface[] interfaces optional
    o String label
}

@NotTrailing("label", A, B)
concept C {}`, 'test.cto', true);
            (() => {
                validatedModelManager.validateModelFiles();
            }).should.throw(/too many arguments/);
        });

        it('should reject a primitive type reference for a declared object property', () => {
            validatedModelManager.addCTOModel(`namespace test@1.0.0
abstract concept Interface {}
concept A extends Interface {}
concept Implements { o Interface[] interfaces }

@Implements(A, String)
concept C {}`, 'test.cto', true);
            (() => {
                validatedModelManager.validateModelFiles();
            }).should.throw(/Decorator Implements.*String.*cannot be assigned.*argument 2/);
        });

        it('should not crash on a primitive type reference in warning mode', () => {
            const warningModelManager = new ModelManager({
                decoratorValidation: {
                    missingDecorator: 'error',
                    invalidDecorator: 'warning'
                }
            });
            warningModelManager.addCTOModel(`namespace test@1.0.0
abstract concept Interface {}
concept Implements { o Interface[] interfaces }

@Implements(String)
concept C {}`, 'test.cto', true);
            warningModelManager.validateModelFiles();
        });

        it('should preserve required-first binding for non-array decorators', () => {
            validatedModelManager.addCTOModel(`namespace test@1.0.0
concept Options {
    o String description optional
    o Boolean enabled
}

@Options(true)
concept C {}`, 'test.cto', true);
            validatedModelManager.validateModelFiles();
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
            }).should.throw(/Decorator Hide/);
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
            }).should.throw(/Decorator Hide/);
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
