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

const Logger = require('@accordproject/concerto-core').Logger;
const Commands = require('./lib/commands');

require('yargs')
    .scriptName('concerto')
    .usage('$0 <cmd> [manager] [args]')
    .command('validate', 'validate JSON against model files', (yargs) => {
        yargs.option('sample', {
            describe: 'sample JSON to validate',
            type: 'string',
            default: 'sample.json'
        });
        yargs.option('ctoSystem', {
            describe: 'system model to be used',
            type: 'string'
            default: 'org.accordproject.base.cto'
        });
        yargs.option('ctoFiles', {
            describe: 'array of CTO files',
            type: 'string',
            array: true,
            default: '.'
        });
    }, (argv) => {
        if (argv.verbose) {
            Logger.info(`validate sample in ${argv.format} against the models ${argv.ctoFiles}`);
        }

        return Commands.validate(argv.sample, argv.ctoFiles)
            .then((result) => {
                Logger.info(result);
            })
            .catch((err) => {
                Logger.error(err.message);
            });
    })
    .command('generate', 'generate code from model files', (yargs) => {
        yargs.option('ctoSystem', {
            describe: 'system model to be used',
            type: 'string'
            default: 'org.accordproject.base.cto'
        });
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
            Logger.info(`generate code in format ${argv.format} from the models ${argv.ctoFiles} into directory ${argv.outputDirectory}`);
        }

        return Commands.generate(argv.format, argv.ctoSystem, argv.ctoFiles, argv.outputDirectory)
            .then((result) => {
                Logger.info(result);
            })
            .catch((err) => {
                Logger.error(err.message);
            });
    })
    .command('get', 'save local copies of external model dependencies', (yargs) => {
        yargs.option('ctoFiles', {
            describe: 'array of local CTO files',
            type: 'string',
            array: true,
            default: '.'
        });
        yargs.option('outputDirectory', {
            describe: 'output directory path',
            type: 'string',
            default: './'
        });
    }, (argv) => {
        if (argv.verbose) {
            Logger.info(`Saving external models from ${argv.ctoFiles} into directory: ${argv.outputDirectory}`);
        }

        return Commands.getExternalModels(argv.ctoFiles, argv.outputDirectory)
            .catch((err) => {
                Logger.error(err.message);
            });
    })
    .option('verbose', {
        alias: 'v',
        default: false
    })
    .help()
    .argv;
