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
import BaseException = require('./baseexception');
import BaseFileException = require('./basefileexception');

// Transitive closure downloader
import FileDownloader = require('./filedownloader');

// File Loaders
import CompositeFileLoader = require('./loaders/compositefileloader');
import DefaultFileLoader = require('./loaders/defaultfileloader');
import GitHubFileLoader = require('./loaders/githubfileloader');
import HTTPFileLoader = require('./loaders/httpfileloader');
export type { FileLoader } from './loaders/fileloader';

// Writers
import Writer = require('./writer');
import FileWriter = require('./filewriter');
import ModelWriter = require('./modelwriter');
import InMemoryWriter = require('./inmemorywriter');

// Logger
import Logger = require('./logger');

// TypedStack
import TypedStack = require('./typedstack');

// Label
import Label = require('./label');

// Identifiers
import Identifiers = require('./identifiers');

// Error codes
import ErrorCodes = require('./errorcodes');

// NullUtil
import NullUtil = require('./null');

// Warning
import * as Warning from './warning';

export {
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
    Label,
    Identifiers,
    ErrorCodes,
    NullUtil,
    Warning,
};
