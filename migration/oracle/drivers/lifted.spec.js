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
 * Lifted-fixture driver (task P2-10, plan §2.3): replays every scenario
 * from `migration/oracle/lifted/*.scenarios.js` through the public API of
 * concerto-core `src/` while the recorder is active (ORACLE_SOURCE=lifted).
 *
 * Each scenario replaces one white-box (W) unit test that stubbed or spied
 * on a concerto-core internal (see MAP.tsv). The reference decides the
 * outcome; this driver never asserts, it only exercises, exactly like
 * drivers/data.spec.js and drivers/conformance.spec.js.
 */

const fs = require('fs');
const path = require('path');
const { SRC_ROOT } = require('../lib/core');

const S = (m) => require(path.join(SRC_ROOT, m));
const { ModelManager } = S('modelmanager');
const { Factory } = S('factory');
const { Serializer } = S('serializer');

const LIFTED_DIR = path.resolve(__dirname, '..', 'lifted');

const attempt = (f) => {
    try {
        return f();
    } catch (e) {
        return undefined;
    }
};

const scenarioFiles = fs
    .readdirSync(LIFTED_DIR)
    .filter((f) => f.endsWith('.scenarios.js'))
    .sort();

// The context passed to a scenario's own `run(ctx)`, for scenario files that
// need more than "one model, one Serializer.fromJSON call" (for example
// task P2-10's stringvalidator.js lift, which reads a real validator back
// off a real Field and calls its own public methods directly). Each class
// is the same one every jsonpopulator-style scenario already uses.
const RUN_CTX = { ModelManager, Factory, Serializer };

describe('oracle lifted driver', function () {
    this.timeout(30000);

    for (const file of scenarioFiles) {
        describe(file, () => {
            const scenarios = require(path.join(LIFTED_DIR, file));
            const mmCache = new Map();

            for (const scenario of scenarios) {
                it(scenario.id, () => {
                    // A scenario file may export either the original plain
                    // {model, json, options} shape (driven generically below
                    // through Serializer.fromJSON) or, for a lift that needs
                    // to call something other than fromJSON, a
                    // `run(ctx)` function it drives itself. Never assert
                    // either way: the recorder captures whatever the
                    // reference actually does (an outcome or a thrown
                    // error) as the fixture.
                    if (typeof scenario.run === 'function') {
                        attempt(() => scenario.run(RUN_CTX));
                        return;
                    }
                    let entry = mmCache.get(scenario.model);
                    if (!entry) {
                        const mm = new ModelManager();
                        mm.addCTOModel(scenario.model);
                        const factory = new Factory(mm);
                        const serializer = new Serializer(factory, mm);
                        entry = { mm, factory, serializer };
                        mmCache.set(scenario.model, entry);
                    }
                    attempt(() => entry.serializer.fromJSON(scenario.json, scenario.options));
                });
            }
        });
    }
});
