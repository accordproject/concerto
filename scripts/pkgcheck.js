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

const child_process = require('child_process');
const colors = require('colors');
const fs = require('fs');
const path = require('path');
const semver = require('semver')

const packages = {};
const fix = (process.argv.indexOf('--fix') !== -1);

const npmDirectory = path.resolve('.');
const npmConfigFile = path.resolve(npmDirectory, 'package.json');
const npmConfig = require(npmConfigFile);
const targetVersion = npmConfig.version;
const targetDependency = `${targetVersion}`;
packages['package.json'] = npmConfig;

if (!semver.valid(targetVersion)) {
    console.error(`Error: the version "${targetVersion}" in "${npmConfigFile}" is invalid!`);
    process.exit(1);
}

const masterPackageFile = path.resolve(npmDirectory, 'package.json');
const masterPackage = require(masterPackageFile);
packages['package.json'] = masterPackage;

