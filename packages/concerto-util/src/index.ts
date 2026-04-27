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
export const BaseException = require('./baseexception');
export const BaseFileException = require('./basefileexception');

// Transitive closure downloader
export const FileDownloader = require('./filedownloader');

// File Loaders
export const CompositeFileLoader = require('./loaders/compositefileloader');
export const DefaultFileLoader = require('./loaders/defaultfileloader');
export const GitHubFileLoader = require('./loaders/githubfileloader');
export const HTTPFileLoader = require('./loaders/httpfileloader');
export type { FileLoader } from './loaders/fileloader';

// Writers
export const Writer = require('./writer');
export const FileWriter = require('./filewriter');
export const ModelWriter = require('./modelwriter');
export const InMemoryWriter = require('./inmemorywriter');

// Logger
export const Logger = require('./logger');

// TypedStack
export const TypedStack = require('./typedstack');

// Label
export const Label = require('./label');

// Identifiers
export const Identifiers = require('./identifiers');

//errorcodes
export const ErrorCodes = require('./errorcodes');

// NullUtil
export const NullUtil = require('./null');

// Warning
export const Warning = require('./warning');
