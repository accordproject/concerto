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

/**
 * Smoke test for the published ESM entry points, run under Node.
 *
 * The unit suites all execute against src/ through ts-node, so nothing else in
 * the repo exercises what a consumer actually resolves: `import` under Node
 * lands on dist/esm, a different artifact from both the CJS dist/ tree the
 * tests see and the dist/esm-browser graph a bundler takes through the
 * `browser` condition.
 *
 * Run with `npm run test:esm`, after `npm run build`.
 */

import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';

import { ModelManager, Factory, Serializer, ModelLoader, ModelUtil } from '@accordproject/concerto-core';
import { FileWriter, InMemoryWriter, TypedStack, ModelWriter } from '@accordproject/concerto-util';
import { Parser, Printer } from '@accordproject/concerto-cto';
import { VocabularyManager } from '@accordproject/concerto-vocabulary';

const require = createRequire(import.meta.url);
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'concerto-esm-smoke-'));
const packagesDir = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'packages');

const MODEL = `namespace smoke@1.0.0
concept Ping identified by id {
  o String id
  o DateTime when
}`;

const checks = [];

/**
 * Register a named check.
 *
 * @param {string} name - what the check covers
 * @param {Function} fn - the check body; throws to fail
 */
function check(name, fn) {
    checks.push([name, fn]);
}

check('Node resolves the import condition, not the browser build', async () => {
    const resolved = import.meta.resolve('@accordproject/concerto-core');
    assert.ok(
        resolved.includes('/dist/esm/') && !resolved.includes('/dist/esm-browser/'),
        `expected Node to select dist/esm, got ${resolved}`
    );
});

check('model round-trips through Factory and Serializer', () => {
    const modelManager = new ModelManager();
    modelManager.addCTOModel(MODEL, 'smoke.cto');
    const serializer = new Serializer(new Factory(modelManager), modelManager);
    const json = { $class: 'smoke@1.0.0.Ping', id: 'e1', when: '2020-01-01T12:00:00.000Z' };
    const resource = serializer.fromJSON(json);
    assert.strictEqual(resource.getIdentifier(), 'e1');
    // A DateTime only parses into a dayjs instance with the utc plugin
    // registered, which is the one module-level side effect in the tree and so
    // the thing most at risk from tree shaking.
    assert.strictEqual(typeof resource.when.utcOffset, 'function');
    assert.strictEqual(serializer.toJSON(resource).when, json.when);
    assert.strictEqual(ModelUtil.getNamespace('smoke@1.0.0.Ping'), 'smoke@1.0.0');
});

check('CTO parses and prints', () => {
    const ast = Parser.parse(MODEL, 'smoke.cto');
    assert.ok(Printer.toCTO(ast).includes('concept Ping'));
});

// Node builtins are stubbed out of the browser graph, so anything that reaches
// fs or path is exactly what serving that graph to Node silently breaks.
check('FileWriter writes to disk', () => {
    const target = path.join(tmpDir, 'writer.txt');
    const writer = new FileWriter(tmpDir);
    writer.openFile(target);
    writer.writeLine(0, 'hello');
    writer.closeFile();
    assert.match(fs.readFileSync(target, 'utf8'), /hello/);
});

check('ModelWriter writes models to the file system', () => {
    const modelManager = new ModelManager();
    modelManager.addCTOModel(MODEL, 'smoke.cto');
    const target = path.join(tmpDir, 'models');
    fs.mkdirSync(target, { recursive: true });
    ModelWriter.writeModelsToFileSystem(modelManager.getModelFiles(), target);
    assert.ok(fs.readdirSync(target).length > 0);
});

check('ModelLoader loads a model from disk', async () => {
    const target = path.join(tmpDir, 'loader.cto');
    fs.writeFileSync(target, MODEL);
    const modelManager = await ModelLoader.loadModelManager([target]);
    assert.ok(modelManager.getModelFile('smoke@1.0.0'));
});

check('in-memory writer and typed stack', () => {
    const writer = new InMemoryWriter();
    writer.openFile('a.txt');
    writer.writeLine(0, 'x');
    writer.closeFile();
    assert.ok(writer.getFilesInMemory().has('a.txt'));
    const stack = new TypedStack('root');
    assert.strictEqual(stack.pop(), 'root');
});

check('vocabulary manager constructs', () => {
    assert.ok(new VocabularyManager());
});

// The browser graph is shipped to bundlers we do not control. A free `process`
// there is answered by a webpack consumer's ProvidePlugin with an extensionless
// `process/browser` request, which webpack rejects as not fully specified from
// a .mjs origin — a downstream build failure with no signal on this side.
check('the browser graph leaves no free process identifier', () => {
    const offenders = [];
    for (const name of ['concerto-core', 'concerto-util', 'concerto-cto', 'concerto-vocabulary']) {
        const dir = path.join(packagesDir, name, 'dist', 'esm-browser');
        if (!fs.existsSync(dir)) {
            continue;
        }
        for (const file of fs.readdirSync(dir).filter(entry => entry.endsWith('.mjs'))) {
            const source = fs.readFileSync(path.join(dir, file), 'utf8');
            if (!/\bprocess\s*\./.test(source)) {
                continue;
            }
            // Bound either by the injected shim's own declaration or by an
            // import of it from the chunk the shim was hoisted into.
            const bound = /\bvar\b[^;\n]*\bprocess\b/.test(source)
                || /^\s*process,?\s*$/m.test(source);
            if (!bound) {
                offenders.push(`${name}/dist/esm-browser/${file}`);
            }
        }
    }
    assert.deepStrictEqual(offenders, [], 'browser modules reference an unbound `process`');
});

check('ESM and CJS entry points expose the same names', async () => {
    for (const name of [
        '@accordproject/concerto-core',
        '@accordproject/concerto-util',
        '@accordproject/concerto-cto',
        '@accordproject/concerto-vocabulary',
    ]) {
        const esm = Object.keys(await import(name)).filter(key => key !== 'default').sort();
        const cjs = Object.keys(require(name)).sort();
        assert.deepStrictEqual(esm, cjs, `${name} export names differ between ESM and CJS`);
    }
});

let failures = 0;
for (const [name, fn] of checks) {
    try {
        await fn();
        console.log(`ok   ${name}`);
    } catch (err) {
        failures++;
        console.error(`FAIL ${name}\n     ${err.message}`);
    }
}
fs.rmSync(tmpDir, { recursive: true, force: true });

if (failures > 0) {
    console.error(`\n${failures} of ${checks.length} ESM smoke checks failed`);
    process.exit(1);
}
console.log(`\n${checks.length} ESM smoke checks passed`);
