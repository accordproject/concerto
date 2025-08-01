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
import { hasConcreteSubclass } from './functions/find-abstract-declaration';

/**
 * Rule: Abstract Must Be Subclassed
 * ---------------------------------
 * Ensures that every abstract declaration in the model has at least one concrete subclass.
 * This helps prevent unused or orphaned abstract types, enforcing better model design.
 */
export default {
    given: '$.models[*]',
    severity: 0, // 0 = error, 1 = warning, 2 = info, 3 = hint
    then: {
        function: hasConcreteSubclass,
    },
};

