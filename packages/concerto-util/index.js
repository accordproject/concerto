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

/**
 * Concerto utility module. Concerto is a framework for defining domain
 * specific models.
 *
 * @module concerto-util
 */

// Exceptions
const BaseException = require('./lib/baseexception');
const BaseFileException = require('./lib/basefileexception');

// Transitive closure downloader
const FileDownloader = require('./lib/filedownloader');

// File Loaders
const CompositeFileLoader = require('./lib/loaders/compositefileloader');
const DefaultFileLoader = require('./lib/loaders/defaultfileloader');
const GitHubFileLoader = require('./lib/loaders/githubfileloader');
const HTTPFileLoader = require('./lib/loaders/httpfileloader');

// Writers
const Writer = require('./lib/writer');
const FileWriter = require('./lib/filewriter');
const ModelWriter = require('./lib/modelwriter');
const InMemoryWriter = require('./lib/inmemorywriter');

// Logger
const Logger = require('./lib/logger');

// TypedStack
const TypedStack = require('./lib/typedstack');

// Label
const Label = require('./lib/label');

// Identifiers
const Identifiers = require('./lib/identifiers');

//errorcodes
const ErrorCodes = require('./lib/errorcodes');

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
    InMemoryWriter,
    ModelWriter,
    Logger,
    TypedStack,
    Label,
    Identifiers,
    ErrorCodes
};
