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

const fs = require('fs-extra');
const klaw = require('klaw');
const path = require('path');
const program = require('commander');
const Logger = require('@accordproject/concerto-util').Logger;
const APISignatureGenerator = require('./apisignaturegenerator');
const JavaScriptParser = require('./javascriptparser');
const JSONGenerator = require('./jsongenerator');

/**
 * Processes a single Javascript file (.js extension)
 *
 * @param {string} file - the file to process
 * @param {Object} fileProcessor - the processor instance to use to generate code
 * @private
 */
function processFile(file, fileProcessor) {
    let filePath = path.parse(file);
    if (filePath.ext === '.js' && filePath.base !== 'parser.js') { //ignore the generated parsers
        let fileContents = fs.readFileSync(file, 'utf8');
        // Specify ES2022 (ES13) as that has static class members, which we use in our APIs.
        const parser = new JavaScriptParser(fileContents, program.private, 2022);
        fileProcessor.generate(program, file, parser.getIncludes(), parser.getClasses(), parser.getFunctions());
    }
}

/**
 * Processes all the Javascript files within a directory.
 *
 * @param {string} path - the path to process
 * @param {Object} fileProcessor - the processor instance to use to generate code
 * @private
 */
function processDirectory(path, fileProcessor) {
    let items = [];
    klaw(path)
        .on('readable', function (item) {
            while ((item = this.read())) {
                if (item.stats.isFile()) {
                    items.push(item.path);
                }
            }
        })
        .on('end', () => {
            items.sort();
            items.forEach((item) => {
                processFile(item, fileProcessor);
            });
        });
}

/**
 * Generates documentation files from Javascript source files
 *
 * node ./scripts/parsejs.js
 * --outputDir <location to write output files>
 * --inputDir <location to recursively read .js files>
 */
program
    .version('1.0.0')
    .description('Parses Javascript source and generates output from class and method definitions')
    .usage('[options]')
    .option('-o, --outputDir <outputDir>', 'Output directory')
    .option('-i, --inputDir <inputDir>', 'Input source directory')
    .option('-s, --single <singlefile>', 'Single file to process')
    .option('-f, --format <format>', 'Format of code to generate. Defaults to APISignature.', 'APISignature')
    .option('-p, --private', 'Include classes that have the @private JSDoc annotation')
    .parse(process.argv);

let fileProcessor;

switch (program.format) {
case 'APISignature':
    fileProcessor = new APISignatureGenerator();
    break;
case 'JSON':
    fileProcessor = new JSONGenerator();
    break;
}

if (program.inputDir) {
    // Loop through all the files in the input directory
    Logger.info('Input dir ' + program.inputDir);
    processDirectory(program.inputDir, fileProcessor);
} else if (program.single) {
    Logger.info('Single file ' + program.single);
    processFile(path.resolve(program.single), fileProcessor);
} else {
    Logger.info('no file option given');
}
