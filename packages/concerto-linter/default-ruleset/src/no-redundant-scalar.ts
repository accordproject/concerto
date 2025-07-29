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

import { checkRedundantScalar } from './functions/check-redundant-scalar';

/**
 * Rule: No Redundant Scalar
 * -------------------------
 * Detects and flags redundant scalar type declarations in the model. This rule helps
 * maintain model clarity by preventing unnecessary scalar definitions that duplicate built-in types.
 */

export default {
    given: '$.models[*].declarations[?(@.$class == "concerto.metamodel@1.0.0.IntegerScalar" || @.$class == "concerto.metamodel@1.0.0.DoubleScalar" || @.$class == "concerto.metamodel@1.0.0.BooleanScalar" || @.$class == "concerto.metamodel@1.0.0.DateTimeScalar" || @.$class == "concerto.metamodel@1.0.0.LongScalar" || @.$class == "concerto.metamodel@1.0.0.StringScalar")]',
    severity: 0, // 0 = error, 1 = warning, 2 = info, 3 = hint
    then: {
        function: checkRedundantScalar
    }
};
