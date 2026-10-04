import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { join } from 'path';

import { describe, expect, it } from 'vitest';

import { convertToConcertino } from '../src/';
import * as R from '../src/runtime';
import { PROBE_MODELS } from './probes';

/* eslint-disable @typescript-eslint/no-explicit-any */

// concerto-core through Node's own require (see validate.test.ts).
const { ModelManager } = createRequire(__filename)('@accordproject/concerto-core');

/**
 * A concerto-core model manager over some CTO files, and the Concertino model of it.
 * @param {string[]} ctos - The CTO files.
 * @returns {any} The declarations by name, and the model.
 */
function setup(ctos: string[]): { decls: Map<string, any>; model: R.Model } {
    const modelManager = new ModelManager({ importAliasing: true, enableMapType: true });
    ctos.forEach((cto, i) => modelManager.addCTOModel(cto, `m${i}.cto`));
    const decls = new Map<string, any>(modelManager.getModelFiles()
        .flatMap((file: any) => file.getAllDeclarations())
        .map((d: any) => [d.getFullyQualifiedName(), d]));
    return { decls, model: R.load(convertToConcertino(modelManager.getAst(true))) };
}

/**
 * The declaration kind of a concerto-core declaration.
 * @param {any} d - The declaration.
 * @returns {string} The kind.
 */
function kindOf(d: any): string {
    return d.isEnum() ? 'EnumDeclaration' : d.isMapDeclaration() ? 'MapDeclaration' : d.isScalarDeclaration() ? 'ScalarDeclaration'
        : d.isAsset() ? 'AssetDeclaration' : d.isParticipant() ? 'ParticipantDeclaration' : d.isTransaction() ? 'TransactionDeclaration'
            : d.isEvent() ? 'EventDeclaration' : 'ConceptDeclaration';
}

const MODEL_SETS: [string, string[]][] = [
    ['probe models', PROBE_MODELS],
    ['hr models', ['hr_base.cto', 'hr.cto'].map((f) => readFileSync(join(__dirname, 'cto', f), 'utf8'))],
];

describe.each(MODEL_SETS)('runtime: parity with concerto-core introspection (%s)', (_name, ctos) => {
    const { decls, model } = setup(ctos);
    const SYSTEM_CONCEPT = `${R.SYSTEM_NS}.Concept`;
    const names = (xs: any[]) => xs.map((x) => x.getFullyQualifiedName());

    it('should list every declaration of the document', () => {
        expect(R.getDeclarationNames(model).sort()).toStrictEqual([...decls.keys()].filter((f) => !R.isSystemType(f)).sort());
    });

    it('should give the declaration kinds', () => {
        for (const fqn of R.getDeclarationNames(model)) {
            const d = decls.get(fqn);
            expect(R.kindOf(model, fqn), fqn).toBe(kindOf(d));
            expect(R.isEnum(model, fqn)).toBe(d.isEnum());
            expect(R.isMap(model, fqn)).toBe(d.isMapDeclaration());
            expect(R.isScalar(model, fqn)).toBe(d.isScalarDeclaration());
            // concerto-core's EnumDeclaration is a ClassDeclaration; the runtime's isClass leaves enums out.
            expect(R.isClass(model, fqn)).toBe(d.isClassDeclaration() && !d.isEnum());
        }
    });

    it('should give the identifiers, super types, subtypes and properties of classes', () => {
        for (const fqn of R.getDeclarationNames(model).filter((f) => R.isClass(model, f))) {
            const d = decls.get(fqn);
            expect(R.isAbstract(model, fqn), fqn).toBe(d.isAbstract());
            expect(R.getIdentifierFieldName(model, fqn), fqn).toBe(d.getIdentifierFieldName() ?? null);
            expect(R.isIdentified(model, fqn)).toBe(d.isIdentified());
            expect(R.isSystemIdentified(model, fqn)).toBe(d.isSystemIdentified());
            expect(R.isTransaction(model, fqn)).toBe(d.isTransaction());
            expect(R.isEvent(model, fqn)).toBe(d.isEvent());
            // concerto-core also lists concerto@1.0.0.Concept, the root of every class.
            expect(R.getSuperTypes(model, fqn), fqn).toStrictEqual(names(d.getAllSuperTypeDeclarations()).filter((f) => f !== SYSTEM_CONCEPT));
            expect(R.derivesFrom(model, fqn, SYSTEM_CONCEPT)).toBe(true);
            expect(R.getAssignableTypes(model, fqn).sort(), fqn).toStrictEqual(names(d.getAssignableClassDeclarations()).sort());
            // The same properties; the system ones ($identifier, $timestamp) may come in another order.
            expect(R.getProperties(model, fqn).map((p) => p.name).sort(), fqn).toStrictEqual(d.getProperties().map((p: any) => p.getName()).sort());
            const own = d.getOwnProperties().map((p: any) => p.getName());
            expect(R.getProperties(model, fqn, true).map((p) => p.name).filter((n) => n !== '$timestamp').sort(), fqn).toStrictEqual(own.sort());
            for (const p of d.getProperties()) {
                expect(R.getProperty(model, fqn, p.getName())?.name).toBe(p.getName());
            }
        }
    });

    it('should give enum values and map types', () => {
        for (const fqn of R.getDeclarationNames(model)) {
            const d = decls.get(fqn);
            if (d.isEnum()) {
                expect(R.getEnumValues(model, fqn)).toStrictEqual(d.getOwnProperties().map((p: any) => p.getName()));
            } else {
                expect(R.getEnumValues(model, fqn)).toStrictEqual([]);
            }
            if (d.isMapDeclaration()) {
                // concerto-core gives short names; the runtime gives fully qualified ones.
                const types = R.getMapTypes(model, fqn)!;
                expect(R.shortName(types.key)).toBe(d.getKey().getType());
                expect(R.shortName(types.value)).toBe(d.getValue().getType());
            } else {
                expect(R.getMapTypes(model, fqn)).toBeUndefined();
            }
        }
    });
});

describe('runtime: queries', () => {
    const { model } = setup(PROBE_MODELS);
    const WIDGET = 'probe.main@1.0.0.Widget';

    it('should load the system model alongside the document', () => {
        expect(R.getNamespaces(model)).toStrictEqual(['probe.base@1.0.0', 'probe.main@1.0.0']);
        expect(R.getDeclarationNames(model, 'probe.base@1.0.0').sort()).toStrictEqual(
            ['probe.base@1.0.0.Colour', 'probe.base@1.0.0.Person', 'probe.base@1.0.0.Point', 'probe.base@1.0.0.Thing']);
        expect(R.getType(model, 'concerto@1.0.0.Asset')).toBeDefined();
        expect(R.getType(model, 'probe.nope@1.0.0.X')).toBeUndefined();
        expect(R.kindOf(model, 'probe.nope@1.0.0.X')).toBeUndefined();
        expect(R.isSystemType('concerto@1.0.0.Event')).toBe(true);
        expect(R.isPrimitive('DateTime')).toBe(true);
        expect(R.namespaceOf('Foo')).toBe('');
        expect(R.shortName('a.b@1.0.0.Foo')).toBe('Foo');
    });

    it('should answer assignability', () => {
        expect(R.isAssignableTo(model, WIDGET, 'probe.base@1.0.0.Thing')).toBe(true);
        expect(R.isAssignableTo(model, 'probe.base@1.0.0.Person', 'concerto@1.0.0.Participant')).toBe(true);
        expect(R.getSuperTypes(model, 'probe.base@1.0.0.Person')).toStrictEqual(['concerto@1.0.0.Participant']);
        expect(R.isAssignableTo(model, WIDGET, 'probe.base@1.0.0.Person')).toBe(false);
        expect(R.isAssignableTo(model, 'String', 'String')).toBe(true);
        expect(R.isAssignableTo(model, 'String', WIDGET)).toBe(false);
        expect(R.derivesFrom(model, 'probe.base@1.0.0.Colour', 'concerto@1.0.0.Concept')).toBe(false);
    });

    it('should classify property types', () => {
        const kind = (name: string) => R.propertyKind(model, R.getProperty(model, WIDGET, name)!);
        expect(kind('count')).toBe('primitive');
        expect(kind('size')).toBe('enum');
        expect(kind('points')).toBe('map');
        expect(kind('maker')).toBe('relationship');
        expect(R.propertyKind(model, { name: 'x', type: 'probe.base@1.0.0.Point' } as any)).toBe('class');
        expect(R.propertyKind(model, { name: 'x', type: 'probe.nope@1.0.0.X' } as any)).toBe('unknown');
        // Scalars are resolved onto the property.
        expect(R.getProperty(model, WIDGET, 'code')).toMatchObject({ type: 'String', regex: '/^[A-Z]{3}$/u', length: [3, 3] });
    });

    it('should give decorators and vocabulary', () => {
        expect(R.getDecorators(model, WIDGET)).toStrictEqual({ Other: [1, true, 'x', { type: 'probe.base@1.0.0.Point' }, { type: 'probe.base@1.0.0.Point', isArray: true }] });
        expect(R.getVocabulary(model, WIDGET)).toStrictEqual({ label: 'A widget', additionalTerms: { description: 'Widgets' } });
        expect(R.getVocabulary(model, 'probe.main@1.0.0.Size', 'S')).toStrictEqual({ label: 'Small' });
        expect(R.getDecorators(model, 'probe.main@1.0.0.Size', 'M')).toStrictEqual({ Ignore: null });
        expect(R.getDecorators(model, WIDGET, 'count')).toStrictEqual({});
        expect(R.getDecorators(model, 'probe.nope@1.0.0.X')).toStrictEqual({});
        expect(R.getNamespaceDecorators(model, 'probe.main@1.0.0')).toHaveLength(1);
        expect(R.getNamespaceDecorators(model, 'probe.base@1.0.0')).toStrictEqual([]);
    });
});
