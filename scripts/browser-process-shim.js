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

/*
 * Injected into the browser ESM build (see scripts/build-esm.js) to bind the
 * free `process` identifier the sources and their dependencies use —
 * `process.env.TZ` in the serializer, `process.emitWarning` in warning.ts,
 * `process.env.NODE_ENV` inside bundled deps.
 *
 * Leaving it free pushes the problem onto every downstream browser bundler.
 * webpack consumers in particular inject `process: 'process/browser'` through
 * ProvidePlugin, and that extensionless request is rejected as not fully
 * specified when the module it lands in is a .mjs file:
 *
 *     Module not found: Can't resolve 'process/browser'
 *     BREAKING CHANGE: ... resolved as fully specified
 *
 * The shim defers to a real `globalThis.process` whenever the page has one, so
 * a consumer's own polyfill still wins; the fallback only covers what these
 * packages actually read.
 */

const globals = typeof globalThis !== 'undefined' ? globalThis : {};

const fallback = {
    env: {},
    platform: 'browser',
    /**
     * Stand-in for Node's process.emitWarning.
     *
     * @param {string} message - the warning text
     * @param {string} [type] - the warning type
     */
    emitWarning(message, type) {
        // eslint-disable-next-line no-console
        console.warn(type ? `${type}: ${message}` : message);
    },
    /**
     * Stand-in for Node's process.cwd.
     *
     * @return {string} the notional working directory
     */
    cwd() {
        return '/';
    },
};

export const process = globals.process || fallback;
