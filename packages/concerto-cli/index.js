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
    .demandCommand(1, '# Please specify a command')
    .recommendCommands()
    .strict()
    .usage('$0 <cmd> [args]')
    .command('validate', 'validate JSON against model files', (yargs) => {
        yargs.option('input', {
            describe: 'JSON to validate',
            type: 'string'
        });
        yargs.option('model', {
            describe: 'array of concerto (cto) model files',
            type: 'string',
            array: true
        });
        yargs.option('offline', {
            describe: 'do not resolve external models',
            type: 'boolean',
            default: false
        });
        yargs.option('functional', {
            describe: 'new validation API',
            type: 'boolean',
            default: false
        });
        yargs.option('ergo', {
            describe: 'validation and emit for Ergo',
            type: 'boolean',
            default: false
        });
    }, (argv) => {
        if (argv.verbose) {
            Logger.info(`validate ${argv.input} against the models ${argv.model}`);
        }

        try {
            argv = Commands.validateValidateArgs(argv);
            const options = {};
            options.offline = argv.offline;
            options.functional = !argv.ergo && argv.functional; // XXX Ergo option takes priority
            options.ergo = argv.ergo;
            return Commands.validate(argv.input, argv.model, options)
                .then((result) => {
                    Logger.info('Input is valid');
                    if (!options.functional) {
                        Logger.info(result);
                    }
                })
                .catch((err) => {
                    Logger.info('Input is invalid');
                    Logger.error(err.message);
                });
        } catch (err){
            Logger.error(err.message);
            return;
        }
    })
    .command('compile', 'generate code for a target platform', (yargs) => {
        yargs.demandOption(['model'], 'Please provide CTO models');
        yargs.option('model', {
            describe: 'array of concerto (cto) model files',
            type: 'string',
            array: true
        });
        yargs.option('offline', {
            describe: 'do not resolve external models',
            type: 'boolean',
            default: false
        });
        yargs.option('target', {
            describe: 'target of the code generation',
            type: 'string',
            default: 'JSONSchema'
        });
        yargs.option('output', {
            describe: 'output directory path',
            type: 'string',
            default: './output/'
        });
    }, (argv) => {
        if (argv.verbose) {
            Logger.info(`generate code for target ${argv.target} from models ${argv.model} into directory: ${argv.output}`);
        }

        const options = {};
        options.offline = argv.offline;
        return Commands.compile(argv.target, argv.model, argv.output, options)
            .then((result) => {
                Logger.info(result);
            })
            .catch((err) => {
                Logger.error(err.message);
            });
    })
    .command('get', 'save local copies of external model dependencies', (yargs) => {
        yargs.demandOption(['model'], 'Please provide CTO models');
        yargs.option('model', {
            describe: 'array of concerto (cto) model files',
            type: 'string',
            array: true
        });
        yargs.option('output', {
            describe: 'output directory path',
            type: 'string',
            default: './'
        });
    }, (argv) => {
        if (argv.verbose) {
            Logger.info(`saving external models from ${argv.model} into directory: ${argv.output}`);
        }

        return Commands.get(argv.model, argv.output)
            .then((result) => {
                Logger.info(result);
            })
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
