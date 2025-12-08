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

import { RulesetDefinition } from '@stoplight/spectral-core';

import namespaceVersion from './namespace-version';
import pascalCaseDeclarations from './pascal-case-declarations';
import camelCaseProperties from './camel-case-properties';
import upperSnakeCaseEnumConst from './upper-snake-case-enum-const';
import pascalCaseDecorators from './pascal-case-decorators';
import stringLengthValidator from './string-length-validator';
import noReservedKeywords from './no-reserved-keywords';
import noEmptyDeclarations from './no-empty-declarations';
import abstractMustSubclassed from './abstract-must-subclassed';

const concertoRuleset: RulesetDefinition = {
    rules: {
        'namespace-version': namespaceVersion,
        'no-reserved-keywords': noReservedKeywords,
        'pascal-case-declarations': pascalCaseDeclarations,
        'camel-case-properties': camelCaseProperties,
        'upper-snake-case-enum-constants': upperSnakeCaseEnumConst,
        'pascal-case-decorators': pascalCaseDecorators,
        'string-length-validator': stringLengthValidator,
        'no-empty-declarations': noEmptyDeclarations,
        'abstract-must-subclassed': abstractMustSubclassed,
    }
};

export default concertoRuleset;
