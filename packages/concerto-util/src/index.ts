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
const BaseException = require('./baseexception');
const BaseFileException = require('./basefileexception');

// Transitive closure downloader
const FileDownloader = require('./filedownloader');

// File Loaders
const CompositeFileLoader = require('./loaders/compositefileloader');
const DefaultFileLoader = require('./loaders/defaultfileloader');
const GitHubFileLoader = require('./loaders/githubfileloader');
const HTTPFileLoader = require('./loaders/httpfileloader');

// Writers
const Writer = require('./writer');
const FileWriter = require('./filewriter');
const ModelWriter = require('./modelwriter');
const InMemoryWriter = require('./inmemorywriter');

// Logger
const Logger = require('./logger');

// TypedStack
const TypedStack = require('./typedstack');

// Label
const Label = require('./label');

// Identifiers
const Identifiers = require('./identifiers');

// ErrorCodes
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
    InMemoryWriter,
    ModelWriter,
    Logger,
    TypedStack,
    Label,
    Identifiers,
    ErrorCodes
};
