import { ClassDeclaration, ModelFile, ModelManager, Property, Validator, Field }  from '@accordproject/concerto-core';
import { getDeclarationType, getPropertyType, getValidatorType } from '../../src/compare-utils';

// This test suite should disappear once we port concerto-core to TypeScript because the error branches will be enforced by the transpiler.

const modelManager = new ModelManager();

// These stubs are deliberately incomplete ASTs - they carry no $class - because
// the suite exists to reach error branches a well-formed model cannot.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asAst = (ast: object): any => ast;

const propertyAst = {
    name: 'myProp',
    type: 'Boolean'
};
const modelAst = {
    namespace: 'foo@1.0.0',
    properties: []
};

const modelFile = new ModelFile(modelManager, asAst(modelAst), null, 'test.cto');

const classDeclaration = new ClassDeclaration(modelFile, asAst(modelAst));
const property = new Property(classDeclaration, asAst(propertyAst));
const field = new Field(classDeclaration, asAst(propertyAst));
const validator = new Validator(field, asAst({}));

test('should throw for unknown class declaration type', () => {
    // Note: The error message format might have slightly changed with TS class toString(), but let's try strict first
    expect(() => getDeclarationType(classDeclaration)).toThrow(/unknown class declaration type/);
});

test('should throw for unknown thing', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => getDeclarationType('thing' as any)).toThrow('unknown declaration type "thing"');
});

test('should throw for unknown class property type', () => {
    expect(() => getPropertyType(property)).toThrow('unknown property type "[object Object]');
});

test('should throw for unknown validator type', () => {
    expect(() => getValidatorType(validator)).toThrow('unknown validator type "[object Object]');
});