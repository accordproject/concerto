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

/* eslint-env browser */

// The page side of the worker recipe: concerto-core runs in the worker, and
// the page only posts plain data to it. Nothing here loads the engine.

const worker = new Worker(new URL('./worker.mjs', import.meta.url), { type: 'module' });
const pending = new Map();
let nextId = 0;

worker.onmessage = ({ data }) => {
    pending.get(data.id)?.(data);
    pending.delete(data.id);
};

/**
 * Validates an instance against a CTO model, in the worker.
 *
 * @param {string} model - the CTO text
 * @param {object} instance - the JSON instance
 * @return {Promise<object>} `{ ok: true, json }` with the instance as
 * Serializer.toJSON gives it, or `{ ok: false, error: { name, message } }`
 */
export function validate(model, instance) {
    return new Promise((resolve) => {
        const id = nextId++;
        pending.set(id, resolve);
        worker.postMessage({ id, model, instance });
    });
}
