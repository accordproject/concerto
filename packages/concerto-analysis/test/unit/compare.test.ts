import { ModelFile, ModelManager } from '@accordproject/concerto-core';
import { Parser } from '@accordproject/concerto-cto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Compare, CompareResult, compareResultToString } from '../../src';

async function getModelFile(modelManager: ModelManager, fileName: string) {
    const filePath = path.resolve(__dirname, '..', 'fixtures', fileName);
    const fileContents = await fs.readFile(filePath, 'utf-8');
    const metamodel = Parser.parse(fileContents);
    return new ModelFile(modelManager, metamodel, fileContents, filePath);
}

async function getModelFiles(
    aFileName: string,
    bFileName: string,
): Promise<[a: ModelFile, b: ModelFile]> {
    const modelManager = new ModelManager({ strict: true });
    const a = await getModelFile(modelManager, aFileName);
    const b = await getModelFile(modelManager, bFileName);
    return [a, b];
}

test('should convert results into readable strings', () => {
    [
        { result: CompareResult.ERROR, str: 'error' },
        { result: CompareResult.MAJOR, str: 'major' },
        { result: CompareResult.MINOR, str: 'minor' },
        { result: CompareResult.PATCH, str: 'patch' },
        { result: CompareResult.NONE, str: 'none' },
    ].forEach(({result, str}) => {
        expect(compareResultToString(result)).toBe(str);
    });
});

test('should detect no changes between two identical files', async () => {
    const [a, b] = await getModelFiles('identical.cto', 'identical.cto');
    const results = new Compare().compare(a, b);
    expect(results.findings).toHaveLength(0);
    expect(results.result).toBe(CompareResult.NONE);
});

test('should reject a non-strict modelManager, a', async () => {
    const modelManager = new ModelManager({ strict: false });
    const strictModelManager = new ModelManager({ strict: true });
    const a = await getModelFile(modelManager, 'identical.cto');
    const b = await getModelFile(strictModelManager, 'identical.cto');
    expect(() => new Compare().compare(a, b)).toThrow('model file "org.accordproject.concerto.test@1.2.3" does not have strict versioned namespaces');
});

test('should reject a non-strict modelManager, b', async () => {
    const modelManager = new ModelManager({ strict: true });
    const strictModelManager = new ModelManager({ strict: false });
    const a = await getModelFile(modelManager, 'identical.cto');
    const b = await getModelFile(strictModelManager, 'identical.cto');
    expect(() => new Compare().compare(a, b)).toThrow('model file "org.accordproject.concerto.test@1.2.3" does not have strict versioned namespaces');
});

test('should detect a change of namespace', async () => {
    const [a, b] = await getModelFiles('namespace-changed-a.cto', 'namespace-changed-b.cto');
    const results = new Compare().compare(a, b);
    expect(results.findings).toEqual(expect.arrayContaining([
        expect.objectContaining({
            key: 'namespace-changed',
            message: 'The namespace was changed from "org.accordproject.concerto.test.a" to "org.accordproject.concerto.test.b"'
        })
    ]));
    expect(results.result).toBe(CompareResult.ERROR);
});

['asset', 'concept', 'enum', 'event', 'participant', 'transaction'].forEach(type => {
    test(`should detect a ${type} being added`, async () => {
        const [a, b] = await getModelFiles('empty.cto', `${type}-added.cto`);
        const results = new Compare().compare(a, b);
        expect(results.findings).toEqual(expect.arrayContaining([
            expect.objectContaining({
                key: 'class-declaration-added',
                message: `The ${type} "Thing" was added`
            })
        ]));
        expect(results.result).toBe(CompareResult.MINOR);
    });

    test(`should detect a ${type} being removed`, async () => {
        const [a, b] = await getModelFiles(`${type}-added.cto`, 'empty.cto');
        const results = new Compare().compare(a, b);
        expect(results.findings).toEqual(expect.arrayContaining([
            expect.objectContaining({
                key: 'class-declaration-removed',
                message: `The ${type} "Thing" was removed`
            })
        ]));
        expect(results.result).toBe(CompareResult.MAJOR);
    });
});

test('should detect a required field being added', async () => {
    const [a, b] = await getModelFiles('required-field-added-a.cto', 'required-field-added-b.cto');
    const results = new Compare().compare(a, b);
    expect(results.findings).toEqual(expect.arrayContaining([
        expect.objectContaining({
            key: 'required-property-added',
            message: 'The required field "value" was added to the concept "Thing"'
        })
    ]));
    expect(results.result).toBe(CompareResult.MAJOR);
});

test('should detect a required field being removed', async () => {
    const [a, b] = await getModelFiles('required-field-added-b.cto', 'required-field-added-a.cto');
    const results = new Compare().compare(a, b);
    expect(results.findings).toEqual(expect.arrayContaining([
        expect.objectContaining({
            key: 'required-property-removed',
            message: 'The required field "value" was removed from the concept "Thing"'
        })
    ]));
    expect(results.result).toBe(CompareResult.MAJOR);
});

test('should detect an optional field being added', async () => {
    const [a, b] = await getModelFiles('optional-field-added-a.cto', 'optional-field-added-b.cto');
    const results = new Compare().compare(a, b);
    expect(results.findings).toEqual(expect.arrayContaining([
        expect.objectContaining({
            key: 'optional-property-added',
            message: 'The optional field "value" was added to the concept "Thing"'
        })
    ]));
    expect(results.result).toBe(CompareResult.PATCH);
});

test('should detect an optional field being removed', async () => {
    const [a, b] = await getModelFiles('optional-field-added-b.cto', 'optional-field-added-a.cto');
    const results = new Compare().compare(a, b);
    expect(results.findings).toEqual(expect.arrayContaining([
        expect.objectContaining({
            key: 'optional-property-removed',
            message: 'The optional field "value" was removed from the concept "Thing"'
        })
    ]));
    expect(results.result).toBe(CompareResult.MAJOR);
});


[{ from: 'asset', to: 'concept'}, { from: 'enum', to: 'event' }, { from: 'participant', to: 'transaction'}].forEach(({ from, to }) => {
    test(`should detect a change of declaration type (${from} to ${to})`, async () => {
        const [a, b] = await getModelFiles(`${from}-added.cto`, `${to}-added.cto`);
        const results = new Compare().compare(a, b);
        expect(results.findings).toEqual(expect.arrayContaining([
            expect.objectContaining({
                key: 'class-declaration-type-changed',
                message: `The ${from} "Thing" changed type from ${from} to ${to}`
            })
        ]));
        expect(results.result).toBe(CompareResult.MAJOR);
    });
});

test('should detect a enum value being added', async () => {
    const [a, b] = await getModelFiles('enum-value-added-a.cto', 'enum-value-added-b.cto');
    const results = new Compare().compare(a, b);
    expect(results.findings).toEqual(expect.arrayContaining([
        expect.objectContaining({
            key: 'enum-value-added',
            message: 'The enum value "BAR" was added to the enum "Thing"'
        })
    ]));
    expect(results.result).toBe(CompareResult.PATCH);
});

test('should detect an enum value being removed', async () => {
    const [a, b] = await getModelFiles('enum-value-added-b.cto', 'enum-value-added-a.cto');
    const results = new Compare().compare(a, b);
    expect(results.findings).toEqual(expect.arrayContaining([
        expect.objectContaining({
            key: 'enum-value-removed',
            message: 'The enum value "BAR" was removed from the enum "Thing"'
        })
    ]));
    expect(results.result).toBe(CompareResult.MAJOR);
});

test('should detect a field changing to a relationship', async () => {
    const [a, b] = await getModelFiles('field-to-relationship-a.cto', 'field-to-relationship-b.cto');
    const results = new Compare().compare(a, b);
    expect(results.findings).toEqual(expect.arrayContaining([
        expect.objectContaining({
            key: 'property-type-changed',
            message: 'The field "bar" in the concept "Thing" changed type from field to relationship'
        })
    ]));
    expect(results.result).toBe(CompareResult.MAJOR);
});

test('should detect a relationship changing to a field', async () => {
    const [a, b] = await getModelFiles('field-to-relationship-b.cto', 'field-to-relationship-a.cto');
    const results = new Compare().compare(a, b);
    expect(results.findings).toEqual(expect.arrayContaining([
        expect.objectContaining({
            key: 'property-type-changed',
            message: 'The relationship "bar" in the concept "Thing" changed type from relationship to field'
        })
    ]));
    expect(results.result).toBe(CompareResult.MAJOR);
});

test('should detect a scalar changing to an array', async () => {
    const [a, b] = await getModelFiles('scalar-to-array-a.cto', 'scalar-to-array-b.cto');
    const results = new Compare().compare(a, b);
    expect(results.findings).toEqual(expect.arrayContaining([
        expect.objectContaining({
            key: 'property-type-changed',
            message: 'The scalar field "bar" in the concept "Thing" changed type from a scalar field to an array field'
        })
    ]));
    expect(results.result).toBe(CompareResult.MAJOR);
});

test('should detect an array changing to a scalar', async () => {
    const [a, b] = await getModelFiles('scalar-to-array-b.cto', 'scalar-to-array-a.cto');
    const results = new Compare().compare(a, b);
    expect(results.findings).toEqual(expect.arrayContaining([
        expect.objectContaining({
            key: 'property-type-changed',
            message: 'The array field "bar" in the concept "Thing" changed type from an array field to a scalar field'
        })
    ]));
    expect(results.result).toBe(CompareResult.MAJOR);
});

test('should detect a primitive typed field changing to a declaration typed field', async () => {
    const [a, b] = await getModelFiles('primitive-to-declaration-a.cto', 'primitive-to-declaration-b.cto');
    const results = new Compare().compare(a, b);
    expect(results.findings).toEqual(expect.arrayContaining([
        expect.objectContaining({
            key: 'property-type-changed',
            message: 'The field "bar" in the concept "Thing" changed type from "String" to "org.accordproject.concerto.test@1.2.3.Bar" (type name differs)'
        })
    ]));
    expect(results.result).toBe(CompareResult.MAJOR);
});

test('should detect a declaration typed field changing to a primitive typed field', async () => {
    const [a, b] = await getModelFiles('primitive-to-declaration-b.cto', 'primitive-to-declaration-a.cto');
    const results = new Compare().compare(a, b);
    expect(results.findings).toEqual(expect.arrayContaining([
        expect.objectContaining({
            key: 'property-type-changed',
            message: 'The field "bar" in the concept "Thing" changed type from "org.accordproject.concerto.test@1.2.3.Bar" to "String" (type name differs)'
        })
    ]));
    expect(results.result).toBe(CompareResult.MAJOR);
});

test('should detect a declaration typed field namespace change', async () => {
    const [a, b] = await getModelFiles('field-namespace-changed-a.cto', 'field-namespace-changed-b.cto');
    const results = new Compare().compare(a, b);
    expect(results.findings).toEqual(expect.arrayContaining([
        expect.objectContaining({
            key: 'property-type-changed',
            message: 'The field "bar" in the concept "Thing" changed type from "org.accordproject.concerto.test.other@2.3.4.Bar" to "org.accordproject.concerto.test.another@2.3.4.Bar" (type namespace differs)'
        })
    ]));
    expect(results.result).toBe(CompareResult.MAJOR);
});

test('should not detect a declaration typed field namespace patch version change', async () => {
    const [a, b] = await getModelFiles('field-namespace-changed-a.cto', 'field-namespace-changed-patch-b.cto');
    const results = new Compare().compare(a, b);
    expect(results.findings).toHaveLength(0);
    expect(results.result).toBe(CompareResult.NONE);
});

test('should not detect a declaration typed field namespace minor version change', async () => {
    const [a, b] = await getModelFiles('field-namespace-changed-a.cto', 'field-namespace-changed-minor-b.cto');
    const results = new Compare().compare(a, b);
    expect(results.findings).toHaveLength(0);
    expect(results.result).toBe(CompareResult.NONE);
});

test('should detect a declaration typed field namespace major version change', async () => {
    const [a, b] = await getModelFiles('field-namespace-changed-a.cto', 'field-namespace-changed-major-b.cto');
    const results = new Compare().compare(a, b);
    expect(results.findings).toEqual(expect.arrayContaining([
        expect.objectContaining({
            key: 'property-type-changed',
            message: 'The field "bar" in the concept "Thing" changed type from "org.accordproject.concerto.test.other@2.3.4.Bar" to "org.accordproject.concerto.test.other@3.0.0.Bar" (type version incompatible)'
        })
    ]));
    expect(results.result).toBe(CompareResult.MAJOR);
});

test('should detect a number validator being added to a property', async () => {
    const [a, b] = await getModelFiles('validators.cto', 'number-validator-added.cto');
    const results = new Compare().compare(a, b);
    expect(results.findings).toEqual(expect.arrayContaining([
        expect.objectContaining({
            key: 'property-validator-added',
            message: 'A number validator was added to the field "number" in the concept "Thing"'
        })
    ]));
    expect(results.result).toBe(CompareResult.MAJOR);
});

test('should detect a number validator being removed from a property', async () => {
    const [a, b] = await getModelFiles('number-validator-added.cto', 'validators.cto');
    const results = new Compare().compare(a, b);
    expect(results.findings).toEqual(expect.arrayContaining([
        expect.objectContaining({
            key: 'property-validator-removed',
            message: 'A number validator was removed from the field "number" in the concept "Thing"'
        })
    ]));
    expect(results.result).toBe(CompareResult.PATCH);
});

test('should not detect a number validator being changed on a property (compatible lower bound)', async () => {
    const [a, b] = await getModelFiles('number-validator-added.cto', 'number-validator-changed-lowercompat.cto');
    const results = new Compare().compare(a, b);
    expect(results.findings).toEqual([]);
    expect(results.result).toBe(CompareResult.NONE);
});

test('should detect a number validator being changed on a property (incompatible lower bound)', async () => {
    const [a, b] = await getModelFiles('number-validator-added.cto', 'number-validator-changed-lowerincompat.cto');
    const results = new Compare().compare(a, b);
    expect(results.findings).toEqual(expect.arrayContaining([
        expect.objectContaining({
            key: 'property-validator-changed',
            message: 'A number validator for the field "number" in the concept "Thing" was changed and is no longer compatible'
        })
    ]));
    expect(results.result).toBe(CompareResult.MAJOR);
});

test('should not detect a number validator being changed on a property (compatible upper bound)', async () => {
    const [a, b] = await getModelFiles('number-validator-added.cto', 'number-validator-changed-uppercompat.cto');
    const results = new Compare().compare(a, b);
    expect(results.findings).toEqual([]);
    expect(results.result).toBe(CompareResult.NONE);
});

test('should detect a number validator being changed on a property (incompatible upper bound)', async () => {
    const [a, b] = await getModelFiles('number-validator-added.cto', 'number-validator-changed-upperincompat.cto');
    const results = new Compare().compare(a, b);
    expect(results.findings).toEqual(expect.arrayContaining([
        expect.objectContaining({
            key: 'property-validator-changed',
            message: 'A number validator for the field "number" in the concept "Thing" was changed and is no longer compatible'
        })
    ]));
    expect(results.result).toBe(CompareResult.MAJOR);
});

test('should detect a string validator being added to a property', async () => {
    const [a, b] = await getModelFiles('validators.cto', 'string-validator-added.cto');
    const results = new Compare().compare(a, b);
    expect(results.findings).toEqual(expect.arrayContaining([
        expect.objectContaining({
            key: 'property-validator-added',
            message: 'A string validator was added to the field "string" in the concept "Thing"'
        })
    ]));
    expect(results.result).toBe(CompareResult.MAJOR);
});

test('should detect a string validator being removed from a property', async () => {
    const [a, b] = await getModelFiles('string-validator-added.cto', 'validators.cto');
    const results = new Compare().compare(a, b);
    expect(results.findings).toEqual(expect.arrayContaining([
        expect.objectContaining({
            key: 'property-validator-removed',
            message: 'A string validator was removed from the field "string" in the concept "Thing"'
        })
    ]));
    expect(results.result).toBe(CompareResult.PATCH);
});

test('should detect a string validator being changed on a property', async () => {
    const [a, b] = await getModelFiles('string-validator-added.cto', 'string-validator-changed.cto');
    const results = new Compare().compare(a, b);
    expect(results.findings).toEqual(expect.arrayContaining([
        expect.objectContaining({
            key: 'property-validator-changed',
            message: 'A string validator for the field "string" in the concept "Thing" was changed and is no longer compatible'
        })
    ]));
    expect(results.result).toBe(CompareResult.MAJOR);
});
