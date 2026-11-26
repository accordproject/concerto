import { ClassDeclaration, ModelFile, ModelManager, Property, Validator, Field, Declaration } from '@accordproject/concerto-core';
import {
    getDeclarationType,
    getPropertyType,
    getValidatorType,
    isClassDeclaration,
    isMapDeclaration,
    isScalarDeclaration,
    isField,
    isRelationship,
    isEnumValue,
    isNumberValidator,
    isStringValidator,
} from '../../src/compare-utils';

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

const classDeclaration = new ClassDeclaration(modelFile, {
    $class: 'concerto.metamodel@1.0.0.ClassDeclaration',
    name: 'ClassDeclaration',
    properties: []
});
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

describe('duck typing guards and resolvers', () => {
    const asDeclaration = (obj: unknown): Declaration => obj as Declaration;
    const asProperty = (obj: unknown): Property => obj as Property;
    const asValidator = (obj: unknown): Validator => obj as Validator;

    test('should identify cross-realm declarations via duck typing', () => {
        const duckAsset = asDeclaration({
            isClassDeclaration: () => true,
            isAsset: () => true,
            isConcept: () => false,
            isEnum: () => false,
            isEvent: () => false,
            isParticipant: () => false,
            isTransaction: () => false,
        });

        const duckConcept = asDeclaration({
            isClassDeclaration: () => true,
            isAsset: () => false,
            isConcept: () => true,
            isEnum: () => false,
            isEvent: () => false,
            isParticipant: () => false,
            isTransaction: () => false,
        });

        const duckEnum = asDeclaration({
            isClassDeclaration: () => true,
            isAsset: () => false,
            isConcept: () => false,
            isEnum: () => true,
            isEvent: () => false,
            isParticipant: () => false,
            isTransaction: () => false,
        });

        const duckEvent = asDeclaration({
            isClassDeclaration: () => true,
            isAsset: () => false,
            isConcept: () => false,
            isEnum: () => false,
            isEvent: () => true,
            isParticipant: () => false,
            isTransaction: () => false,
        });

        const duckParticipant = asDeclaration({
            isClassDeclaration: () => true,
            isAsset: () => false,
            isConcept: () => false,
            isEnum: () => false,
            isEvent: () => false,
            isParticipant: () => true,
            isTransaction: () => false,
        });

        const duckTransaction = asDeclaration({
            isClassDeclaration: () => true,
            isAsset: () => false,
            isConcept: () => false,
            isEnum: () => false,
            isEvent: () => false,
            isParticipant: () => false,
            isTransaction: () => true,
        });

        const duckMap = asDeclaration({
            isMapDeclaration: () => true,
        });

        const duckScalar = asDeclaration({
            isScalarDeclaration: () => true,
        });

        expect(isClassDeclaration(duckAsset)).toBe(true);
        expect(getDeclarationType(duckAsset)).toBe('asset');

        expect(isClassDeclaration(duckConcept)).toBe(true);
        expect(getDeclarationType(duckConcept)).toBe('concept');

        expect(isClassDeclaration(duckEnum)).toBe(true);
        expect(getDeclarationType(duckEnum)).toBe('enum');

        expect(isClassDeclaration(duckEvent)).toBe(true);
        expect(getDeclarationType(duckEvent)).toBe('event');

        expect(isClassDeclaration(duckParticipant)).toBe(true);
        expect(getDeclarationType(duckParticipant)).toBe('participant');

        expect(isClassDeclaration(duckTransaction)).toBe(true);
        expect(getDeclarationType(duckTransaction)).toBe('transaction');

        expect(isMapDeclaration(duckMap)).toBe(true);
        expect(getDeclarationType(duckMap)).toBe('map');

        expect(isScalarDeclaration(duckScalar)).toBe(true);
        expect(getDeclarationType(duckScalar)).toBe('scalar');
    });

    test('should identify cross-realm properties via duck typing', () => {
        const duckField = asProperty({
            isField: () => true,
        });

        const duckRelationship = asProperty({
            isRelationship: () => true,
        });

        const duckEnumValue = asProperty({
            isEnumValue: () => true,
        });

        expect(isField(duckField)).toBe(true);
        expect(getPropertyType(duckField)).toBe('field');

        expect(isRelationship(duckRelationship)).toBe(true);
        expect(getPropertyType(duckRelationship)).toBe('relationship');

        expect(isEnumValue(duckEnumValue)).toBe(true);
        expect(getPropertyType(duckEnumValue)).toBe('enum value');
    });

    test('should identify cross-realm validators via duck typing', () => {
        const duckNumberValidator = asValidator({
            getLowerBound: () => 0,
            getUpperBound: () => 100,
        });

        const duckStringValidator = asValidator({
            getRegex: () => /abc/,
        });

        expect(isNumberValidator(duckNumberValidator)).toBe(true);
        expect(getValidatorType(duckNumberValidator)).toBe('number');

        expect(isStringValidator(duckStringValidator)).toBe(true);
        expect(getValidatorType(duckStringValidator)).toBe('string');
    });

    test('type guards should return false for null, undefined, and non-matching objects', () => {
        expect(isClassDeclaration(asDeclaration(null))).toBe(false);
        expect(isClassDeclaration(asDeclaration(undefined))).toBe(false);
        expect(isClassDeclaration(asDeclaration({}))).toBe(false);

        expect(isMapDeclaration(asDeclaration(null))).toBe(false);
        expect(isScalarDeclaration(asDeclaration(null))).toBe(false);
        expect(isField(asProperty(null))).toBe(false);
        expect(isRelationship(asProperty(null))).toBe(false);
        expect(isEnumValue(asProperty(null))).toBe(false);
        expect(isNumberValidator(asValidator(null))).toBe(false);
        expect(isStringValidator(asValidator(null))).toBe(false);
    });
});
