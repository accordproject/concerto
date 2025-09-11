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
 * Error codes for Concerto exceptions
 */
export const ErrorCodes = {
    //default base exception
    DEFAULT_BASE_EXCEPTION: 'DefaultBaseException',
    //default validator exception which is being used when there is no specified validator exception in introspect
    DEFAULT_VALIDATOR_EXCEPTION: 'DefaultValidatorException',
    // exception code for regex validator format error
    REGEX_VALIDATOR_EXCEPTION: 'RegexValidatorException',
    // base exception for Type not found
    TYPE_NOT_FOUND_EXCEPTION: 'TypeNotFoundException'
} as const;
