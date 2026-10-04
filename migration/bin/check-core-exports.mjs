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
 * BC-34 (P5-71): checks the @accordproject/concerto-core `exports` map after
 * R1 removed its `./dist/*` entry.
 *
 *   - a deep import (`@accordproject/concerto-core/dist/...`) fails with
 *     ERR_PACKAGE_PATH_NOT_EXPORTED under `require`, `import` and the
 *     `browser` condition;
 *   - the package root resolves to the expected file under each of those,
 *     and every root export in migration/api-snapshot/exports.json is
 *     present (on the loaded module for `require` and `import`; in the
 *     resolved entry's export list for `browser`, whose graph needs a
 *     bundler to load the engine);
 *   - `./package.json` still resolves.
 *
 * Run with Node 22 after `npm run build`:
 *   node migration/bin/check-core-exports.mjs
 *
 * Each condition runs in its own child process, so `--conditions=browser`
 * applies to that resolution only. The probes are written under
 * node_modules/.cache/check-core-exports/.
 */

import assert from 'assert';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PKG = '@accordproject/concerto-core';
const DEEP = [
    `${PKG}/dist/serializer/jsonpopulator`,
    `${PKG}/dist/serializer/jsonpopulator.js`,
    `${PKG}/dist/introspect/classdeclaration.js`,
    `${PKG}/dist/esm/index.mjs`,
];
const { exportNames } = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'migration/api-snapshot/exports.json'), 'utf8'));

// Runs `body` (an ES module) as a file under the repo's node_modules/.cache
// (so the package resolves as a consumer would see it, and not as an `-e`
// eval, which loads the ESM build differently) in a child Node with the given
// extra flags, and returns its JSON result.
const PROBE_DIR = path.join(REPO_ROOT, 'node_modules', '.cache', 'check-core-exports');
function run(name, body, flags = []) {
    fs.mkdirSync(PROBE_DIR, { recursive: true });
    const file = path.join(PROBE_DIR, `${name}.mjs`);
    fs.writeFileSync(file, body);
    const out = execFileSync(process.execPath, [...flags, file],
        { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return JSON.parse(out.trim().split('\n').pop());
}

const probe = (loader) => `
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(${JSON.stringify(path.join(REPO_ROOT, 'package.json'))});
const deep = ${JSON.stringify(DEEP)};
const result = { deep: {}, root: null, names: null, pkgJson: null };
for (const spec of deep) {
    try { ${loader === 'require' ? 'require.resolve(spec)' : 'import.meta.resolve(spec)'}; result.deep[spec] = 'resolved'; }
    catch (e) { result.deep[spec] = e.code; }
}
${{
        require: `result.root = require.resolve('${PKG}'); result.names = Object.keys(require('${PKG}'));`,
        import: `result.root = import.meta.resolve('${PKG}'); result.names = Object.keys(await import('${PKG}'));`,
        // The browser graph cannot load the engine under plain Node (it needs a
        // bundler or a host-supplied require), so its export names are read
        // from the resolved entry's final \`export { ... }\` block instead.
        static: `result.root = import.meta.resolve('${PKG}');
const src = fs.readFileSync(new URL(result.root), 'utf8');
const block = [...src.matchAll(/export\\s*\\{([^}]*)\\}/g)].pop()[1];
result.names = block.split(',').map(s => s.trim()).filter(Boolean).map(s => s.split(/\\s+as\\s+/).pop());`,
    }[loader]}
result.pkgJson = ${loader === 'require' ? `require.resolve('${PKG}/package.json')` : `import.meta.resolve('${PKG}/package.json')`};
console.log(JSON.stringify(result));
`;

const cases = [
    { name: 'require', loader: 'require', flags: [], root: 'dist/index.js' },
    { name: 'import', loader: 'import', flags: [], root: 'dist/esm/index.mjs' },
    { name: 'browser', loader: 'static', flags: ['--conditions=browser'], root: 'dist/esm-browser/index.mjs' },
];

let failures = 0;
for (const c of cases) {
    try {
        const r = run(c.name, probe(c.loader), c.flags);
        for (const [spec, code] of Object.entries(r.deep)) {
            assert.strictEqual(code, 'ERR_PACKAGE_PATH_NOT_EXPORTED', `${c.name}: ${spec} gave ${code}`);
        }
        assert.ok(r.root.endsWith(`packages/concerto-core/${c.root}`), `${c.name}: root resolved to ${r.root}`);
        const missing = exportNames.filter(n => !r.names.includes(n));
        assert.deepStrictEqual(missing, [], `${c.name}: root exports missing ${missing.join(', ')}`);
        assert.ok(r.pkgJson.endsWith('packages/concerto-core/package.json'), `${c.name}: ./package.json resolved to ${r.pkgJson}`);
        console.log(`ok   ${c.name}: ${DEEP.length} deep imports rejected (ERR_PACKAGE_PATH_NOT_EXPORTED), root -> ${c.root}, ${exportNames.length}/${exportNames.length} root exports present, ./package.json resolves`);
    } catch (err) {
        failures++;
        console.error(`FAIL ${c.name}: ${err.stderr || err.message}`);
    }
}

if (failures) {
    console.error(`${failures} of ${cases.length} export-map checks failed`);
    process.exit(1);
}
console.log(`${cases.length} export-map checks passed`);
