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

const rootModelFile = 'concerto.cto';
const rootModelCto = `namespace concerto@1.0.0
abstract concept Concept {}
abstract concept Asset identified {}
abstract concept Participant identified {}
abstract concept Transaction {}
abstract concept Event {}
`;

/** @type unknown */
const rootModelAst = require('./rootmodel.json');

module.exports = { rootModelFile, rootModelCto, rootModelAst };
