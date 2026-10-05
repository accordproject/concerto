import { readdirSync, readFileSync } from 'fs';
import { createRequire } from 'module';
import { join, relative } from 'path';

import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';

import { convertToConcertino } from '../src/';
import { implicitSuperType, resolveModels, ResolutionError } from '../src/resolve';
import { load } from '../src/runtime';
import { normalise } from '../src/validate';
import { PROBE_INSTANCES, PROBE_MODELS } from './probes';

/* eslint-disable @typescript-eslint/no-explicit-any */

// concerto-core and concerto-cto through Node's own require (see validate.test.ts).
const nodeRequire = createRequire(__filename);
const { ModelFile, ModelManager } = nodeRequire('@accordproject/concerto-core');
const { Parser } = nodeRequire('@accordproject/concerto-cto');

const MM = 'concerto.metamodel@1.0.0';
const CORE_TEST_DATA = join(__dirname, '..', '..', 'concerto-core', 'test', 'data');

/**
 * Drops the source locations of an AST.
 * @param {unknown} x - The AST.
 * @returns {any} The AST without locations.
 */
const strip = (x: unknown): any => JSON.parse(JSON.stringify(x, (k, v) => (k === 'location' ? undefined : v)));

/**
 * Sorts the models of a `Models` AST by namespace.
 * @param {any} x - The `Models` AST.
 * @returns {any} The sorted AST.
 */
const byNamespace = (x: any): any => ({ ...x, models: [...x.models].sort((p: any, q: any) => (p.namespace < q.namespace ? -1 : 1)) });

/**
 * Loads model ASTs into a concerto-core model manager and validates them, as
 * concerto-core loads model files (no CTO parsing in between).
 * @param {any[]} asts - The model ASTs.
 * @returns {any} The model manager.
 */
function coreLoad(asts: any[]): any {
    const modelManager = new ModelManager({ importAliasing: true, enableMapType: true });
    asts.forEach((ast, i) => modelManager.addModelFile(new ModelFile(modelManager, ast, undefined, `m${i}.cto`), undefined, `m${i}.cto`, true));
    modelManager.validateModelFiles();
    return modelManager;
}

/**
 * The class of the exception concerto-core throws loading some model ASTs, or null.
 * @param {any[]} asts - The model ASTs.
 * @returns {string | null} The exception class.
 */
function coreError(asts: any[]): string | null {
    try {
        coreLoad(asts);
        return null;
    } catch (e: any) {
        return e.constructor.name;
    }
}

/**
 * Every concerto-core test/data CTO file that parses.
 * @returns {Array<{name: string, ast: any}>} The files and their ASTs.
 */
function coreTestData(): Array<{ name: string; ast: any }> {
    const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true })
        .flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.cto') ? [join(dir, e.name)] : []));
    const out: Array<{ name: string; ast: any }> = [];
    for (const file of walk(CORE_TEST_DATA).sort()) {
        try {
            out.push({ name: relative(CORE_TEST_DATA, file), ast: Parser.parse(readFileSync(file, 'utf8')) });
        } catch {
            // does not parse: not a model for this check
        }
    }
    return out;
}

const cto = (name: string) => readFileSync(join(__dirname, 'cto', name), 'utf8');

describe('resolveModels: the resolved AST', () => {
    const sets: Array<{ name: string; asts: any[] }> = [
        { name: 'probes', asts: PROBE_MODELS.map((m) => Parser.parse(m)) },
        { name: 'hr', asts: [Parser.parse(cto('hr_base.cto')), Parser.parse(cto('hr.cto'))] },
        ...['agreement.cto', 'collectionsize.cto', 'readme.cto', 'sample.cto', 'stringlength.cto']
            .map((name) => ({ name, asts: [Parser.parse(cto(name))] })),
    ];

    it.each(sets)('should resolve $name as ModelManager.getAst(true) does', ({ asts }) => {
        const expected = strip(coreLoad(asts).getAst(true));
        const { models, diagnostics } = resolveModels(asts);
        expect(diagnostics).toStrictEqual([]);
        expect(byNamespace(strip(models))).toStrictEqual(byNamespace(expected));
    });

    it('should resolve every concerto-core test/data model that loads on its own as getAst(true) does, with no diagnostics', () => {
        let compared = 0;
        let loadable = 0;
        const differs: string[] = [];
        for (const { name, ast } of coreTestData()) {
            let expected;
            try {
                const modelManager = coreLoad([ast]);
                loadable++;
                expected = strip(modelManager.getAst(true));
            } catch {
                // not loadable on its own, or getAst(true) throws (decorator type references to
                // primitives or undeclared types, the P5-78 finding): checked for diagnostics only
                if (coreError([ast]) === null) {
                    expect(resolveModels([ast]).diagnostics, name).toStrictEqual([]);
                }
                continue;
            }
            const { models, diagnostics } = resolveModels([ast]);
            expect(diagnostics, name).toStrictEqual([]);
            if (JSON.stringify(byNamespace(strip(models))) !== JSON.stringify(byNamespace(expected))) {
                differs.push(name);
            }
            compared++;
        }
        expect(differs).toStrictEqual([]);
        // 94 of these files at the time of writing (P5-128); test/data may grow.
        expect(compared).toBeGreaterThanOrEqual(90);
        expect(loadable).toBeGreaterThanOrEqual(compared);
    });

    it('should not change its input', () => {
        const asts = PROBE_MODELS.map((m) => Parser.parse(m));
        const before = JSON.stringify(asts);
        resolveModels(asts);
        expect(JSON.stringify(asts)).toBe(before);
    });

    it('should take a Models AST as well as an array', () => {
        const asts = PROBE_MODELS.map((m) => Parser.parse(m));
        expect(resolveModels({ models: asts })).toStrictEqual(resolveModels(asts));
    });

    it('should resolve aliased imports with resolvedName', () => {
        const { models } = resolveModels(PROBE_MODELS.map((m) => Parser.parse(m)));
        const main = models.models.find((m: any) => m.namespace === 'probe.main@1.0.0');
        const thing = main.declarations.find((d: any) => d.superType && d.superType.name === 'BaseThing');
        expect(thing.superType).toStrictEqual(expect.objectContaining({ name: 'BaseThing', namespace: 'probe.base@1.0.0', resolvedName: 'Thing' }));
    });

    it('should name the implicit system super type of each declaration kind', () => {
        expect(implicitSuperType(`${MM}.AssetDeclaration`)).toBe('concerto@1.0.0.Asset');
        expect(implicitSuperType(`${MM}.ParticipantDeclaration`)).toBe('concerto@1.0.0.Participant');
        expect(implicitSuperType(`${MM}.TransactionDeclaration`)).toBe('concerto@1.0.0.Transaction');
        expect(implicitSuperType(`${MM}.EventDeclaration`)).toBe('concerto@1.0.0.Event');
        expect(implicitSuperType(`${MM}.ConceptDeclaration`)).toBeUndefined();
    });
});

/**
 * A model AST, from CTO text or as given.
 * @param {string | any} m - CTO text, or an AST.
 * @returns {any} The AST.
 */
const ast = (m: string | any): any => (typeof m === 'string' ? Parser.parse(m) : m);

/**
 * A hand-written model AST (for what the CTO grammar rejects).
 * @param {string} namespace - The namespace.
 * @param {any[]} declarations - The declarations.
 * @param {any[]} [imports] - The imports.
 * @returns {any} The AST.
 */
const model = (namespace: string, declarations: any[], imports?: any[]): any => ({
    $class: `${MM}.Model`, namespace, ...(imports ? { imports } : {}), declarations,
});
const concept = (name: string): any => ({ $class: `${MM}.ConceptDeclaration`, name, isAbstract: false, properties: [] });

// One case per resolution check of the P5-78 catalogue (R01 to R16), plus self-extension (S06).
const CASES: Array<{ id: string; code: string; models: Array<string | any> }> = [
    { id: 'R01', code: 'namespace-unversioned', models: ['namespace test\nconcept A {}'] },
    { id: 'R02', code: 'namespace-part', models: [model('1test@1.0.0', [concept('A')])] },
    { id: 'R03', code: 'namespace-duplicate', models: ['namespace test@1.0.0\nconcept A {}', 'namespace test@1.0.0\nconcept B {}'] },
    { id: 'R04', code: 'import-unversioned', models: ['namespace a@1.0.0\nconcept A {}', 'namespace test@1.0.0\nimport a.A\nconcept B {}'] },
    {
        // The CTO grammar of concerto-cto 5 has no wildcard import: a hand-written AST.
        id: 'R05', code: 'import-wildcard', models: ['namespace a@1.0.0\nconcept A {}', model('test@1.0.0', [concept('B')], [
            { $class: `${MM}.ImportAll`, namespace: 'a@1.0.0' },
        ])],
    },
    {
        id: 'R06', code: 'import-alias-primitive', models: ['namespace a@1.0.0\nconcept A {}', model('test@1.0.0', [concept('B')], [
            { $class: `${MM}.ImportTypes`, namespace: 'a@1.0.0', types: ['A'], aliasedTypes: [{ $class: `${MM}.AliasedType`, name: 'A', aliasedName: 'String' }] },
        ])],
    },
    { id: 'R07', code: 'import-namespace-unknown', models: ['namespace test@1.0.0\nimport a@1.0.0.A\nconcept B {}'] },
    { id: 'R08', code: 'import-type-unknown', models: ['namespace a@1.0.0\nconcept A {}', 'namespace test@1.0.0\nimport a@1.0.0.X\nconcept B {}'] },
    {
        id: 'R09', code: 'import-two-versions', models: ['namespace a@1.0.0\nconcept A {}', 'namespace a@2.0.0\nconcept A2 {}',
            'namespace test@1.0.0\nimport a@1.0.0.A\nimport a@2.0.0.A2\nconcept B {}'],
    },
    { id: 'R10', code: 'declaration-duplicate', models: ['namespace test@1.0.0\nconcept A {}\nconcept A {}'] },
    { id: 'R11', code: 'declaration-clashes-import', models: ['namespace a@1.0.0\nconcept A {}', 'namespace test@1.0.0\nimport a@1.0.0.A\nconcept A {}'] },
    { id: 'R11 (system)', code: 'declaration-clashes-import', models: ['namespace test@1.0.0\nconcept Asset {}'] },
    { id: 'R12', code: 'declaration-name', models: [model('test@1.0.0', [concept('1A')])] },
    {
        id: 'R13', code: 'scalar-primitive-name', models: [model('test@1.0.0', [{ $class: `${MM}.StringScalar`, name: 'String' }])],
    },
    { id: 'R14 (property)', code: 'type-undeclared', models: ['namespace test@1.0.0\nconcept A { o Missing m }'] },
    { id: 'R14 (relationship)', code: 'type-undeclared', models: ['namespace test@1.0.0\nconcept A { --> Missing m }'] },
    { id: 'R14 (super type)', code: 'type-undeclared', models: ['namespace test@1.0.0\nconcept A extends Missing {}'] },
    { id: 'R14 (map key)', code: 'type-undeclared', models: ['namespace test@1.0.0\nmap M { o Missing o String }'] },
    { id: 'R15', code: 'inheritance-circular', models: ['namespace test@1.0.0\nconcept A extends B {}\nconcept B extends A {}'] },
    { id: 'R16', code: 'type-undeclared', models: ['namespace test@1.0.0\nmap M { o String o Missing }'] },
    {
        // concerto-cto rejects self-extension in CTO text: a hand-written AST.
        id: 'S06', code: 'inheritance-circular', models: [model('test@1.0.0', [
            { ...concept('A'), superType: { $class: `${MM}.TypeIdentifier`, name: 'A' } },
        ])],
    },
];

describe('resolveModels: the resolution checks', () => {
    it.each(CASES)('$id: should report $code with the exception class concerto-core throws', ({ code, models }) => {
        const asts = models.map(ast);
        const expected = coreError(asts.map((a) => JSON.parse(JSON.stringify(a))));
        expect(expected).not.toBeNull();
        const { diagnostics } = resolveModels(asts);
        expect(diagnostics.map((d) => d.code)).toContain(code);
        expect(diagnostics[0].errorClass).toBe(expected);
    });

    it.each(CASES)('$id: should throw a ResolutionError named as the class concerto-core throws with failFast', ({ models }) => {
        const asts = models.map(ast);
        const expected = coreError(asts.map((a) => JSON.parse(JSON.stringify(a))));
        let error: any;
        try {
            resolveModels(asts, { failFast: true });
        } catch (e) {
            error = e;
        }
        expect(error).toBeInstanceOf(ResolutionError);
        expect(error.name).toBe(expected);
        expect(error.diagnostics).toHaveLength(1);
    });

    it('should report a missing namespace', () => {
        const { diagnostics } = resolveModels([{ $class: `${MM}.Model`, declarations: [] }]);
        expect(diagnostics.map((d) => [d.code, d.errorClass])).toStrictEqual([['namespace-missing', 'Error']]);
    });

    it('should reject aliased imports when importAliasing is off', () => {
        const asts = ['namespace a@1.0.0\nconcept A {}', 'namespace test@1.0.0\nimport a@1.0.0.{A as B}\nconcept C { o B b }'].map(ast);
        expect(resolveModels(asts).diagnostics).toStrictEqual([]);
        expect(resolveModels(asts, { importAliasing: false }).diagnostics.map((d) => d.code)).toStrictEqual(['import-alias-disabled']);
    });

    it('should collect every diagnostic by default', () => {
        const { diagnostics } = resolveModels([ast('namespace test@1.0.0\nconcept A { o Missing m o Other o }\nconcept A {}')]);
        expect(diagnostics.map((d) => d.code)).toStrictEqual(['declaration-duplicate', 'type-undeclared', 'type-undeclared']);
        expect(diagnostics.every((d) => d.namespace === 'test@1.0.0')).toBe(true);
    });

    it('should accept the decorator model and system types without declaring them', () => {
        const asts = ['namespace test@1.0.0\nimport concerto.decorator@1.0.0.Decorator\nconcept Tag extends Decorator {}\nasset A { o String s }\nconcept C extends Concept {}'].map(ast);
        expect(coreError(asts.map((a) => JSON.parse(JSON.stringify(a))))).toBeNull();
        expect(resolveModels(asts).diagnostics).toStrictEqual([]);
    });
});

describe('the browser CTO pipeline', () => {
    it('should give the Concertino document concerto-core gives (parse, resolve, convert)', () => {
        for (const ctos of [PROBE_MODELS, [cto('hr_base.cto'), cto('hr.cto')]]) {
            const modelManager = new ModelManager({ importAliasing: true, enableMapType: true });
            ctos.forEach((c, i) => modelManager.addCTOModel(c, `m${i}.cto`));
            const expected = convertToConcertino(strip(modelManager.getAst(true)));
            const { models } = resolveModels(ctos.map((c) => Parser.parse(c)), { failFast: true });
            const actual = convertToConcertino(strip(models));
            expect(JSON.parse(JSON.stringify(actual))).toStrictEqual(JSON.parse(JSON.stringify(expected)));
        }
    });

    it('should validate the probe instances through the pipeline', () => {
        const model = load(convertToConcertino(resolveModels(PROBE_MODELS.map((m) => Parser.parse(m)), { failFast: true }).models));
        let accepted = 0;
        for (const json of PROBE_INSTANCES) {
            try {
                normalise(model, json);
                accepted++;
            } catch {
                // rejected: validate.test.ts compares each verdict with concerto-core
            }
        }
        expect(accepted).toBe(7);
    });

    it('should bundle for the browser without concerto-core or `new Function`, and run', async () => {
        const result = await build({
            stdin: {
                contents: [
                    'import { Parser } from "@accordproject/concerto-cto";',
                    'import { resolveModels } from "./resolve";',
                    'import { convertToConcertino } from "./index";',
                    'export const toConcertino = (ctos) => convertToConcertino(resolveModels(ctos.map((c) => Parser.parse(c)), { failFast: true }).models);',
                ].join('\n'),
                resolveDir: join(__dirname, '..', 'src'), loader: 'ts',
            },
            bundle: true, write: false, format: 'cjs', platform: 'browser', minify: true, treeShaking: true, logLevel: 'silent',
        });
        const code = result.outputFiles[0].text;
        expect(code).not.toMatch(/new Function/);
        expect(code).not.toMatch(/concerto-core|ModelManager/);
        const mod: any = { exports: {} };
        new Function('module', 'exports', code)(mod, mod.exports); // eslint-disable-line no-new-func
        const doc = mod.exports.toConcertino(PROBE_MODELS);
        expect(Object.keys(doc.declarations)).toContain('probe.main@1.0.0.Widget');
    });
});
