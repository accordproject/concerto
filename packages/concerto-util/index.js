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

// Transitive closure downloader
module.exports.FileDownloader = require('./lib/filedownloader');

// File Loaders
module.exports.CompositeFileLoader = require('./lib/loaders/compositefileloader');
module.exports.DefaultFileLoader = require('./lib/loaders/defaultfileloader');
module.exports.GitHubFileLoader = require('./lib/loaders/githubfileloader');
module.exports.HTTPFileLoader = require('./lib/loaders/httpfileloader');

// Writers
module.exports.Writer = require('./lib/writer');
module.exports.ModelWriter = require('./lib/modelwriter');

// Logger
module.exports.Logger = require('./lib/logger');

// TypedStack
module.exports.TypedStack = require('./lib/typedstack');
