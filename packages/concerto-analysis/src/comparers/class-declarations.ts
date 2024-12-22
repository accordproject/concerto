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

import { getDeclarationType } from '../compare-utils';
import { ComparerFactory } from '../comparer';

// todo rename to declaration.ts , rename all classDeclaration -> declaration
const classDeclarationAdded: ComparerFactory = (context) => ({
    compareClassDeclaration: (a, b) => {
        if (a || !b) {
            return;
        }
        const type = getDeclarationType(b);
        context.report({
            key: 'class-declaration-added',
            message: `The ${type} "${b.getName()}" was added`,
            element: b
        });
    }
});

const classDeclarationRemoved: ComparerFactory = (context) => ({
    compareClassDeclaration: (a, b) => {
        if (!a || b) {
            return;
        }
        const type = getDeclarationType(a);
        context.report({
            key: 'class-declaration-removed',
            message: `The ${type} "${a.getName()}" was removed`,
            element: a
        });
    }
});

const classDeclarationTypeChanged: ComparerFactory = (context) => ({
    compareClassDeclaration: (a, b) => {
        if (!a || !b) {
            return;
        }
        const aType = getDeclarationType(a);
        const bType = getDeclarationType(b);
        if (aType === bType) {
            return;
        }
        if(aType !== bType){
            context.report({
                key: `class-declaration-type-changed`,
                message: `The ${aType} "${a.getName()}" changed from ${aType} to ${bType}`,
                element: a
            });
        }
  
        //add Logic for abstractness changes
        const isAbstract = (declaration) => declaration.isAbstract();
        if (isAbstract(a) !== isAbstract(b)) {
            const changeType = isAbstract(a) ? 'abstract to concrete' : 'concrete to abstract';
            const changeKey =isAbstract(a) ? `class-declaration-abstract-to-concrete` : `class-declaration-concrete-to-abstract`;
            context.report({
                key: changeKey,
                message: `The class "${a.getName()}" changed from ${changeType}.`,
                element: a
            });
        }
    }
});

export const classDeclarationComparerFactories = [classDeclarationAdded, classDeclarationRemoved, classDeclarationTypeChanged];
