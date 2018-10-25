#!/usr/bin/env node
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

const fs = require('fs');
const path = require('path');
const semver = require('semver');

const packageDirectory = path.resolve('.');
const packageConfigFile = path.resolve(packageDirectory, 'package.json');
const packageConfig = require(packageConfigFile);
const targetVersion = semver.clean(process.argv[2]);
packageConfig.version = targetVersion;
fs.writeFileSync(packageConfigFile, JSON.stringify(packageConfig, null, 2), 'utf8');
