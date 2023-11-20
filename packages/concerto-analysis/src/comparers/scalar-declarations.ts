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

import { ComparerFactory } from '../comparer';
import { getValidatorType } from '../compare-utils';

const scalarDeclarationExtendsChanged: ComparerFactory = (context) => ({
    compareScalarDeclaration: (a, b) => {

        if (!a || !b) {
            return;
        }

        if(a.getType() !== b.getType()) {
            context.report({
                key: 'scalar-extends-changed',
                message: `The scalar extends was changed from "${a.getType()}" to "${b.getType()}"`,
                element: b.getName()
            });
        }
    },
});

const scalarValidatorChanged: ComparerFactory = (context) => ({
    compareScalarDeclaration: (a, b) => {
        if (!a || !b) {
            return;
        }
        const aValidator = a.getValidator();
        const bValidator = b.getValidator();
        if (!aValidator && !bValidator) {
            return;
        } else if (!aValidator && bValidator) {
            const bValidatorType = getValidatorType(bValidator);
            context.report({
                key: 'scalar-validator-added',
                message: `A ${bValidatorType} validator was added to the scalar "${a.getName()}"`,
                element: a.getName()
            });
            return;
        } else if (aValidator && !bValidator) {
            const aValidatorType = getValidatorType(aValidator);
            context.report({
                key: 'scalar-validator-removed',
                message: `A ${aValidatorType} validator was removed from the scalar "${a.getName()}"`,
                element: a.getName()
            });
            return;
        } else if (!aValidator.compatibleWith(bValidator)) {
            const aValidatorType = getValidatorType(aValidator);
            context.report({
                key: 'scalar-validator-changed',
                message: `A ${aValidatorType} validator for the scalar "${a.getName()}" was changed and is no longer compatible`,
                element: a.getName()
            });
            return;
        }
    }
});

export const scalarDeclarationComparerFactories = [scalarDeclarationExtendsChanged, scalarValidatorChanged];
