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
const fsPath = require('path');
const slash = require('slash');

/**
 * Writes a set of model files to disk
 * @param {*} files - the set of files to write, with names and whether they are external
 * @param {string} path - a path to the directory where to write the files
 * @param {*} options - a set of options
 */
function writeModelsToFileSystem(files, path, options = {}) {
    if(!path){
        throw new Error('`path` is a required parameter of writeModelsToFileSystem');
    }

    const opts = Object.assign({
        includeExternalModels: true,
    }, options);

    files.forEach(function (file) {
        if (file.external && !opts.includeExternalModels) {
            return;
        }
        // Always assume file names have been normalized from `\` to `/`
        const filename = slash(file.fileName).split('/').pop();
        fs.writeFileSync(path + fsPath.sep + filename, file.definitions);
    });
}

module.exports = { writeModelsToFileSystem };
