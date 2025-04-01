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
 * Concerto CTO concrete syntax module. Concerto is a framework for defining domain
 * specific models.
 *
 * @module concerto-cto
 */

// Exceptions
import ParseException = require('./parseexception');

// Parser
import Parser = require('./parserMain');

// Printer
import Printer = require('./printer');

// External models resolution
import External = require('./external');

export {
    ParseException,
    Parser,
    Printer,
    External
};