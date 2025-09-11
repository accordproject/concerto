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
export { BaseException } from './baseexception';
export { BaseFileException } from './basefileexception';

// Transitive closure downloader
export { FileDownloader } from './filedownloader';

// File Loaders
export { CompositeFileLoader } from './loaders/compositefileloader';
export { DefaultFileLoader } from './loaders/defaultfileloader';
export { GitHubFileLoader } from './loaders/githubfileloader';
export { HTTPFileLoader } from './loaders/httpfileloader';

// Writers
export { Writer } from './writer';
export { FileWriter } from './filewriter';
export { ModelWriter } from './modelwriter';
export { InMemoryWriter } from './inmemorywriter';

// Logger
export { Logger } from './logger';

// TypedStack
export { TypedStack } from './typedstack';

// Label
export { Label } from './label';

// Identifiers
export { Identifiers } from './identifiers';

// ErrorCodes
export { ErrorCodes } from './errorcodes';

// ModelWriter functions
export { writeModelsToFileSystem } from './modelwriter';

// CommonJS exports for test compatibility
const BaseException = require('./baseexception');
const BaseFileException = require('./basefileexception');
const FileDownloader = require('./filedownloader');
const CompositeFileLoader = require('./loaders/compositefileloader');
const DefaultFileLoader = require('./loaders/defaultfileloader');
const GitHubFileLoader = require('./loaders/githubfileloader');
const HTTPFileLoader = require('./loaders/httpfileloader');
const Writer = require('./writer');
const FileWriter = require('./filewriter');
const ModelWriter = require('./modelwriter');
const InMemoryWriter = require('./inmemorywriter');
const Logger = require('./logger');
const TypedStack = require('./typedstack');
const { labelToSentence, sentenceToLabel } = require('./label');
const { isValidIdentifier, normalizeIdentifier } = require('./identifiers');
const ErrorCodes = require('./errorcodes');

module.exports = {
    BaseException,
    BaseFileException,
    FileDownloader,
    CompositeFileLoader,
    DefaultFileLoader,
    GitHubFileLoader,
    HTTPFileLoader,
    Writer,
    FileWriter,
    ModelWriter,
    InMemoryWriter,
    Logger,
    TypedStack,
    Label: { labelToSentence, sentenceToLabel },
    Identifiers: { isValidIdentifier, normalizeIdentifier },
    ErrorCodes,
    writeModelsToFileSystem: ModelWriter.writeModelsToFileSystem
};
