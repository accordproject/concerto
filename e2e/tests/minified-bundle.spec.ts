/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test, expect } from '@playwright/test';
import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { startEsmServer, type EsmServer } from './support/esm-static-server';
import { CORE_ESM_BROWSER_DIR, WASM_PKG_DIR, engineModules, engineRequires } from './support/engine-bundler';

// P5-43 (accordproject/concerto-rust#364): a production bundle of
// concerto-core, minified WITHOUT `keepNames`, must still serialize, validate
// and deserialize through the engine. A minifier renames classes, so any code
// that identifies a class by `constructor.name` breaks in such a bundle
// (P5-39, #349, reproduced `EngineFastPathUnsupported: typed-class:w` from
// `Serializer.fromJSON`/`validate`).
//
// This test does what a consumer's bundler does, the way P5-39 measured it:
// esbuild bundles dist/esm-browser (format esm, platform browser, minify,
// no keepNames) into ONE file, with the same synchronous-`require` registry
// that support/engine-bundler.ts stands in with (PORTING.md 1.5), here built
// into the bundle itself, so the engine shares the bundle's (renamed) class
// instances. The bundle then runs in Chromium.
//
// Besides the results, it checks that the engine fast paths actually ran
// (every wasm-bindgen class method call is counted), because a class check
// that fails silently would fall back to the TS visitors and still give the
// right answer; and that the fallback itself still works in the bundle (a
// lone surrogate makes the fast path throw EngineFastPathUnsupported, which
// the caller must recognise to fall back rather than rethrow).

// concerto-util's browser graph: the same file concerto-core's bare
// `@accordproject/concerto-util` import resolves to (the workspace link), so
// the bundle holds one instance of it.
const UTIL_ESM_BROWSER_INDEX = path.resolve(CORE_ESM_BROWSER_DIR, '../../../concerto-util/dist/esm-browser/index.mjs');

const MODEL = `namespace test@1.0.0
enum Colour {
  o RED
  o GREEN
}
concept Address {
  o String street
}
participant Person identified by email {
  o String email
}
asset Car identified by vin {
  o String vin regex=/^[A-Z0-9]+$/
  o Colour colour
  o DateTime built
  o Address address
  o String[] tags
  --> Person owner
}
`;

const CAR_JSON = {
    $class: 'test@1.0.0.Car',
    vin: 'ABC123',
    colour: 'GREEN',
    built: '2024-01-02T03:04:05.000Z',
    address: { $class: 'test@1.0.0.Address', street: 'High Street' },
    tags: ['a', 'b'],
    owner: 'resource:test@1.0.0.Person#alice@example.com',
};

/**
 * Writes the bundle's entry modules into `dir`. Each registry step is its own
 * module, imported in order by the entry, so that ESM evaluation order puts
 * every module in the registry before the next one's top-level code asks for
 * it (the order support/engine-bundler.ts loads them in).
 *
 * @param {string} dir the directory to write into
 * @return {string} the entry module's path
 */
function writeEntry(dir: string): string {
    const posix = (file: string) => file.split(path.sep).join('/');
    const steps: string[] = [];
    const step = (name: string, source: string) => {
        fs.writeFileSync(path.join(dir, name), source);
        steps.push(`import './${name}';`);
    };

    // The synchronous `require` a bundler provides (support/engine-bundler.ts,
    // installEngineBundler), reading from a registry filled by the steps below.
    step('00-require.mjs', `
const registry = new Map();
const bundlerRequire = (specifier) => {
    const engine = /^\\.\\.?\\/engine(\\/.*)?$/.exec(specifier);
    const key = engine ? 'engine/' + (engine[1] ? engine[1].slice(1) : 'index') : specifier;
    if (!registry.has(key)) {
        throw new Error('Bundler stand-in: "' + specifier + '" is not in the bundle');
    }
    return registry.get(key);
};
globalThis.module = { require: bundlerRequire };
globalThis.require = bundlerRequire;
globalThis.__bundleRegistry = registry;
`);

    // The engine, with every wasm-bindgen class method counted by its export
    // name (the class's own name is minified too).
    step('01-engine.mjs', `
import * as engine from '${posix(path.join(WASM_PKG_DIR, 'concerto-engine.mjs'))}';
const calls = {};
globalThis.__engineCalls = calls;
for (const [name, value] of Object.entries(engine)) {
    if (typeof value !== 'function' || !value.prototype) {
        continue;
    }
    for (const method of Object.getOwnPropertyNames(value.prototype)) {
        const descriptor = Object.getOwnPropertyDescriptor(value.prototype, method);
        if (method === 'constructor' || typeof descriptor.value !== 'function') {
            continue;
        }
        const original = descriptor.value;
        const label = name + '.' + method;
        value.prototype[method] = function (...args) {
            calls[label] = (calls[label] || 0) + 1;
            return original.apply(this, args);
        };
    }
}
globalThis.__bundleRegistry.set('@accordproject/concerto-engine', engine);
`);

    engineModules().forEach((name, i) => {
        step(`02-engine-${String(i).padStart(2, '0')}.mjs`, `
import * as m from '${posix(path.join(CORE_ESM_BROWSER_DIR, 'engine', `${name}.mjs`))}';
globalThis.__bundleRegistry.set('engine/${name}', m);
`);
    });
    engineRequires().forEach((specifier, i) => {
        step(`03-public-${String(i).padStart(2, '0')}.mjs`, `
import * as m from '${posix(path.join(CORE_ESM_BROWSER_DIR, 'engine', specifier))}';
globalThis.__bundleRegistry.set(${JSON.stringify(specifier)}, m);
`);
    });

    const entry = path.join(dir, 'entry.mjs');
    fs.writeFileSync(entry, `
${steps.join('\n')}
import { ModelManager, Factory, Serializer } from '${posix(path.join(CORE_ESM_BROWSER_DIR, 'index.mjs'))}';
import { BaseException } from '${posix(UTIL_ESM_BROWSER_INDEX)}';

const calls = globalThis.__engineCalls;
// Each fast path has a text binding and a bytes binding; engine/serializer.ts
// calls the bytes one when the engine has it.
const callsOf = (...names) => names.reduce((n, name) => n + (calls['ModelManagerHandle.' + name] || 0), 0);
const fastPathCalls = () => ({
    fromJson: callsOf('serializerFromJson', 'serializerFromJsonCompact', 'serializerFromJsonCompactBytes'),
    toJson: callsOf('serializerToJson', 'serializerToJsonBytes'),
    validate: calls['ModelManagerHandle.validateResourceBinary'] || 0,
});
const delta = (before) => {
    const after = fastPathCalls();
    return Object.fromEntries(Object.keys(after).map((key) => [key, after[key] - before[key]]));
};
const errorOf = (fn) => {
    try {
        fn();
        return null;
    } catch (err) {
        return { baseException: Object.getPrototypeOf(err) === BaseException.prototype, message: String(err && err.message) };
    }
};

export function run(model, carJson) {
    const ns = 'test@1.0.0';
    const modelManager = new ModelManager();
    modelManager.addCTOModel(model, 'test.cto');
    const factory = new Factory(modelManager);
    const serializer = new Serializer(factory, modelManager);
    const out = {};

    // fromJSON, through the engine.
    let before = fastPathCalls();
    const car = serializer.fromJSON(carJson);
    out.fromJSON = {
        calls: delta(before),
        fqi: car.getFullyQualifiedIdentifier(),
        colour: car.colour,
        built: car.built.toISOString(),
        street: car.address.street,
        tags: car.tags,
        owner: car.owner.getFullyQualifiedIdentifier(),
    };

    // A ValidatedResource with a nested concept and a relationship, built
    // through the Factory: validate() and toJSON() encode all three classes.
    const built = factory.newResource(ns, 'Car', 'XYZ789');
    built.colour = 'RED';
    built.built = car.built;
    built.address = factory.newConcept(ns, 'Address');
    built.address.street = 'Low Road';
    built.tags = [];
    built.owner = factory.newRelationship(ns, 'Person', 'bob@example.com');
    out.minifiedClassNames = [built, built.address, built.owner].some((v) =>
        ['Resource', 'ValidatedResource', 'Relationship'].includes(v.constructor.name)) ? 'kept' : 'renamed';

    before = fastPathCalls();
    out.validate = { error: errorOf(() => built.validate()), calls: delta(before) };

    before = fastPathCalls();
    out.toJSON = { json: serializer.toJSON(built), calls: delta(before) };

    before = fastPathCalls();
    const reread = serializer.toJSON(serializer.fromJSON(out.toJSON.json));
    out.roundTrip = { equal: JSON.stringify(reread) === JSON.stringify(out.toJSON.json), calls: delta(before) };

    // An invalid instance: the engine's validation error.
    const bad = factory.newResource(ns, 'Car', 'XYZ789');
    Object.assign(bad, { colour: 'RED', built: car.built, tags: [], owner: built.owner, address: built.address });
    bad.vin = 'not valid!';
    before = fastPathCalls();
    out.invalid = { error: errorOf(() => bad.validate()), calls: delta(before) };

    // The fallback: a lone surrogate cannot cross the engine boundary, so the
    // fast path throws EngineFastPathUnsupported and the Serializer must fall
    // back to the TS visitors (not rethrow it).
    const lone = factory.newResource(ns, 'Car', 'LONE1');
    Object.assign(lone, { colour: 'RED', built: car.built, tags: ['\\ud800'], owner: built.owner, address: built.address });
    const loneJson = errorOf(() => { out.fallbackToJSON = serializer.toJSON(lone).tags; });
    const loneFrom = errorOf(() => {
        out.fallbackFromJSON = serializer.fromJSON(Object.assign({}, carJson, { tags: ['\\ud800'] })).tags;
    });
    out.fallbackErrors = [loneJson, loneFrom];
    return out;
}
`);
    return entry;
}

test.describe('concerto-core in a minified production bundle (no keepNames)', () => {
    // toJSON writes a DateTime in the local offset.
    test.use({ timezoneId: 'UTC' });

    let server: EsmServer;
    let workDir: string;
    let bundleText: string;

    test.beforeAll(async () => {
        workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'concerto-minified-'));
        const entry = writeEntry(workDir);
        const outDir = path.join(workDir, 'out');
        await esbuild.build({
            entryPoints: [entry],
            outfile: path.join(outDir, 'bundle.mjs'),
            bundle: true,
            format: 'esm',
            platform: 'browser',
            target: 'es2022',
            minify: true,
            keepNames: false,
            treeShaking: true,
            define: { 'process.env.NODE_ENV': '"production"' },
            logLevel: 'silent',
        });
        bundleText = fs.readFileSync(path.join(outDir, 'bundle.mjs'), 'utf8');
        server = await startEsmServer([{ prefix: '/bundle/', dir: outDir }]);
    });

    test.afterAll(async () => {
        await server?.close();
        if (workDir) {
            fs.rmSync(workDir, { recursive: true, force: true });
        }
    });

    test('fromJSON, validate and toJSON go through the engine with minified class names', async ({ page }) => {
        // The bundle really is minified without keepNames: esbuild's
        // keepNames helper is absent, and no class keeps its source name.
        expect(bundleText).not.toContain('__name(');
        expect(bundleText).not.toMatch(/class EngineFastPathUnsupported\b/);
        expect(bundleText).not.toMatch(/class ValidatedResource\b/);

        const pageErrors: string[] = [];
        page.on('pageerror', (e) => pageErrors.push(String(e)));
        await page.goto(server.baseUrl);

        const result = await page.evaluate(async ({ url, model, carJson }) => {
            const bundle = await import(url);
            return bundle.run(model, carJson);
        }, { url: `${server.baseUrl}/bundle/bundle.mjs`, model: MODEL, carJson: CAR_JSON });

        expect(pageErrors).toEqual([]);
        expect(result.minifiedClassNames).toBe('renamed');

        expect(result.fromJSON).toEqual({
            calls: { fromJson: 1, toJson: 0, validate: 0 },
            fqi: 'test@1.0.0.Car#ABC123',
            colour: 'GREEN',
            built: '2024-01-02T03:04:05.000Z',
            street: 'High Street',
            tags: ['a', 'b'],
            owner: 'test@1.0.0.Person#alice@example.com',
        });

        expect(result.validate).toEqual({ error: null, calls: { fromJson: 0, toJson: 0, validate: 1 } });

        expect(result.toJSON.calls).toEqual({ fromJson: 0, toJson: 1, validate: 0 });
        expect(result.toJSON.json).toEqual({
            $class: 'test@1.0.0.Car',
            $identifier: 'XYZ789',
            vin: 'XYZ789',
            colour: 'RED',
            built: '2024-01-02T03:04:05.000Z',
            address: { $class: 'test@1.0.0.Address', street: 'Low Road' },
            tags: [],
            owner: 'resource:test@1.0.0.Person#bob@example.com',
        });
        expect(result.roundTrip).toEqual({ equal: true, calls: { fromJson: 1, toJson: 1, validate: 0 } });

        expect(result.invalid.calls).toEqual({ fromJson: 0, toJson: 0, validate: 1 });
        // The class TS throws here is concerto-util's BaseException itself
        // (checked by identity: its name is minified too).
        expect(result.invalid.error?.baseException).toBe(true);
        expect(result.invalid.error?.message).toMatch(/Value 'not valid!' failed to match validation regex/);

        expect(result.fallbackErrors).toEqual([null, null]);
        expect(result.fallbackToJSON).toEqual(['\ud800']);
        expect(result.fallbackFromJSON).toEqual(['\ud800']);
    });
});
