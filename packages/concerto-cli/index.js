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


const Commands = require('./lib/commands');

require('yargs')
    .scriptName('cli')
    .usage('$0 <cmd> [args]')
    .command('generate', 'generate code from model files', (yargs) => {

        yargs.option('ctoFiles', {
            describe: 'array of CTO files',
            type: 'string',
            array: true,
            default: '.'
        });
        yargs.option('format', {
            describe: 'format of the code to generate',
            type: 'string',
            default: 'JSONSchema'
        });
        yargs.option('outputDirectory', {
            describe: 'output directory path',
            type: 'string',
            default: './output/'
        });
    }, (argv) => {
        if (argv.verbose) {
            console.log(`generate code in format ${argv.format} from the model for template ${argv.template} into directory ${argv.outputDirectory}`);
        }

        return Commands.generate(argv.format, argv.ctoFiles, argv.outputDirectory)
            .then((result) => {
                console.log(result);
            })
            .catch((err) => {
                console.log(err.message + ' ' + err);
            });
    })
    .command('get', 'save local copies of external model dependencies', (yargs) => {
        yargs.option('ctoFiles', {
            describe: 'array of local CTO files',
            type: 'string',
            array: true,
            default: '.'
        });
        yargs.option('out', {
            describe: 'output directory path',
            type: 'string',
            default: './'
        });
    }, (argv) => {
        if (argv.verbose) {
            console.log(`Saving external models into directory: ${argv.outputDirectory}`);
        }

        return Commands.getExternalModels(argv.ctoFiles, argv.out)
            .catch((err) => {
                console.log(err.message + ' ' + err);
            });
    })
    .option('verbose', {
        alias: 'v',
        default: false
    })
    .help()
    .argv;