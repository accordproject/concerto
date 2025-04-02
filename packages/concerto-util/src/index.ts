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
 * Concerto utility module. Concerto is a framework for defining domain
 * specific models.
 *
 * @module concerto-util
 */

// Exceptions
import BaseException from './baseexception';

// File Loaders
import CompositeFileLoader from './loaders/compositefileloader';
import DefaultFileLoader from './loaders/defaultfileloader';
import GitHubFileLoader from './loaders/githubfileloader';
import HTTPFileLoader from './loaders/httpfileloader';

// Transitive closure downloader
import FileDownloader from './filedownloader';

// Writers
import FileWriter from './filewriter';
import InMemoryWriter from './inmemorywriter';
import { writeModelsToFileSystem } from './modelwriter';
import Writer from './writer';

// Logger
import Logger from './logger';

// TypedStack
import TypedStack from './typedstack';

// Label
import { labelToSentence, sentenceToLabel } from './label';

// Identifiers
import { normalizeIdentifier, ID_REGEX } from './identifiers';

// ErrorCodes
import ErrorCodes from './errorcodes';

// NullUtil
import { isNull } from './null';

// Warning
import { printDeprecationWarning } from './warning';

// Export all utilities as named exports
export {
    BaseException,
    CompositeFileLoader,
    DefaultFileLoader,
    GitHubFileLoader,
    HTTPFileLoader,
    FileDownloader,
    FileWriter,
    InMemoryWriter,
    writeModelsToFileSystem,
    Writer,
    Logger,
    TypedStack,
    labelToSentence,
    sentenceToLabel,
    normalizeIdentifier,
    ID_REGEX,
    ErrorCodes,
    isNull,
    printDeprecationWarning,
};