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

// P5-80 (accordproject/concerto-rust#424), analysis only: a `node -r`
// preload that sets the P5-80 prototype engine's validation-plan switch from
// CONCERTO_VALIDATION_PLAN (0 = off, anything else = on) before concerto-core
// loads the engine. It requires the engine by the name concerto-core does
// (or CONCERTO_ENGINE_MODULE), so both get the one cached module instance.

const value = process.env.CONCERTO_VALIDATION_PLAN;
if (value !== undefined) {
    const name = process.env.CONCERTO_ENGINE_MODULE || '@accordproject/concerto-engine';
    const engine = require(name);
    if (typeof engine.setValidationPlan !== 'function') {
        throw new Error(`p580-plan-switch: ${name} has no setValidationPlan (not the P5-80 prototype engine)`);
    }
    engine.setValidationPlan(value !== '0');
}
