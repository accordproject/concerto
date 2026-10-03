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


'use strict';

/**
 * The lazy-views check (CONCERTO_LAZY_VIEWS_CHECK=1; P5-10c, P5-28, P5-32), a
 * migration diagnostic of the fuzz harness. P5-100 (E-15,
 * accordproject/concerto-rust#454) moved it here from concerto-core's
 * src/engine/views.ts, which now only calls the hook `install` sets with
 * its `installLazyViewsCheck`. It keeps the lazy path but builds the
 * declaration views, and every part P5-10b defers, at construction too, and
 * reports on stderr ("LAZY-CHECK ...") any model Rust accepted whose TS
 * construction throws (an under-rejection, which would move an error from
 * construction to the first read) or mutates the AST, and any staged header
 * or recorded import names that differ from what the engine computes
 * otherwise.
 */

const path = require('path');
const { SRC_ROOT } = require(path.join(__dirname, '..', '..', 'oracle', 'lib', 'core'));

/**
 * Installs the check into the concerto-core src/ the Rust worker runs
 * (loaded through ts-node by the oracle's rust adapter, which must already
 * have loaded it).
 */
function install() {
    const views = require(path.join(SRC_ROOT, 'engine', 'views'));
    const { rust } = require(path.join(SRC_ROOT, 'engine'));
    views.installLazyViewsCheck({
        // P5-28: runs `modelFileFromAstHeader` over the JS values, on a
        // scratch object inheriting from the ModelFile, and reports any
        // field the staged header set differently, or an error it threw.
        stagedFileHeader(modelFile, ast) {
            const scratch = Object.create(modelFile);
            scratch.importShortNames = new Map();
            scratch.importUriMap = {};
            try {
                rust.modelFileFromAstHeader(scratch, ast);
            } catch (e) {
                process.stderr.write(`LAZY-CHECK header under-rejection: ${modelFile.namespace} ${e && e.name}: ${e && e.message}\n`);
                return;
            }
            const fields = (view) => JSON.stringify([
                view.namespace, view.version === undefined ? '<undefined>' : view.version, view.imports,
                [...view.importShortNames], Object.entries(view.importUriMap),
            ]);
            if (fields(scratch) !== fields(modelFile)) {
                process.stderr.write(`LAZY-CHECK header-mismatch: ${modelFile.namespace}\n`);
            }
        },
        // P5-32: reports when the import names a staged header recorded
        // differ from each import's `importFullyQualifiedNames`, which is
        // what `getImports` computes otherwise.
        importNames(modelFile) {
            let names = [];
            try {
                for (const imp of modelFile.imports) {
                    names = names.concat(rust.modelUtilImportFullyQualifiedNames(imp));
                }
            } catch (e) {
                process.stderr.write(`LAZY-CHECK import-names error: ${modelFile.namespace} ${e && e.name}: ${e && e.message}\n`);
                return;
            }
            if (JSON.stringify(names) !== JSON.stringify(views.recordedImportNames(modelFile))) {
                process.stderr.write(`LAZY-CHECK import-names mismatch: ${modelFile.namespace}\n`);
            }
        },
        // P5-10c: builds the deferred declaration views, and every part
        // built on first read, now.
        deferred(modelFile) {
            const before = JSON.stringify(modelFile.ast);
            try {
                views.materialise(modelFile);
                views.buildDeferredParts(modelFile);
            } catch (e) {
                process.stderr.write(`LAZY-CHECK under-rejection: ${modelFile.namespace} ${e && e.name}: ${e && e.message}\n`);
                throw e;
            }
            if (JSON.stringify(modelFile.ast) !== before) {
                process.stderr.write(`LAZY-CHECK ast-mutated: ${modelFile.namespace}\n`);
            }
        },
    });
}

module.exports = { install };
