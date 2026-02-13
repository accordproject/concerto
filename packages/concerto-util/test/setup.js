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

// Polyfill File and Blob for undici in Node v18
// Node v20+ has these globals natively
const nodeVersion = parseInt(process.versions.node.split('.')[0], 10);

if (nodeVersion < 20) {
    if (typeof File === 'undefined') {
        /**
         * File polyfill for undici compatibility
         */
        global.File = class File extends Blob {
            /**
             * @param {Array} chunks - File chunks
             * @param {string} name - File name
             * @param {object} options - File options
             */
            constructor(chunks, name, options) {
                super(chunks, options);
                this.name = name;
                this.lastModified = options?.lastModified || Date.now();
            }
        };
    }

    if (typeof Blob === 'undefined') {
        /**
         * Blob polyfill for undici compatibility
         */
        global.Blob = class Blob {
            /**
             * @param {Array} chunks - Blob chunks
             * @param {object} options - Blob options
             */
            constructor(chunks = [], options = {}) {
                this.chunks = chunks;
                this.type = options.type || '';
            }
            /**
             * @returns {number} Size of blob
             */
            get size() {
                return this.chunks.reduce((acc, chunk) => acc + chunk.length, 0);
            }
        };
    }
}
