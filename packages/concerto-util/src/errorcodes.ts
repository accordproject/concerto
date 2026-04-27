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

//default base exception
export const DEFAULT_BASE_EXCEPTION = 'DefaultBaseException';
//default validator exception which is being used when there is no specified validator exception in introspect
export const DEFAULT_VALIDATOR_EXCEPTION = 'DefaultValidatorException';
// exception code for regex validator format error
export const REGEX_VALIDATOR_EXCEPTION = 'RegexValidatorException';
// base exception for Type not found
export const TYPE_NOT_FOUND_EXCEPTION = 'TypeNotFoundException';
// deprecation warning type for process.emitWarning
export const DEPRECATION_WARNING = 'DeprecationWarning';


//deprecation codes
export const CONCERTO_DEPRECATION_001 = 'concerto-dep:001';
export const CONCERTO_DEPRECATION_002 = 'concerto-dep:002';
