import { readFileSync } from 'fs';
import { join } from 'path';

import { ModelManager, ModelUtil } from '@accordproject/concerto-core';
import { Parser } from '@accordproject/concerto-cto';
import { IModel, IModels } from '@accordproject/concerto-metamodel';
import Ajv from 'ajv';
import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';

import { ConcertinoConverter, convertToConcertino, convertToMetamodel } from '../src/';
import { getNamespace, getShortName } from '../src/names';
import * as R from '../src/runtime';
import { checkSchema, isValid } from '../src/schema';
import schema from '../src/spec/concertino.schema.json';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { generate, OUT } = require('../scripts/generateSchemaValidator.js');

/* eslint-disable @typescript-eslint/no-explicit-any */

const strip = (x: unknown) => JSON.parse(JSON.stringify(x, (k, v) => (k === 'location' ? undefined : v)));

/**
 * The resolved metamodel of some CTO files, as ModelManager.getAst(true) gives it.
 * @param {string[]} ctos - The CTO files.
 * @returns {IModels} The resolved metamodel.
 */
function resolved(ctos: string[]): IModels {
    const modelManager = new ModelManager({ importAliasing: true, enableMapType: true } as any);
    ctos.forEach((cto, i) => modelManager.addCTOModel(cto, `m${i}.cto`));
    return strip(modelManager.getAst(true));
}

/**
 * The parsed (unresolved) metamodel of one CTO file.
 * @param {string} cto - The CTO file.
 * @returns {IModels} The metamodel.
 */
function parsed(cto: string): IModels {
    return {
        $class: 'concerto.metamodel@1.0.0.Models',
        models: [Parser.parse(cto, undefined, { skipLocationNodes: true }) as IModel],
    };
}

/**
 * Converts a metamodel to Concertino and back, and checks nothing is lost.
 * @param {IModels} metamodel - The metamodel.
 * @returns {any} The Concertino document.
 */
function expectLosslessRoundTrip(metamodel: IModels): any {
    const concertino = convertToConcertino(JSON.parse(JSON.stringify(metamodel)));
    const back = convertToMetamodel(JSON.parse(JSON.stringify(concertino)));
    metamodel.models.forEach((model) => {
        expect(back.models.find((m) => m.namespace === model.namespace)).toStrictEqual(model);
    });
    expect(checkSchema(concertino)).toBeNull();
    return concertino;
}

describe('name helpers', () => {
    it('should give the same results as ModelUtil', () => {
        for (const fqn of ['a.b@1.0.0.Foo', 'a@1.0.0.Foo', 'Foo', 'org.acme.Thing', '.Foo', 'a.']) {
            expect(getShortName(fqn)).toBe(ModelUtil.getShortName(fqn));
            expect(getNamespace(fqn)).toBe(ModelUtil.getNamespace(fqn));
        }
        expect(() => getNamespace('')).toThrow();
    });
});

describe('precompiled schema validator', () => {
    it('should be up to date with concertino.schema.json', () => {
        expect(readFileSync(OUT, 'utf8')).toBe(generate());
    });

    it('should not need ajv or compile code at run time', () => {
        const code = readFileSync(OUT, 'utf8');
        expect(code).not.toMatch(/require\(/);
        expect(code).not.toMatch(/new Function/);
    });

    it('should report the same errors as ajv compiling the schema at run time', () => {
        const reference = new Ajv().compile(schema);
        const valid: any = {
            declarations: {
                'a@1.0.0.X': {
                    type: 'ConceptDeclaration',
                    properties: { p: { name: 'p', type: 'Integer', range: [1, null], metadata: { D: ['x', 1, true, { type: 'a.B' }] }, vocabulary: { label: 'l' } } },
                },
                'a@1.0.0.E': { type: 'EnumDeclaration', values: { A: {} } },
                'a@1.0.0.S': { type: 'StringScalar', length: [1, 2] },
                'a@1.0.0.M': { type: 'MapDeclaration', key: { type: 'String' }, value: { type: 'Integer' } },
            },
            metadata: { concertinoVersion: '5.0.0', models: { 'a@1.0.0': { imports: [] } } },
        };
        const mutate = (f: (d: any) => void) => {
            const d = JSON.parse(JSON.stringify(valid));
            f(d);
            return d;
        };
        const documents = [
            valid,
            null,
            'not a document',
            {},
            mutate((d) => delete d.metadata),
            mutate((d) => (d.metadata.extra = 1)),
            mutate((d) => (d.metadata.models['a@1.0.0'] = 1)),
            mutate((d) => (d.metadata.models['a@1.0.0'].other = 1)),
            mutate((d) => (d.declarations['a@1.0.0.X'].type = 'Nope')),
            mutate((d) => (d.declarations['a@1.0.0.X'].properties.p.range = [1])),
            mutate((d) => (d.declarations['a@1.0.0.X'].properties.p.range = ['1', null])),
            mutate((d) => (d.declarations['a@1.0.0.X'].properties.p.metadata.D = [null])),
            mutate((d) => (d.declarations['a@1.0.0.X'].properties.p.metadata.D = [{ isArray: true }])),
            mutate((d) => (d.declarations['a@1.0.0.X'].properties.p.vocabulary = { label: 1 })),
            mutate((d) => (d.declarations['a@1.0.0.X'].properties.p.vocabulary.additionalTerms = { x: false })),
            mutate((d) => delete d.declarations['a@1.0.0.X'].properties.p.name),
            mutate((d) => (d.declarations['a@1.0.0.E'].values = [])),
            mutate((d) => (d.declarations['a@1.0.0.S'].length = [1, 2, 3])),
            mutate((d) => (d.declarations['a@1.0.0.S'].default = {})),
            mutate((d) => delete d.declarations['a@1.0.0.M'].key),
            mutate((d) => (d.declarations['a@1.0.0.M'].value.isRelationship = 'yes')),
        ];
        let invalid = 0;
        for (const document of documents) {
            const converter = new ConcertinoConverter();
            const expected = reference(document);
            expect(converter.isValid(document)).toBe(expected);
            expect(isValid(document)).toBe(expected);
            expect(converter.getValidationErrors()).toStrictEqual(reference.errors ?? null);
            expect(checkSchema(document)).toStrictEqual(reference.errors ?? null);
            if (!expected) {
                invalid++;
            }
        }
        expect(invalid).toBe(documents.length - 1);
    });

    it('should keep the errors of each converter separate', () => {
        const a = new ConcertinoConverter();
        const b = new ConcertinoConverter();
        expect(a.isValid({} as any)).toBe(false);
        expect(b.isValid({ declarations: {}, metadata: { concertinoVersion: '5.0.0', models: {} } })).toBe(true);
        expect(a.getValidationErrors()).not.toBeNull();
        expect(b.getValidationErrors()).toBeNull();
    });
});

describe('entry points', () => {
    /**
     * Bundles some code over the package sources for the browser.
     * @param {string} contents - The entry module.
     * @returns {Promise<string>} The minified bundle.
     */
    async function bundle(contents: string): Promise<string> {
        const result = await build({
            stdin: { contents, resolveDir: join(__dirname, '..', 'src'), loader: 'ts' },
            bundle: true, write: false, format: 'esm', platform: 'browser', minify: true, treeShaking: true, logLevel: 'silent',
        });
        return result.outputFiles[0].text;
    }

    it('should leave the schema validator out of a converter-only bundle', async () => {
        const code = await bundle('export { convertToConcertino, convertToMetamodel } from "./index";');
        expect(code).not.toMatch(/must NOT have additional properties|concertino\.schema\.json/);
        expect(code).not.toMatch(/concerto-core/);
    });

    it('should not compile code at run time in any entry point', async () => {
        for (const entry of [
            'export { ConcertinoConverter } from "./index";',
            'export { isValid, checkSchema } from "./schema";',
            'export * from "./runtime";',
            'export * from "./validate";',
            'export * from "./resolve";',
        ]) {
            const code = await bundle(entry);
            expect(code).not.toMatch(/new Function/);
            expect(code).not.toMatch(/require\(/);
        }
    });

    it('should keep the runtime and validate subpaths free of the converter, the schema checks and concerto-core', async () => {
        for (const entry of ['export * from "./runtime";', 'export * from "./runtime"; export * from "./validate";']) {
            const code = await bundle(entry);
            expect(code).not.toMatch(/must NOT have additional properties|concertino\.schema\.json/);
            expect(code).not.toMatch(/concerto-core|concerto\.metamodel@1\.0\.0/);
        }
    });

    it('should list every subpath in the bundle size script', () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { subpaths } = require('../scripts/bundleSizes.js');
        expect(subpaths()).toStrictEqual(['.', './schema', './runtime', './validate', './resolve']);
    });
});

describe('converter fixes', () => {
    it('should keep an aliased import', () => {
        const metamodel = resolved([
            'namespace b@1.0.0\nconcept Foo {}\nconcept Baz {}\nscalar Num extends Integer\nscalar Code extends String\nasset Thing identified by id { o String id }',
            'namespace a@1.0.0\nimport b@1.0.0.{Foo as Bar, Baz, Num as N, Code as K, Thing as T}\n@X(Bar)\nconcept C extends Bar { o Bar f o Baz g --> T r o N n }\nmap M { o K o Bar }',
        ]);
        const concertino = expectLosslessRoundTrip(metamodel);
        // Concertino names the declared type, which exists; `b@1.0.0.Bar` does not.
        expect(concertino.declarations['a@1.0.0.C'].extends).toStrictEqual(['b@1.0.0.Foo']);
        expect(concertino.declarations['a@1.0.0.C'].properties.f.type).toBe('b@1.0.0.Foo');
        expect(concertino.declarations['a@1.0.0.C'].properties.n.scalarType).toBe('b@1.0.0.Num');
        expect(concertino.declarations['a@1.0.0.C'].metadata.X).toStrictEqual([{ type: 'b@1.0.0.Foo' }]);
        expect(concertino.declarations['a@1.0.0.C'].properties.r.type).toBe('b@1.0.0.Thing');
        expect(concertino.declarations['a@1.0.0.M'].key.type).toBe('b@1.0.0.Code');
        expect(concertino.declarations['a@1.0.0.M'].value.type).toBe('b@1.0.0.Foo');
    });

    it('should keep one-sided ranges', () => {
        const metamodel = resolved([
            'namespace r@1.0.0\nscalar Upper extends Double range=[,1.0]\nscalar Lower extends Integer range=[0,]\nconcept C { o Double d range=[,1.0] o Long l range=[5,] o Upper u o Lower w }',
        ]);
        const concertino = expectLosslessRoundTrip(metamodel);
        const c = concertino.declarations['r@1.0.0.C'];
        expect(c.properties.d.range).toStrictEqual([null, 1]);
        expect(c.properties.l.range).toStrictEqual([5, null]);
        expect(c.properties.u.range).toStrictEqual([null, 1]);
        expect(c.properties.w.range).toStrictEqual([0, null]);
        expect(concertino.declarations['r@1.0.0.Upper'].range).toStrictEqual([null, 1]);
    });

    it('should keep falsy scalar defaults', () => {
        const metamodel = resolved([
            'namespace d@1.0.0\nscalar Zero extends Integer default=0\nscalar No extends Boolean default=false\nscalar Empty extends String default=""\nscalar ZeroD extends Double default=0.0\nconcept C { o Zero z o No n o Empty e o ZeroD f }',
        ]);
        const concertino = expectLosslessRoundTrip(metamodel);
        const c = concertino.declarations['d@1.0.0.C'];
        expect(c.properties.z.default).toBe(0);
        expect(c.properties.n.default).toBe(false);
        expect(c.properties.e.default).toBe('');
        expect(c.properties.f.default).toBe(0);
    });

    it('should keep the argument types of vocabulary decorators', () => {
        const metamodel = parsed('namespace v@1.0.0\n@Term(1)\nconcept C { @Term(false) @Term_x(true) @Term_y(2.5) o String s }\n@Term("T") @Term_z(0)\nenum E { o A }');
        const concertino = expectLosslessRoundTrip(metamodel);
        expect(concertino.declarations['v@1.0.0.C'].metadata).toStrictEqual({ Term: [1] });
        expect(concertino.declarations['v@1.0.0.C'].properties.s.metadata).toStrictEqual({ Term: [false], Term_x: [true], Term_y: [2.5] });
        expect(concertino.declarations['v@1.0.0.E'].vocabulary).toStrictEqual({ label: 'T' });
        expect(concertino.declarations['v@1.0.0.E'].metadata).toStrictEqual({ Term_z: [0] });
    });

    it('should keep empty-string vocabulary arguments', () => {
        const metamodel = parsed('namespace v@1.0.0\n@Term("")\nconcept C { @Term("") @Term_x("") o String s }\n@Term\nconcept D { @Term() o String s }');
        const concertino = expectLosslessRoundTrip(metamodel);
        expect(concertino.declarations['v@1.0.0.C'].vocabulary).toStrictEqual({ label: '' });
        expect(concertino.declarations['v@1.0.0.C'].properties.s.vocabulary).toStrictEqual({ label: '', additionalTerms: { x: '' } });
        // `@Term()` is a null label; `@Term` (no argument list) is kept as metadata.
        expect(concertino.declarations['v@1.0.0.D'].properties.s.vocabulary).toStrictEqual({ label: null });
        expect(concertino.declarations['v@1.0.0.D'].metadata).toStrictEqual({ Term: null });
    });

    it('should keep decorator names containing an underscore', () => {
        const metamodel = parsed('namespace v@1.0.0\n@Term("C") @Term_my_type("t")\nconcept C { @Term_a_b_c("x") o String s }');
        const concertino = expectLosslessRoundTrip(metamodel);
        expect(concertino.declarations['v@1.0.0.C'].vocabulary).toStrictEqual({ label: 'C', additionalTerms: { my_type: 't' } });
        expect(concertino.declarations['v@1.0.0.C'].properties.s.vocabulary).toStrictEqual({ additionalTerms: { a_b_c: 'x' } });
    });

    it('should keep the order of decorators next to vocabulary', () => {
        const metamodel = parsed([
            'namespace v@1.0.0',
            '@M1("some value") @Term_participantName("some value")',
            'participant P identified by id { o String id }',
            '@Term_x("x") @Term("label") @M2',
            'concept C { @M3 @Term("late") o String s }',
            '@Term("a") @Term_b("b") @M4(1)',
            'concept D {}',
        ].join('\n'));
        const concertino = expectLosslessRoundTrip(metamodel);
        // vocabulary and metadata are as 5.0.0 wrote them: a term that is not
        // in leading position stays in metadata. Since 5.1.0, fullVocabulary
        // also has every term, and decoratorOrder keeps the source order.
        const P = concertino.declarations['v@1.0.0.P'];
        expect(P).not.toHaveProperty('vocabulary');
        expect(P.metadata).toStrictEqual({ M1: ['some value'], Term_participantName: ['some value'] });
        expect(P.fullVocabulary).toStrictEqual({ additionalTerms: { participantName: 'some value' } });
        expect(P.decoratorOrder).toStrictEqual(['M1', 'Term_participantName']);
        const C = concertino.declarations['v@1.0.0.C'];
        // 5.0.0 kept a label after an additional term in metadata.
        expect(C.vocabulary).toStrictEqual({ additionalTerms: { x: 'x' } });
        expect(C.metadata).toStrictEqual({ Term: ['label'], M2: null });
        expect(C.fullVocabulary).toStrictEqual({ label: 'label', additionalTerms: { x: 'x' } });
        expect(C.decoratorOrder).toStrictEqual(['Term_x', 'Term', 'M2']);
        expect(C.properties.s).not.toHaveProperty('vocabulary');
        expect(C.properties.s.metadata).toStrictEqual({ M3: null, Term: ['late'] });
        expect(C.properties.s.fullVocabulary).toStrictEqual({ label: 'late' });
        expect(C.properties.s.decoratorOrder).toStrictEqual(['M3', 'Term']);
        // A 5.1.0 reader reads every term as vocabulary, and no term as metadata.
        const m = R.load(concertino);
        expect(R.getVocabulary(m, 'v@1.0.0.P')).toStrictEqual({ additionalTerms: { participantName: 'some value' } });
        expect(R.getDecorators(m, 'v@1.0.0.P')).toStrictEqual({ M1: ['some value'] });
        expect(R.getVocabulary(m, 'v@1.0.0.C')).toStrictEqual({ label: 'label', additionalTerms: { x: 'x' } });
        expect(R.getDecorators(m, 'v@1.0.0.C')).toStrictEqual({ M2: null });
        expect(R.getVocabulary(m, 'v@1.0.0.C', 's')).toStrictEqual({ label: 'late' });
        expect(R.getDecorators(m, 'v@1.0.0.C', 's')).toStrictEqual({ M3: null });
        // The usual order (label, terms, then the rest) needs no decoratorOrder.
        const D = concertino.declarations['v@1.0.0.D'];
        expect(D.vocabulary).toStrictEqual({ label: 'a', additionalTerms: { b: 'b' } });
        expect(D.metadata).toStrictEqual({ M4: [1] });
        expect(D).not.toHaveProperty('decoratorOrder');
        expect(D).not.toHaveProperty('fullVocabulary');
    });

    it('should keep type-reference decorator arguments without a namespace', () => {
        const metamodel = parsed('namespace t@1.0.0\n@Foo(String) @Bar(Integer[])\nconcept C { @Baz(DateTime) o String s }');
        const concertino = expectLosslessRoundTrip(metamodel);
        expect(concertino.declarations['t@1.0.0.C'].metadata).toStrictEqual({ Foo: [{ type: 'String' }], Bar: [{ type: 'Integer', isArray: true }] });
    });
});
