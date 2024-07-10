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
const DEFAULT_BASE_EXCEPTION = 'DefaultBaseException';
//default validator exception which is being used when there is no specified validator exception in introspect
const DEFAULT_VALIDATOR_EXCEPTION = 'DefaultValidatorException';
// exception code for regex validator format error
const REGEX_VALIDATOR_EXCEPTION = 'RegexValidatorException';
// base exception for Type not found
const TYPE_NOT_FOUND_EXCEPTION = 'TypeNotFoundException';
// deprecation warning type for process.emitWarning
const DEPRECATION_WARNING = 'DeprecationWarning';

module.exports = {DEFAULT_BASE_EXCEPTION, DEFAULT_VALIDATOR_EXCEPTION, REGEX_VALIDATOR_EXCEPTION, TYPE_NOT_FOUND_EXCEPTION, DEPRECATION_WARNING};
