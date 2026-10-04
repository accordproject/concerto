import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { join } from 'path';

import { describe, expect, it } from 'vitest';

import { convertToConcertino } from '../src/';
import { load, Model } from '../src/runtime';
import { check, InstanceError, normalise, parseStrictDateTime, toJSON, validate } from '../src/validate';
import { PROBE_INSTANCES, PROBE_MODELS } from './probes';

/* eslint-disable @typescript-eslint/no-explicit-any */

// concerto-core through Node's own require (its CommonJS build), not through
// vitest's module graph: in rust mode the engine's views load the public
// modules natively, and a second, vitest-loaded copy of those modules would
// fail the Serializer's instanceof checks.
const { Factory, ModelManager, Serializer } = createRequire(__filename)('@accordproject/concerto-core');

/**
 * The concerto-core model manager, serializer and Concertino model of some CTO files.
 * @param {string[]} ctos - The CTO files.
 * @returns {any} The three.
 */
function setup(ctos: string[]): { serializer: any; model: Model } {
    const modelManager = new ModelManager({ importAliasing: true, enableMapType: true } as any);
    ctos.forEach((cto, i) => modelManager.addCTOModel(cto, `m${i}.cto`));
    const serializer = new Serializer(new Factory(modelManager), modelManager);
    return { serializer, model: load(convertToConcertino(modelManager.getAst(true))) };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Sorts keys and replaces generated identifiers and timestamps, as the oracle judge does.
 * @param {unknown} v - The value.
 * @param {number} now - When the value was made.
 * @returns {unknown} The canonical value.
 */
function canon(v: unknown, now: number): unknown {
    if (Array.isArray(v)) {
        return v.map((x) => canon(x, now));
    }
    if (v && typeof v === 'object') {
        return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon((v as any)[k], now)]));
    }
    if (typeof v === 'string' && (UUID.test(v) || (/^\d{4}-\d{2}-\d{2}T/.test(v) && Math.abs(Date.parse(v) - now) < 120000))) {
        return '<generated>';
    }
    return v;
}

type Outcome = { ok: true; value: unknown } | { ok: false; errorClass: string };

/**
 * Runs `f`, and gives its canonical result or the exception class it threw.
 * @param {Function} f - The function.
 * @returns {Outcome} The outcome.
 */
function outcome(f: () => unknown): Outcome {
    const now = Date.now();
    try {
        return { ok: true, value: canon(f(), now) };
    } catch (e: any) {
        return { ok: false, errorClass: e.errorClass || e.constructor.name };
    }
}

describe('validate: parity with concerto-core', () => {
    const { serializer, model } = setup(PROBE_MODELS);

    it.each(PROBE_INSTANCES.map((json, i) => [i, json]))('probe instance %i: same verdict, value and exception class', (_i, json) => {
        const reference = outcome(() => serializer.toJSON(serializer.fromJSON(json)));
        const concertino = outcome(() => normalise(model, json));
        expect(concertino).toStrictEqual(reference);
    });

    it('should cover both verdicts', () => {
        const verdicts = PROBE_INSTANCES.map((json) => outcome(() => serializer.toJSON(serializer.fromJSON(json))).ok);
        expect(verdicts.filter((ok) => ok)).toHaveLength(7);
        expect(verdicts.filter((ok) => !ok)).toHaveLength(29);
    });

    it('should match concerto-core on the package test models', () => {
        const hr = setup(['hr_base.cto', 'hr.cto'].map((f) => readFileSync(join(__dirname, 'cto', f), 'utf8')));
        const person = {
            $class: 'org.acme.hr@1.0.0.Person',
            email: 'a@b.com', firstName: 'A', lastName: 'B', middleNames: 'C',
            homeAddress: { $class: 'org.acme.hr.base@1.0.0.Address', street: 's', city: 'c', zipCode: 'z', country: 'x' },
            ssn: '123-45-6789', height: 1.8, dob: '2000-01-01T00:00:00Z',
        };
        const instances = [
            person,
            { ...person, ssn: 'nope' },
            { ...person, height: 'tall' },
            { ...person, dob: 'yesterday' },
            { ...person, homeAddress: { $class: 'org.acme.hr.base@1.0.0.Address', street: 's' } },
            { ...person, homeAddress: { $class: 'org.acme.hr.base@1.0.0.Nope' } },
        ];
        for (const json of instances) {
            const reference = outcome(() => hr.serializer.toJSON(hr.serializer.fromJSON(json)));
            expect(outcome(() => normalise(hr.model, json))).toStrictEqual(reference);
        }
    });
});

describe('validate: entry points', () => {
    const { model } = setup(PROBE_MODELS);
    const widget = PROBE_INSTANCES[0] as any;

    it('should return a populated instance that toJSON serialises', () => {
        const instance = validate(model, widget);
        expect(toJSON(model, instance)).toStrictEqual(normalise(model, widget));
        expect(toJSON(model, instance)).toMatchObject({ $class: 'probe.main@1.0.0.Widget', $identifier: 'w1', size: 'S', count: 0, enabled: false, note: '' });
    });

    it('should throw InstanceError with the concerto-core exception class', () => {
        const run = (json: unknown) => {
            try {
                validate(model, json);
            } catch (e) {
                return e;
            }
            return null;
        };
        const missing = run({ $class: 'probe.nope@1.0.0.Point' }) as InstanceError;
        expect(missing).toBeInstanceOf(InstanceError);
        expect(missing.errorClass).toBe('TypeNotFoundException');
        expect(missing.name).toBe('TypeNotFoundException');
        expect((run({ ...widget, size: 'XL' }) as InstanceError).errorClass).toBe('ValidationException');
        expect((run({}) as InstanceError).errorClass).toBe('Error');
        expect((run(null) as InstanceError).errorClass).toBe('TypeError');
    });

    it('should check without throwing', () => {
        expect(check(model, widget)).toStrictEqual({ ok: true });
        const result = check(model, { ...widget, extra: 1 });
        expect(result.ok).toBe(false);
        expect(!result.ok && result.error.errorClass).toBe('ValidationException');
    });

    it('should skip validation when asked, as the Serializer does', () => {
        expect(() => validate(model, { ...widget, size: 'XL' })).toThrow(InstanceError);
        expect(() => validate(model, { ...widget, size: 'XL' }, { validate: false })).not.toThrow();
    });

    it('should use the identifier generator and clock it is given', () => {
        const ping = normalise(model, { $class: 'probe.main@1.0.0.Ping' }, { now: () => Date.UTC(2020, 0, 1) });
        expect(ping).toStrictEqual({ $class: 'probe.main@1.0.0.Ping', $timestamp: '2020-01-01T00:00:00.000Z' });
        const thing = setup(['namespace g@1.0.0 asset A {}']);
        expect(normalise(thing.model, { $class: 'g@1.0.0.A' }, { newId: () => 'fixed' })).toStrictEqual({ $class: 'g@1.0.0.A', $identifier: 'fixed' });
    });

    it('should apply utcOffset on output, and on input unless strictQualifiedDateTimes', () => {
        const at = { ...widget, at: '2020-01-01T10:00:00+02:00' };
        expect(normalise(model, at).at).toBe('2020-01-01T08:00:00.000Z');
        expect(normalise(model, at, { utcOffset: 60 }).at).toBe('2020-01-01T09:00:00.000+01:00');
        expect(normalise(model, at, { utcOffset: '-01:30' }).at).toBe('2020-01-01T06:30:00.000-01:30');
        expect(normalise(model, at, { strictQualifiedDateTimes: true }).at).toBe('2020-01-01T08:00:00.000Z');
    });

    it('should treat an embedded resource for a relationship as concerto-core does', () => {
        const { serializer } = setup(PROBE_MODELS);
        const embedded = { ...widget, maker: { $class: 'probe.base@1.0.0.Person', email: 'p@x' } };
        for (const options of [{}, { acceptResourcesForRelationships: true }, { acceptResourcesForRelationships: true, validate: false }]) {
            const reference = outcome(() => serializer.fromJSON(embedded, options) && null);
            expect(outcome(() => validate(model, embedded, options) && null)).toStrictEqual(reference);
        }
        // Population accepts it when asked; validation still wants a relationship.
        expect(check(model, embedded).ok).toBe(false);
        expect(() => validate(model, embedded, { acceptResourcesForRelationships: true, validate: false })).not.toThrow();
    });
});

describe('validate: strict DateTime', () => {
    it('should parse only strict ISO 8601 date-times naming a real instant', () => {
        expect(parseStrictDateTime('2020-02-29T12:00:00.5Z')?.ms).toBe(Date.UTC(2020, 1, 29, 12, 0, 0, 500));
        expect(parseStrictDateTime('2020-01-01T00:00:00-05:00')?.offset).toBe(-300);
        expect(parseStrictDateTime('0099-01-01T00:00:00Z')?.ms).toBe(new Date('0099-01-01T00:00:00Z').getTime());
        for (const bad of ['2021-02-29T00:00:00Z', '2020-13-01T00:00:00Z', '2020-01-01T24:00:00Z', '2020-01-01', '2020-01-01T00:00:00', 'x']) {
            expect(parseStrictDateTime(bad)).toBeNull();
        }
    });
});
