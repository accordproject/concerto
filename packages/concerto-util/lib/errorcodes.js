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
const DEFAULT_BASE_EXCEPTION = {
    status: '1',
    code: 'DefaultBaseException'
};
//default validator exception which is being used when there is no specified validator exception in introspect
const DEFAULT_VALIDATOR_EXCEPTION = {
    status:'2',
    code: 'DefaultValidatorException'
};
// exception code for regex validator format error
const REGEX_VALIDATOR_EXCEPTION = {
    status:'3',
    code:'RegexValidatorException'
};
// base exception for Type not found
const TYPE_NOT_FOUND_EXCEPTION = {
    status:'4',
    code:'TypeNotFoundException'
};
// semanic exception in Concerto
const CONCERTO_SEMANTIC_EXCEPTION = {
    status:'5',
    code: 'InvalidSemanticException'
};
// security exception in Concerto
const SECURITY_EXCEPTION = {
    status:'6',
    code:'SecurityException'
};
// Invalid Metamodel Exception
const METAMODEL_EXCEPTION = {
    status:'7',
    code:'InvalidMetamodelException'
};
// Illegal Model Exception
const ILLEGAL_MODEL_EXCEPTION = {
    status:'8',
    code:'IllegalModelException'
};

module.exports = {DEFAULT_BASE_EXCEPTION, DEFAULT_VALIDATOR_EXCEPTION, REGEX_VALIDATOR_EXCEPTION, TYPE_NOT_FOUND_EXCEPTION,CONCERTO_SEMANTIC_EXCEPTION, SECURITY_EXCEPTION, METAMODEL_EXCEPTION,ILLEGAL_MODEL_EXCEPTION};