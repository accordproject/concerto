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

/**
 * Internal Utility Class
 * @class
 * @memberof module:concerto-util
 */
class NullUtil {

    /**
     * Returns true if the typeof the object === 'undefined' or
     * the object === null.
     * @param obj - the object to be tested
     * @returns true if the object is null or undefined
     */
    static isNull(obj: unknown): boolean {
        return(typeof(obj) === 'undefined' || obj === null);
    }
}

export = NullUtil;