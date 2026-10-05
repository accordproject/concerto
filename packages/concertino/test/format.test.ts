import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { join } from 'path';

import { IModels } from '@accordproject/concerto-metamodel';
import { describe, expect, it } from 'vitest';

import {
    CONCERTINO_MAJOR_VERSION, CONCERTINO_VERSION, ConcertinoConverter, ConcertinoVersionError, checkConcertinoVersion,
    convertToConcertino, convertToMetamodel,
} from '../src/';
import * as R from '../src/runtime';
import { checkSchema } from '../src/schema';
import * as V from '../src/validate';

/* eslint-disable @typescript-eslint/no-explicit-any */

// concerto-core through Node's own require, as in validate.test.ts.
const { Factory, ModelManager, Serializer } = createRequire(__filename)('@accordproject/concerto-core');

const strip = (x: unknown) => JSON.parse(JSON.stringify(x, (k, v) => (k === 'location' ? undefined : v)));
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

const GAPS_CTO = readFileSync(join(__dirname, 'gaps', 'gaps.cto'), 'utf8');
// What the 5.0.0 converter (before these fixes) wrote for gaps.cto.
const GAPS_500 = JSON.parse(readFileSync(join(__dirname, 'gaps', 'gaps.concertino-5.0.0.json'), 'utf8'));
const NS = 'org.example.gaps@1.0.0';

/**
 * concerto-core over some CTO files: the model manager, its declarations by name and its resolved metamodel.
 * @param {string[]} ctos - The CTO files.
 * @returns {any} The three.
 */
function setup(ctos: string[]): { modelManager: any; decls: Map<string, any>; resolved: IModels } {
    const modelManager = new ModelManager({ importAliasing: true, enableMapType: true });
    ctos.forEach((cto, i) => modelManager.addCTOModel(cto, `m${i}.cto`));
    const decls = new Map<string, any>(modelManager.getModelFiles()
        .flatMap((file: any) => file.getAllDeclarations())
        .map((d: any) => [d.getFullyQualifiedName(), d]));
    return { modelManager, decls, resolved: strip(modelManager.getAst(true)) };
}

/**
 * Converts a metamodel to Concertino and back, and checks nothing is lost.
 * @param {IModels} metamodel - The metamodel.
 * @returns {any} The Concertino document.
 */
function expectLosslessRoundTrip(metamodel: IModels): any {
    const concertino = convertToConcertino(clone(metamodel));
    const back = convertToMetamodel(clone(concertino));
    metamodel.models.forEach((model) => {
        expect(back.models.find((m) => m.namespace === model.namespace)).toStrictEqual(model);
    });
    expect(checkSchema(concertino)).toBeNull();
    return concertino;
}

const withVersion = (doc: any, version: unknown) => ({ ...doc, metadata: { ...doc.metadata, concertinoVersion: version } });

describe('format version', () => {
    const { resolved } = setup([GAPS_CTO]);
    const doc = convertToConcertino(clone(resolved));

    it('should write the version of the spec', () => {
        const cto = readFileSync(join(__dirname, '..', 'src', 'spec', 'concertino.cto'), 'utf8');
        expect(cto).toMatch(new RegExp(`^namespace concertino\\.metamodel@${CONCERTINO_VERSION.replace(/\./g, '\\.')}$`, 'm'));
        expect(readFileSync(join(__dirname, '..', 'src', 'spec', `concertino.metamodel@${CONCERTINO_VERSION}.ts`), 'utf8'))
            .toContain(`namespace: concertino.metamodel@${CONCERTINO_VERSION}`);
        expect(CONCERTINO_VERSION).toBe('5.1.0');
        expect(Number(CONCERTINO_VERSION.split('.')[0])).toBe(CONCERTINO_MAJOR_VERSION);
        expect(doc.metadata.concertinoVersion).toBe(CONCERTINO_VERSION);
        expect(new ConcertinoConverter().fromConcertoMetamodel(clone(resolved)).metadata.concertinoVersion).toBe(CONCERTINO_VERSION);
        expect(new ConcertinoConverter({ version: '5.1.7' }).fromConcertoMetamodel(clone(resolved)).metadata.concertinoVersion).toBe('5.1.7');
    });

    it('should keep the spec, the schema and the README in step', () => {
        const readme = readFileSync(join(__dirname, '..', 'README.md'), 'utf8');
        expect(readme).toContain(`"concertinoVersion": "${CONCERTINO_VERSION}"`);
        expect(readme.match(/"concertinoVersion": "[^"]*"/g)).toStrictEqual([`"concertinoVersion": "${CONCERTINO_VERSION}"`]);
        // Every field the spec adds in 5.1.0 is in the schema.
        const schema = readFileSync(join(__dirname, '..', 'src', 'spec', 'concertino.schema.json'), 'utf8');
        for (const field of ['systemSuperTypes', 'decoratorOrder', 'fullVocabulary', 'isMap', 'isSystem', 'systemInheritedFrom', 'isEnum']) {
            expect(schema, field).toContain(`"${field}"`);
        }
    });

    it('should accept every version of the same major', () => {
        for (const version of ['5.0.0', '5.1.0', '5.27.3', '5.2.0-rc.1', '5.1.0+build.7']) {
            expect(() => checkConcertinoVersion(withVersion(doc, version)), version).not.toThrow();
            expect(() => R.load(withVersion(doc, version) as any), version).not.toThrow();
        }
    });

    it('should reject another major version, a malformed version and a missing one', () => {
        const rejected: [unknown, unknown][] = [
            [withVersion(doc, '6.0.0'), '6.0.0'],
            [withVersion(doc, '4.0.0-alpha.2'), '4.0.0-alpha.2'],
            [withVersion(doc, '1.0.0-alpha.7'), '1.0.0-alpha.7'],
            [withVersion(doc, '5'), '5'],
            [withVersion(doc, '5.1'), '5.1'],
            [withVersion(doc, 5), 5],
            [withVersion(doc, undefined), undefined],
            [{ declarations: {} }, undefined],
            [null, undefined],
        ];
        for (const [bad, version] of rejected) {
            let error: any;
            try {
                R.load(bad as any);
            } catch (e) {
                error = e;
            }
            expect(error, String(version)).toBeInstanceOf(ConcertinoVersionError);
            expect(error.name).toBe('ConcertinoVersionError');
            expect(error.version).toBe(version);
            expect(() => checkConcertinoVersion(bad)).toThrow(ConcertinoVersionError);
        }
        expect(() => R.load(withVersion(doc, '6.0.0') as any)).toThrow(/6\.0\.0 is not supported.*major version 5/);
    });

    it('should reject another major version in every validate entry point', () => {
        const good = R.load(doc);
        const instance = V.validate(good, { $class: `${NS}.Token`, $identifier: 't1' });
        const bad: R.Model = { ...R.load(doc), doc: withVersion(doc, '6.0.0') as any };
        const json = { $class: `${NS}.Token`, $identifier: 't1' };
        expect(() => V.validate(bad, json)).toThrow(ConcertinoVersionError);
        expect(() => V.normalise(bad, json)).toThrow(ConcertinoVersionError);
        // A version error is not an instance error, so check throws it too.
        expect(() => V.check(bad, json)).toThrow(ConcertinoVersionError);
        expect(() => V.toJSON(bad, instance)).toThrow(ConcertinoVersionError);
        expect(V.check(good, json)).toStrictEqual({ ok: true });
        // The subpaths export the same class.
        expect(R.ConcertinoVersionError).toBe(ConcertinoVersionError);
        expect(V.ConcertinoVersionError).toBe(ConcertinoVersionError);
    });
});

describe('5.1.0 additive fixes', () => {
    const { decls, resolved } = setup([GAPS_CTO]);
    const doc = expectLosslessRoundTrip(resolved);
    const classes = [...decls.entries()].filter(([fqn, d]) => !R.isSystemType(fqn) && d.isClassDeclaration?.() && !d.isEnum());
    const props = (fqn: string) => doc.declarations[fqn].properties as Record<string, any>;
    const m = R.load(doc);

    it('should cover every kind of class declaration', () => {
        expect(classes.map(([fqn]) => fqn).sort()).toStrictEqual(Object.keys(doc.declarations)
            .filter((fqn) => doc.declarations[fqn].type === 'ConceptDeclaration').sort());
        expect(classes.length).toBe(14);
    });

    it('should write the system super types: extends then systemSuperTypes is getAllSuperTypeDeclarations', () => {
        for (const [fqn, d] of classes) {
            const concept = doc.declarations[fqn];
            expect([...(concept.extends ?? []), ...concept.systemSuperTypes], fqn)
                .toStrictEqual(d.getAllSuperTypeDeclarations().map((s: any) => s.getFullyQualifiedName()));
        }
        expect(doc.declarations[`${NS}.Car`].systemSuperTypes).toStrictEqual(['concerto@1.0.0.Asset', 'concerto@1.0.0.Concept']);
        expect(doc.declarations[`${NS}.Plain`].systemSuperTypes).toStrictEqual(['concerto@1.0.0.Concept']);
    });

    it('should give the properties getProperties lists, with the same identifier, to a 5.1.0 reader', () => {
        for (const [fqn, d] of classes) {
            expect(R.getProperties(m, fqn).map((x) => x.name).sort(), fqn).toStrictEqual(d.getProperties().map((x: any) => x.getName()).sort());
            expect(R.getProperties(m, fqn, true).map((x) => x.name).sort(), fqn)
                .toStrictEqual(d.getOwnProperties().map((x: any) => x.getName()).sort());
            expect(R.getIdentifierFieldName(m, fqn), fqn).toBe(d.getIdentifierFieldName() ?? null);
            // From the document alone: the properties not inherited
            // (inheritedFrom) or system-inherited (systemInheritedFrom) are the
            // own ones, and the system super types add the inherited $identifier.
            const p = props(fqn);
            expect(Object.keys(p).filter((k) => !p[k].inheritedFrom && !p[k].systemInheritedFrom).sort(), fqn)
                .toStrictEqual(d.getOwnProperties().map((x: any) => x.getName()).sort());
            const systemIdentified = doc.declarations[fqn].systemSuperTypes.some((t: string) => /\.(Asset|Participant)$/.test(t));
            expect([...Object.keys(p), ...(systemIdentified && !('$identifier' in p) ? ['$identifier'] : [])].sort(), fqn)
                .toStrictEqual(d.getProperties().map((x: any) => x.getName()).sort());
        }
    });

    it('should write $timestamp as 5.0.0 did, marked as a system property inherited from the system type', () => {
        // As 5.0.0 wrote it (an own property, no inheritedFrom), plus the 5.1.0 fields.
        for (const fqn of [`${NS}.Transfer`, `${NS}.BigTransfer`]) {
            expect(props(fqn).$timestamp).toStrictEqual({ name: '$timestamp', type: 'DateTime', isSystem: true, systemInheritedFrom: 'concerto@1.0.0.Transaction' });
            expect(R.getProperties(m, fqn).slice(-1)[0]).toBe(props(fqn).$timestamp);
        }
        expect(props(`${NS}.Derived`).$timestamp).toStrictEqual({ name: '$timestamp', type: 'DateTime', isSystem: true, systemInheritedFrom: 'concerto@1.0.0.Event' });
        // The $identifier inherited from the system type is not written, as in 5.0.0;
        // a 5.1.0 reader adds it from systemSuperTypes.
        for (const fqn of [`${NS}.Anonymous`, `${NS}.Visitor`, `${NS}.Car`, `${NS}.Person`, `${NS}.Token`]) {
            expect(props(fqn), fqn).not.toHaveProperty('$identifier');
        }
        // System-identified: the inherited $identifier is the identifier.
        expect(R.getProperty(m, `${NS}.Anonymous`, '$identifier')).toMatchObject({ name: '$identifier', type: 'String', isIdentifier: true });
        expect(R.getIdentifierFieldName(m, `${NS}.Anonymous`)).toBe('$identifier');
        // Identified by a field: the inherited $identifier is not the identifier.
        expect(R.getProperty(m, `${NS}.Car`, '$identifier')).toMatchObject({ name: '$identifier', type: 'String' });
        expect(R.getIdentifierFieldName(m, `${NS}.Car`)).toBe('vin');
        // `identified`: an own $identifier, as before, now marked as a system property.
        expect(props(`${NS}.Address`).$identifier).toStrictEqual({ name: '$identifier', type: 'String', isIdentifier: true, isSystem: true });
        expect(props(`${NS}.HomeAddress`).$identifier.inheritedFrom).toBe(`${NS}.Address`);
        for (const [fqn] of classes) {
            for (const [name, p] of Object.entries(props(fqn))) {
                expect(!!p.isSystem, `${fqn}.${name}`).toBe(name === '$identifier' || name === '$timestamp');
                expect(!!p.systemInheritedFrom, `${fqn}.${name}`).toBe(name === '$timestamp');
            }
        }
    });

    it('should flag enum-typed and map-typed properties as concerto-core types them', () => {
        let flagged = 0;
        for (const [fqn, d] of classes) {
            for (const property of d.getProperties()) {
                const p = R.getProperty(m, fqn, property.getName()) as any;
                const type = ['$identifier', '$timestamp'].includes(property.getName()) ? undefined : decls.get(property.getFullyQualifiedTypeName());
                expect(!!p.isEnum, `${fqn}.${p.name}`).toBe(!!type?.isEnum?.());
                expect(!!p.isMap, `${fqn}.${p.name}`).toBe(!!type?.isMapDeclaration?.());
                flagged += p.isEnum || p.isMap ? 1 : 0;
            }
        }
        expect(flagged).toBe(7);
        expect(props(`${NS}.Person`).others).toMatchObject({ isArray: true, isEnum: true });
        expect(props(`${NS}.Person`).owners).toMatchObject({ isMap: true });
    });

    it('should not flag a type the document does not hold', () => {
        const { resolved: both } = setup([
            'namespace a@1.0.0\nenum E { o X }\nmap M { o String o String }',
            'namespace b@1.0.0\nimport a@1.0.0.{E, M}\nconcept C { o E e o M m }',
        ]);
        const partial = { ...both, models: both.models.filter((m) => m.namespace === 'b@1.0.0') };
        const c = expectLosslessRoundTrip(partial).declarations['b@1.0.0.C'].properties;
        expect(c.e).toStrictEqual({ name: 'e', type: 'a@1.0.0.E' });
        expect(c.m).toStrictEqual({ name: 'm', type: 'a@1.0.0.M' });
        const whole = expectLosslessRoundTrip(both).declarations['b@1.0.0.C'].properties;
        expect(whole.e.isEnum).toBe(true);
        expect(whole.m.isMap).toBe(true);
    });

    it('should keep metadata as 5.0.0 did, put every vocabulary term in fullVocabulary, and keep the decorator order', () => {
        // A term that is not in leading position stays in metadata, as in
        // 5.0.0; fullVocabulary (since 5.1.0) has every term.
        const nickname = props(`${NS}.Anonymous`).nickname;
        expect(nickname).not.toHaveProperty('vocabulary');
        expect(nickname.metadata).toStrictEqual({ Hidden: null, Term: ['Nickname'] });
        expect(nickname.fullVocabulary).toStrictEqual({ label: 'Nickname' });
        expect(nickname.decoratorOrder).toStrictEqual(['Hidden', 'Term']);
        // The inherited copy keeps them too.
        expect(props(`${NS}.Visitor`).nickname.fullVocabulary).toStrictEqual({ label: 'Nickname' });
        const car = doc.declarations[`${NS}.Car`];
        expect(car).not.toHaveProperty('vocabulary');
        expect(car.metadata).toStrictEqual({ Fast: null, Term: ['A car'], Term_plural: ['Cars'] });
        expect(car.fullVocabulary).toStrictEqual({ label: 'A car', additionalTerms: { plural: 'Cars' } });
        expect(car.decoratorOrder).toStrictEqual(['Fast', 'Term', 'Term_plural']);
        const green = doc.declarations[`${NS}.Colour`].values.GREEN;
        expect(green).toStrictEqual({
            metadata: { Deprecated: null, Term: ['Green colour'] }, fullVocabulary: { label: 'Green colour' }, decoratorOrder: ['Deprecated', 'Term'],
        });
        // In the usual order there is no decoratorOrder and no fullVocabulary.
        expect(doc.declarations[`${NS}.Colour`].values.RED).toStrictEqual({ vocabulary: { label: 'Red colour' } });
        expect(doc.declarations[`${NS}.Person`]).not.toHaveProperty('decoratorOrder');
        expect(doc.declarations[`${NS}.Person`]).not.toHaveProperty('fullVocabulary');
        // A 5.1.0 reader reads every term as vocabulary, and no term as metadata.
        expect(R.getVocabulary(m, `${NS}.Car`)).toStrictEqual({ label: 'A car', additionalTerms: { plural: 'Cars' } });
        expect(R.getDecorators(m, `${NS}.Car`)).toStrictEqual({ Fast: null });
        expect(R.getVocabulary(m, `${NS}.Visitor`, 'nickname')).toStrictEqual({ label: 'Nickname' });
        expect(R.getDecorators(m, `${NS}.Visitor`, 'nickname')).toStrictEqual({ Hidden: null });
        expect(R.getVocabulary(m, `${NS}.Colour`, 'GREEN')).toStrictEqual({ label: 'Green colour' });
        expect(R.getDecorators(m, `${NS}.Colour`, 'GREEN')).toStrictEqual({ Deprecated: null });
    });

    it('should keep the decorator order of every decorated element, repeated decorators included', () => {
        const ctos = [[
            'namespace o@1.0.0',
            '@A @Term_x("x") @B @Term("l") @Term_y("y")',
            'concept C {',
            '  @A @Term("p") @B(1) @Term_z("z") o String s',
            '}',
            'enum E { @A @Term("e") o V }',
            '@A @Term("m")',
            'map M { @A @Term("k") o String @B @Term("v") o String }',
            '@A @Term("s")',
            'scalar S extends String',
            '@B("1") @Term("dup") @Term("dup2") @Term_q("a") @Term_q("b")',
            'concept D {}',
        ].join('\n')];
        // Parsed only: concerto-core rejects repeated decorators, the converter keeps them.
        const { Parser } = createRequire(__filename)('@accordproject/concerto-cto');
        const parsed = { $class: 'concerto.metamodel@1.0.0.Models', models: ctos.map((cto) => Parser.parse(cto, undefined, { skipLocationNodes: true })) };
        // A scalar declaration carries its namespace once resolved, and the converter writes it back.
        parsed.models[0].declarations.find((x: any) => x.name === 'S').namespace = 'o@1.0.0';
        const d = expectLosslessRoundTrip(parsed as IModels).declarations;
        expect(d['o@1.0.0.C'].decoratorOrder).toStrictEqual(['A', 'Term_x', 'B', 'Term', 'Term_y']);
        expect(d['o@1.0.0.C'].properties.s.decoratorOrder).toStrictEqual(['A', 'Term', 'B', 'Term_z']);
        expect(d['o@1.0.0.E'].values.V.decoratorOrder).toStrictEqual(['A', 'Term']);
        expect(d['o@1.0.0.M'].decoratorOrder).toStrictEqual(['A', 'Term']);
        expect(d['o@1.0.0.M'].key.decoratorOrder).toStrictEqual(['A', 'Term']);
        expect(d['o@1.0.0.M'].value.decoratorOrder).toStrictEqual(['B', 'Term']);
        expect(d['o@1.0.0.S'].decoratorOrder).toStrictEqual(['A', 'Term']);
        // As 5.0.0 wrote them: metadata keeps one entry per name, the last.
        expect(d['o@1.0.0.D']).not.toHaveProperty('vocabulary');
        expect(d['o@1.0.0.D'].metadata).toStrictEqual({ B: ['1'], Term: ['dup2'], Term_q: ['b'] });
        // The first of a repeated term is in fullVocabulary, the repeat stays in metadata.
        expect(d['o@1.0.0.D'].fullVocabulary).toStrictEqual({ label: 'dup', additionalTerms: { q: 'a' } });
        expect(d['o@1.0.0.D'].decoratorOrder).toStrictEqual(['B', 'Term', 'Term', 'Term_q', 'Term_q']);
        const m = R.load(convertToConcertino(clone(parsed as IModels)));
        expect(R.getVocabulary(m, 'o@1.0.0.D')).toStrictEqual({ label: 'dup', additionalTerms: { q: 'a' } });
        expect(R.getDecorators(m, 'o@1.0.0.D')).toStrictEqual({ B: ['1'], Term: ['dup2'], Term_q: ['b'] });
        expect(R.getVocabulary(m, 'o@1.0.0.C')).toStrictEqual({ additionalTerms: { x: 'x', y: 'y' }, label: 'l' });
        expect(R.getDecorators(m, 'o@1.0.0.C')).toStrictEqual({ A: null, B: null });
    });
});

describe('5.0.0 documents', () => {
    const { modelManager, decls, resolved } = setup([GAPS_CTO]);
    const doc51 = convertToConcertino(clone(resolved));
    const m50 = R.load(GAPS_500);
    const m51 = R.load(doc51);

    it('should be valid 5.1.0 documents', () => {
        expect(GAPS_500.metadata.concertinoVersion).toBe('5.0.0');
        expect(checkSchema(GAPS_500)).toBeNull();
        expect(new ConcertinoConverter().isValid(GAPS_500)).toBe(true);
    });

    it('should convert back to the same metamodel', () => {
        const back = convertToMetamodel(clone(GAPS_500));
        expect(back).toStrictEqual(convertToMetamodel(clone(doc51)));
        resolved.models.forEach((model) => {
            expect(back.models.find((m) => m.namespace === model.namespace)).toStrictEqual(model);
        });
    });

    it('should answer the runtime queries as 5.1.0 documents do', () => {
        for (const fqn of R.getDeclarationNames(m51)) {
            expect(R.kindOf(m50, fqn), fqn).toBe(R.kindOf(m51, fqn));
            expect(R.getSuperTypes(m50, fqn), fqn).toStrictEqual(R.getSuperTypes(m51, fqn));
            expect(R.getIdentifierFieldName(m50, fqn), fqn).toBe(R.getIdentifierFieldName(m51, fqn));
            expect(R.getProperties(m50, fqn).map((p) => p.name).sort(), fqn).toStrictEqual(R.getProperties(m51, fqn).map((p) => p.name).sort());
            for (const p of R.getProperties(m51, fqn)) {
                expect(R.propertyKind(m50, R.getProperty(m50, fqn, p.name)!), `${fqn}.${p.name}`).toBe(R.propertyKind(m51, p));
            }
        }
    });

    it('should give the own properties concerto-core gives with 5.1.0 documents', () => {
        for (const fqn of R.getDeclarationNames(m51).filter((f) => R.isClass(m51, f))) {
            expect(R.getProperties(m51, fqn, true).map((p) => p.name).sort(), fqn)
                .toStrictEqual(decls.get(fqn).getOwnProperties().map((p: any) => p.getName()).sort());
        }
        // 5.0.0 wrote $timestamp as an own property.
        expect(R.getProperties(m50, `${NS}.Transfer`, true).map((p) => p.name)).toContain('$timestamp');
        expect(R.getProperties(m51, `${NS}.Transfer`, true).map((p) => p.name)).not.toContain('$timestamp');
    });

    it('should validate instances as 5.1.0 documents and concerto-core do', () => {
        const serializer = new Serializer(new Factory(modelManager), modelManager);
        const instances = [
            { $class: `${NS}.Person`, email: 'a@b.c', favourite: 'RED', others: ['GREEN'], scores: { x: 1 }, owners: { car: 'resource:org.example.gaps@1.0.0.Person#a@b.c' } },
            { $class: `${NS}.Person`, email: 'a@b.c', favourite: 'BLUE' },
            { $class: `${NS}.Anonymous`, $identifier: 'x1', nickname: 'n' },
            { $class: `${NS}.Visitor`, $identifier: 'x2' },
            { $class: `${NS}.Car`, vin: 'V1', colour: 'GREEN', code: 'ABC' },
            { $class: `${NS}.Car`, vin: 'V1', colour: 'GREEN', code: 'abc' },
            { $class: `${NS}.Token`, $identifier: 't1' },
            { $class: `${NS}.HomeAddress`, $identifier: 'h1', street: 's' },
            { $class: `${NS}.Plain`, colour: 'RED' },
            { $class: `${NS}.Transfer`, $timestamp: '2026-01-02T03:04:05.000Z', car: 'resource:org.example.gaps@1.0.0.Car#V1' },
            { $class: `${NS}.BigTransfer`, $timestamp: '2026-01-02T03:04:05.000Z', car: 'resource:org.example.gaps@1.0.0.Car#V1', amount: 2.5 },
            { $class: `${NS}.Moved`, $timestamp: '2026-01-02T03:04:05.000Z', scores: { a: 1, b: 2 } },
            { $class: `${NS}.Moved`, $timestamp: '2026-01-02T03:04:05.000Z', scores: { a: 'x' } },
            { $class: `${NS}.Plain`, colour: 'RED', $timestamp: '2026-01-02T03:04:05.000Z' },
        ];
        // Generated identifiers and timestamps (the Serializer writes its own $timestamp) are replaced.
        const now = Date.now();
        const generated = (k: string, v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) && Math.abs(Date.parse(v) - now) < 120000 ? '<generated>' : v);
        const outcome = (f: () => unknown) => {
            try {
                return { ok: true, value: JSON.stringify(f(), generated) };
            } catch (e: any) {
                return { ok: false, errorClass: e.errorClass || e.constructor.name };
            }
        };
        let rejected = 0;
        for (const json of instances) {
            const reference = outcome(() => serializer.toJSON(serializer.fromJSON(clone(json))));
            // Key order included: 5.1.0 lists $timestamp after the own properties, as concerto-core does.
            expect(outcome(() => V.normalise(m51, clone(json))), JSON.stringify(json)).toStrictEqual(reference);
            const from50 = outcome(() => V.normalise(m50, clone(json)));
            expect(from50.ok, JSON.stringify(json)).toBe(reference.ok);
            if (from50.ok && reference.ok) {
                expect(JSON.parse(from50.value!)).toStrictEqual(JSON.parse(reference.value!));
            } else {
                expect(from50).toStrictEqual(reference);
                rejected++;
            }
        }
        expect(rejected).toBe(3);
    });
});
