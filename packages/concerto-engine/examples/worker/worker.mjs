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

/* eslint-env worker */

// The worker: concerto-core and the engine live here, off the main thread.
// build.mjs bundles this file as dist/worker.mjs.

// First: the synchronous `require` concerto-core's browser build loads the
// engine through (build.mjs generates it). It must be evaluated before
// concerto-core, so it is imported first.
import './engine-host.generated.mjs';
import { init } from '@accordproject/concerto-engine';
import { ModelManager, Factory, Serializer } from '@accordproject/concerto-core';

// The explicit, idempotent init (BC-32): fetches and compiles the engine's
// .wasm once. Every message waits for the same promise.
const ready = init();
// A failed init is reported to each message instead.
ready.catch(() => {});

self.onmessage = async ({ data }) => {
    try {
        await ready;
        const modelManager = new ModelManager();
        modelManager.addCTOModel(data.model, 'model.cto');
        const serializer = new Serializer(new Factory(modelManager), modelManager);
        // fromJSON validates the instance against the model.
        const resource = serializer.fromJSON(data.instance);
        self.postMessage({ id: data.id, ok: true, json: serializer.toJSON(resource) });
    } catch (err) {
        self.postMessage({ id: data.id, ok: false, error: { name: err.constructor.name, message: err.message } });
    }
};
