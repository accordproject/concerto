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
    bFileName: string
): Promise<[a: ModelFile, b: ModelFile]> {
    const modelManager = new ModelManager({ versionedNamespacesStrict: true });
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
            key: 'required-field-added',
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
            key: 'field-removed',
            message: 'The field "value" was removed from the concept "Thing"'
        })
    ]));
    expect(results.result).toBe(CompareResult.MAJOR);
});

test('should detect an optional field being added', async () => {
    const [a, b] = await getModelFiles('optional-field-added-a.cto', 'optional-field-added-b.cto');
    const results = new Compare().compare(a, b);
    expect(results.findings).toEqual(expect.arrayContaining([
        expect.objectContaining({
            key: 'optional-field-added',
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
            key: 'field-removed',
            message: 'The field "value" was removed from the concept "Thing"'
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
