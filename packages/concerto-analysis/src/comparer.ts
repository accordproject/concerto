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

import { ClassDeclaration, MapDeclaration, ModelFile, Property, ScalarDeclaration } from '@accordproject/concerto-core';
import { CompareContext } from './compare-context.js';

/**
 * A comparer is responsible for comparing two versions of an object across two versions of a model.
 */
export type Comparer = {
    /**
     * Called to compare two model files.
     */
    compareModelFiles?: (a: ModelFile, b: ModelFile) => void;

    /**
     * Called to compare two class declarations. If a is undefined, but b is defined, then this class declaration was
     * created in the second model. If a is defined, but b is undefined, then this class declaration was removed in the
     * second model.
     * @param a The first class declaration for comparision, or undefined if it is undefined in the first model.
     * @param b The second class declaration for comparision, or undefined if it is undefined in the second model.
     */
    compareClassDeclaration?: (a: ClassDeclaration | undefined, b: ClassDeclaration | undefined) => void;

    /**
     * Called to compare two map declarations. If a is undefined, but b is defined, then this map declaration was
     * created in the second model. If a is defined, but b is undefined, then this map declaration was removed in the
     * second model.
     * @param a The first map declaration for comparision, or undefined if it is undefined in the first model.
     * @param b The second map declaration for comparision, or undefined if it is undefined in the second model.
     */
    compareMapDeclaration?: (a: MapDeclaration | undefined, b: MapDeclaration | undefined) => void;

    /**
     * Called to compare two scalar declarations. If a is undefined, but b is defined, then this scalar declaration was
     * created in the second model. If a is defined, but b is undefined, then this map declaration was removed in the
     * second model.
     * @param a The first scalar declaration for comparision, or undefined if it is undefined in the first model.
     * @param b The second scalar declaration for comparision, or undefined if it is undefined in the second model.
     */
    compareScalarDeclaration?: (a: ScalarDeclaration | undefined, b: ScalarDeclaration | undefined) => void;

    /**
     * Called to compare two properties. If a is undefined, but b is definecd, then this property was
     * created in the second model. If a is defined, but b is undefined, then this property was removed in the
     * second model.
     * @param a The first property for comparision, or undefined if it is undefined in the first model.
     * @param b The second property for comparision, or undefined if it is undefined in the second model.
     */
    compareProperty?: (a: Property | undefined, b: Property | undefined) => void;
}

/**
 * A comparer factory is responsible for creating a comparer that uses the specified context.
 */
export type ComparerFactory = (context: CompareContext) => Comparer;
