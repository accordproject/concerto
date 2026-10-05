import { readdirSync, readFileSync, statSync } from 'fs';
import { createRequire } from 'module';
import { join } from 'path';

import { IModel, IModels } from '@accordproject/concerto-metamodel';
import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';

import { CONCERTINO_VERSION, convertToConcertino, convertToMetamodel } from '../src/';
import * as R from '../src/runtime';
import { PROBE_MODELS } from './probes';
// The pinned 5.0.0 writer, converter and reader (see reader-5.0.0/README.md).
import { convertToConcertino as convertToConcertino500 } from './reader-5.0.0/concertinoSerializer';
import { convertToMetamodel as convertToMetamodel500 } from './reader-5.0.0/metamodelSerializer';
import * as R500 from './reader-5.0.0/runtime';

/* eslint-disable @typescript-eslint/no-explicit-any */

/*
 * Format 5.1.0 is additive (the A4 policy: a new minor version only adds
 * optional fields, and a reader of an earlier minor version reads a document
 * of a later one the same way). So a 5.0.0 reader must read the 5.1.0
 * document of a model exactly as it reads the 5.0.0 document of the same
 * model: the same fields, the same own and inherited properties, metadata
 * and vocabulary, and the same metamodel back.
 */

const require_ = createRequire(__filename);
const { ModelManager } = require_('@accordproject/concerto-core');
const { Parser } = require_('@accordproject/concerto-cto');

const strip = (x: unknown) => JSON.parse(JSON.stringify(x, (k, v) => (k === 'location' ? undefined : v)));
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

const SCHEMA_500 = JSON.parse(readFileSync(join(__dirname, 'reader-5.0.0', 'spec', 'concertino.schema.json'), 'utf8'));
const GAPS_CTO = readFileSync(join(__dirname, 'gaps', 'gaps.cto'), 'utf8');
const GAPS_500 = JSON.parse(readFileSync(join(__dirname, 'gaps', 'gaps.concertino-5.0.0.json'), 'utf8'));

/**
 * The resolved metamodel concerto-core gives for some CTO files.
 * @param {string[]} ctos - The CTO files.
 * @returns {IModels} The metamodel.
 */
function managed(ctos: string[]): IModels {
    const modelManager = new ModelManager({ importAliasing: true, enableMapType: true });
    ctos.forEach((cto, i) => modelManager.addCTOModel(cto, `m${i}.cto`));
    return strip(modelManager.getAst(true));
}

/**
 * The sample models of concertino.test.ts (test/cto), loaded as it loads them.
 * @returns {IModels} The metamodel.
 */
function sampleModels(): IModels {
    const models: IModel[] = [];
    const load = (dir: string) => readdirSync(dir).forEach((file) => {
        const path = join(dir, file);
        if (statSync(path).isDirectory()) {
            load(path);
        } else if (file.endsWith('.cto')) {
            models.push(Parser.parse(readFileSync(path, 'utf8'), path, { skipLocationNodes: true }));
        }
    });
    load(join(__dirname, 'cto'));
    const modelManager = new ModelManager();
    modelManager.fromAst({ models });
    const ast: IModels = modelManager.getAst(true);
    ast.models = ast.models.map((model) => modelManager.resolveMetaModel(model) as IModel);
    return strip(ast);
}

// Decorators in every position on every kind of decorated element.
const DECORATORS_CTO = [
    'namespace d@1.0.0',
    '@A @Term_x("x") @B @Term("l") @Term_y("y")',
    'concept C {',
    '  @A @Term("p") @B(1) @Term_z("z") o String s',
    '  @Term_z("z") @Term("q") o String t',
    '  @Term("r") @Term_z("z") @C o String u',
    '}',
    '@Term_a("a") @Term("label")',
    'asset Thing identified by id { @Hidden @Term("Id") o String id }',
    'enum E { @A @Term("e") o V @Term("w") @A o W }',
    '@A @Term("m")',
    'map M { @A @Term("k") o String @B @Term("v") o String }',
    '@A @Term("s")',
    'scalar S extends String',
    '@Term() @Foo("bar") @Term_q("q")',
    'transaction T { o S s }',
].join('\n');

// Parsed only (concerto-core rejects repeated decorators); the converters keep them.
const REPEATS_CTO = [
    'namespace r@1.0.0',
    '@B("1") @Term("dup") @Term("dup2") @Term_q("a") @Term_q("b")',
    'concept D {}',
    '@Term("a") @B @Term("b")',
    'concept E { @B @Term_x("x") @Term_x("y") o String s }',
].join('\n');

/**
 * The metamodel of a CTO file, parsed only.
 * @param {string} cto - The CTO file.
 * @returns {IModels} The metamodel.
 */
function parsed(cto: string): IModels {
    return { $class: 'concerto.metamodel@1.0.0.Models', models: [Parser.parse(cto, undefined, { skipLocationNodes: true })] } as IModels;
}

// The test corpus: every model set the package's tests convert. `valid` is
// whether concerto-core accepts it (a parsed-only set may repeat decorators,
// which 5.0.0 itself does not keep).
const CORPUS: { name: string; metamodel: IModels; valid: boolean }[] = [
    { name: 'the sample models (test/cto)', metamodel: sampleModels(), valid: true },
    { name: 'the 5.1.0 gaps model (test/gaps/gaps.cto)', metamodel: managed([GAPS_CTO]), valid: true },
    { name: 'the P5-78 probes (test/probes.ts)', metamodel: managed(PROBE_MODELS), valid: true },
    { name: 'decorators in every position', metamodel: managed([DECORATORS_CTO]), valid: true },
    { name: 'repeated decorators (parsed only)', metamodel: parsed(REPEATS_CTO), valid: false },
];

/**
 * Resolves a schema reference of the 5.0.0 schema.
 * @param {any} schema - A schema.
 * @returns {any} The schema it refers to.
 */
function resolve(schema: any): any {
    let s = schema;
    while (s && s.$ref) {
        s = SCHEMA_500.definitions[s.$ref.split('/').pop()];
    }
    return s;
}

/**
 * What a 5.0.0 reader sees of a value: the fields the 5.0.0 schema
 * declares, the others left out (a reader ignores the optional fields it
 * does not know).
 * @param {any} value - The value.
 * @param {any} schema - Its 5.0.0 schema.
 * @returns {any} The value, with the fields 5.0.0 knows.
 */
function as500(value: any, schema: any = SCHEMA_500): any {
    const s = resolve(schema);
    if (!s || value === null || typeof value !== 'object') {
        return value;
    }
    if (Array.isArray(s.oneOf) && s.oneOf.every((branch: any) => branch.$ref) && !Array.isArray(value)) {
        // A declaration: the branch its `type` names.
        const branch = s.oneOf.map(resolve).find((b: any) => b.properties?.type?.const === value.type || b.properties?.type?.enum?.includes(value.type));
        return as500(value, branch);
    }
    if (Array.isArray(value)) {
        return s.items && !Array.isArray(s.items) ? value.map((item) => as500(item, s.items)) : value;
    }
    if (s.type !== 'object') {
        return value;
    }
    const result: any = {};
    for (const [key, field] of Object.entries(value)) {
        if (s.properties && key in s.properties) {
            result[key] = as500(field, s.properties[key]);
        } else if (s.additionalProperties && typeof s.additionalProperties === 'object') {
            result[key] = as500(field, s.additionalProperties);
        } else if (!s.properties && s.additionalProperties === undefined) {
            result[key] = field;
        }
    }
    return result;
}

const PROPERTY_500 = SCHEMA_500.definitions.Property;

/**
 * `isEnum` is the one field 5.0.0 declared and never wrote. 5.1.0 writes it,
 * with its 5.0.0 meaning (the type is an enum declared in the document); the
 * 5.0.0 reader and converter do not read it. Left out of the comparison,
 * once checked.
 * @param {any} doc - A 5.1.0 document, as a 5.0.0 reader sees it.
 * @returns {any} The document without `isEnum`.
 */
function withoutIsEnum(doc: any): any {
    const result = clone(doc);
    for (const declaration of Object.values(result.declarations) as any[]) {
        for (const property of Object.values(declaration.properties ?? {}) as any[]) {
            if ('isEnum' in property) {
                expect(property.isEnum).toBe(true);
                expect(result.declarations[property.type]?.type).toBe('EnumDeclaration');
                delete property.isEnum;
            }
        }
    }
    return result;
}

/**
 * Everything the 5.0.0 reader (./runtime) answers about a document.
 * @param {any} doc - The document.
 * @returns {any} The answers, by declaration.
 */
function view500(doc: any): any {
    const m = R500.load(doc);
    // A property as the 5.0.0 reader sees it, without `isEnum` (see withoutIsEnum).
    const property = (p: any) => {
        const { isEnum, ...seen } = as500(p, PROPERTY_500);
        if (isEnum !== undefined) {
            expect(isEnum).toBe(true);
            expect(R500.propertyKind(m, p)).toBe('enum');
        }
        return seen;
    };
    const decorated = (fqn: string, name?: string) => ({ metadata: R500.getDecorators(m, fqn, name), vocabulary: R500.getVocabulary(m, fqn, name) });
    return {
        namespaces: R500.getNamespaces(m),
        namespaceDecorators: R500.getNamespaces(m).map((ns) => R500.getNamespaceDecorators(m, ns)),
        declarations: Object.fromEntries(R500.getDeclarationNames(m).map((fqn) => [fqn, {
            kind: R500.kindOf(m, fqn),
            isAbstract: R500.isAbstract(m, fqn),
            superTypes: R500.getSuperTypes(m, fqn),
            assignable: R500.getAssignableTypes(m, fqn),
            identifier: R500.getIdentifierFieldName(m, fqn),
            properties: R500.getProperties(m, fqn).map(property),
            ownProperties: R500.getProperties(m, fqn, true).map(property),
            propertyKinds: R500.getProperties(m, fqn).map((p) => R500.propertyKind(m, p)),
            propertyDecorators: R500.getProperties(m, fqn).map((p) => decorated(fqn, p.name)),
            enumValues: R500.getEnumValues(m, fqn),
            enumValueDecorators: R500.getEnumValues(m, fqn).map((v) => decorated(fqn, v)),
            mapTypes: R500.getMapTypes(m, fqn),
            ...decorated(fqn),
        }])),
    };
}

describe('the pinned 5.0.0 writer', () => {
    it('should write what 5.0.0 wrote', () => {
        // The fixture P5-130 recorded from the 5.0.0 converter.
        expect(clone(convertToConcertino500(managed([GAPS_CTO])))).toStrictEqual(GAPS_500);
    });
});

describe.each(CORPUS)('a 5.0.0 reader reading the 5.1.0 document of $name', ({ metamodel, valid }) => {
    const doc500 = clone(convertToConcertino500(clone(metamodel)));
    const doc510 = clone(convertToConcertino(clone(metamodel)));

    it('should be given a 5.1.0 document', () => {
        expect(doc500.metadata.concertinoVersion).toBe('5.0.0');
        expect(doc510.metadata.concertinoVersion).toBe(CONCERTINO_VERSION);
        expect(CONCERTINO_VERSION).toBe('5.1.0');
    });

    it('should find every field it knows as 5.0.0 wrote it', () => {
        const seen = withoutIsEnum(as500(doc510));
        expect(seen).toStrictEqual({ ...doc500, metadata: { ...doc500.metadata, concertinoVersion: CONCERTINO_VERSION } });
        // So the fields it knows pass the 5.0.0 schema. (The 5.0.0 schema
        // check itself is strict, and rejects the fields 5.1.0 adds.)
        const ajv = new Ajv();
        expect(ajv.validate(SCHEMA_500, seen), JSON.stringify(ajv.errors)).toBe(true);
        expect(ajv.validate(SCHEMA_500, doc500), JSON.stringify(ajv.errors)).toBe(true);
    });

    it('should answer every runtime query as for the 5.0.0 document: properties, own properties, metadata and vocabulary', () => {
        expect(view500(doc510)).toStrictEqual(view500(doc500));
    });

    it('should convert it back to the same metamodel, with no decorator repeated', () => {
        expect(convertToMetamodel500(clone(doc510))).toStrictEqual(convertToMetamodel500(clone(doc500)));
        if (valid) {
            // The 5.0.0 converter is lossless over the models concerto-core accepts.
            const back = convertToMetamodel500(clone(doc510));
            metamodel.models.forEach((model) => {
                expect(back.models.find((m) => m.namespace === model.namespace), model.namespace).toStrictEqual(model);
            });
        }
    });
});

describe.each(CORPUS)('a 5.1.0 reader reading $name', ({ metamodel }) => {
    const doc500 = clone(convertToConcertino500(clone(metamodel)));
    const doc510 = clone(convertToConcertino(clone(metamodel)));

    it('should convert the 5.1.0 document back to the metamodel, with no decorator repeated', () => {
        const back = convertToMetamodel(clone(doc510));
        metamodel.models.forEach((model) => {
            expect(back.models.find((m) => m.namespace === model.namespace), model.namespace).toStrictEqual(model);
        });
    });

    it('should answer the runtime queries for the 5.0.0 document as for the 5.1.0 one', () => {
        const m500 = R.load(doc500);
        const m510 = R.load(doc510);
        expect(R.getDeclarationNames(m500)).toStrictEqual(R.getDeclarationNames(m510));
        for (const fqn of R.getDeclarationNames(m510)) {
            expect(R.kindOf(m500, fqn), fqn).toBe(R.kindOf(m510, fqn));
            expect(R.getSuperTypes(m500, fqn), fqn).toStrictEqual(R.getSuperTypes(m510, fqn));
            expect(R.getIdentifierFieldName(m500, fqn), fqn).toBe(R.getIdentifierFieldName(m510, fqn));
            expect(R.getProperties(m500, fqn).map((p) => p.name).sort(), fqn).toStrictEqual(R.getProperties(m510, fqn).map((p) => p.name).sort());
            for (const p of R.getProperties(m510, fqn)) {
                expect(R.propertyKind(m500, R.getProperty(m500, fqn, p.name)!), `${fqn}.${p.name}`).toBe(R.propertyKind(m510, p));
            }
        }
    });
});

// 5.0.0 kept one metadata entry per decorator name, so a 5.0.0 document of a
// model that repeats a decorator lost the repeats; the others convert back whole.
describe.each(CORPUS.filter(({ valid }) => valid))('a 5.1.0 reader reading the 5.0.0 document of $name', ({ metamodel }) => {
    it('should convert it back to the same metamodel as the 5.1.0 document', () => {
        const doc500 = clone(convertToConcertino500(clone(metamodel)));
        const doc510 = clone(convertToConcertino(clone(metamodel)));
        expect(convertToMetamodel(clone(doc500))).toStrictEqual(convertToMetamodel(clone(doc510)));
    });
});
