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
import BaseFileException from './basefileexception';

// Transitive closure downloader
import FileDownloader from './filedownloader';

// File Loaders
import CompositeFileLoader from './loaders/compositefileloader';
import DefaultFileLoader from './loaders/defaultfileloader';
import GitHubFileLoader from './loaders/githubfileloader';
import HTTPFileLoader from './loaders/httpfileloader';
export type { FileLoader } from './loaders/fileloader';

// Writers
import Writer from './writer';
import FileWriter from './filewriter';
import * as ModelWriter from './modelwriter';
import InMemoryWriter from './inmemorywriter';

// Logger
import Logger from './logger';

// TypedStack
import TypedStack from './typedstack';

// Label
import * as Label from './label';

// Identifiers
import * as Identifiers from './identifiers';

// Error codes
import * as ErrorCodes from './errorcodes';

// NullUtil
import NullUtil from './null';

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
