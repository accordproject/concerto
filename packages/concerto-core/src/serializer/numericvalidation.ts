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

/** Minimum value of a signed 32-bit Concerto Integer. */
export const INTEGER_MIN_VALUE = -(2 ** 31);

/** Maximum value of a signed 32-bit Concerto Integer. */
export const INTEGER_MAX_VALUE = 2 ** 31 - 1;

/** Whether a value is an Integer representable by Concerto's signed 32-bit type. */
export const isValidInteger = (value: unknown): value is number =>
    typeof value === 'number' && Number.isInteger(value) && value >= INTEGER_MIN_VALUE && value <= INTEGER_MAX_VALUE;
