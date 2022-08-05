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

import { ClassDeclaration } from '@accordproject/concerto-core';

export function getClassDeclarationType(classDeclaration: ClassDeclaration) {
    if (classDeclaration.isAsset()) {
        return 'asset';
    } else if (classDeclaration.isConcept()) {
        return 'concept';
    } else if (classDeclaration.isEnum()) {
        return 'enum';
    } else if (classDeclaration.isEvent()) {
        return 'event';
    } else if (classDeclaration.isParticipant()) {
        return 'participant';
    } else if (classDeclaration.isTransaction()) {
        return 'transaction';
    } else {
        throw new Error(`unknown class declaration type "${classDeclaration}"`);
    }
}
