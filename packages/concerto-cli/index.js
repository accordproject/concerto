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

const Logger = require('@accordproject/concerto-util').Logger;
const { glob } = require('glob');
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
            describe: 'array of concerto model files',
            type: 'string',
            array: true
        });
        yargs.option('utcOffset', {
            describe: 'set UTC offset',
            type: 'number'
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
            if (argv.utcOffset !== undefined) {
                options.utcOffset = argv.utcOffset;
            }
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
                    Logger.error(err);
                });
        } catch (err){
            Logger.error(err);
            return;
        }
    })
    .command('compile', 'generate code for a target platform', (yargs) => {
        yargs.option('model', {
            describe: 'array of concerto model files',
            type: 'string',
            array: true,
            default: [],
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
        yargs.option('metamodel', {
            describe: 'Include the Concerto Metamodel in the output',
            type: 'boolean',
            default: false,
        });
        yargs.option('useSystemTextJson', {
            describe: 'Compile for System.Text.Json library (`csharp` target only)',
            type: 'boolean',
            default: false
        });
        yargs.option('useNewtonsoftJson', {
            describe: 'Compile for Newtonsoft.Json library (`csharp` target only)',
            type: 'boolean',
            default: false
        });
        yargs.option('namespacePrefix', {
            describe: 'A prefix to add to all namespaces (`csharp` target only)',
            type: 'string',
        });
        yargs.check(({ model, metamodel }) => {
            if (model.length > 0 || metamodel) {
                return true;
            } else {
                throw new Error('Please provide models, or specify metamodel');
            }
        });
    }, (argv) => {
        if (argv.verbose) {
            Logger.info(`generate code for target ${argv.target} from models ${argv.model} into directory: ${argv.output}`);
        }

        const options = {};
        options.offline = argv.offline;
        options.metamodel = argv.metamodel;
        options.useSystemTextJson = argv.useSystemTextJson;
        options.useNewtonsoftJson = argv.useNewtonsoftJson;
        options.namespacePrefix = argv.namespacePrefix;
        return Commands.compile(argv.target, argv.model, argv.output, options)
            .then((result) => {
                Logger.info(result);
            })
            .catch((err) => {
                Logger.error(err.message);
            });
    })
    .command('get', 'save local copies of external model dependencies', (yargs) => {
        yargs.demandOption(['model'], 'Please provide models');
        yargs.option('model', {
            describe: 'array of concerto model files',
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
    .command('parse', 'parse a cto string to a JSON syntax tree', (yargs) => {
        yargs.demandOption(['model'], 'Please provide Concerto model(s)');
        yargs.option('model', {
            describe: 'array of concerto model files',
            type: 'string',
            array: true
        });
        yargs.option('resolve', {
            describe: 'resolve names to fully qualified names',
            type: 'boolean',
            default: false
        });
        yargs.option('all', {
            describe: 'import all models',
            type: 'boolean',
            default: false
        });
        yargs.option('output', {
            describe: 'path to the output file',
            type: 'string'
        });
        yargs.option('excludeLineLocations', {
            describe: 'Exclude file line location metadata from metamodel instance',
            type: 'boolean',
            default: false
        });
    }, (argv) => {
        const options = {};
        options.excludeLineLocations = argv.excludeLineLocations;

        return Commands.parse(argv.model, argv.resolve, argv.all, argv.output, options)
            .then((result) => {
                if (result) {
                    Logger.info(result);
                }
            })
            .catch((err) => {
                Logger.error(err.message);
            });
    })
    .command('print', 'print a JSON syntax tree to a cto string', (yargs) => {
        yargs.demandOption(['input'], 'Please provide an input Concerto syntax tree');
        yargs.option('input', {
            describe: 'the metamodel to export',
            type: 'string'
        });
        yargs.option('output', {
            describe: 'path to the output file',
            type: 'string'
        });
    }, (argv) => {
        return Commands.print(argv.input, argv.output)
            .then((result) => {
                if (result) {
                    Logger.info(result);
                }
            })
            .catch((err) => {
                Logger.error(err.message);
            });
    })
    .command('version <release>', 'modify the version of one or more model files', yargs => {
        yargs.demandOption(['model'], 'Please provide Concerto model(s)');
        yargs.positional('release', {
            describe: 'the new version, or a release to use when incrementing the existing version',
            type: 'string',
            choices: [
                'keep',
                'major',
                'minor',
                'patch',
                'premajor',
                'preminor',
                'prepatch',
                'prerelease'
            ]
        });
        yargs.option('model', {
            alias: 'models',
            describe: 'array of concerto model files',
            type: 'string',
            array: true
        });
        yargs.option('prerelease', {
            describe: 'set the specified pre-release version',
            type: 'string'
        });
    }, argv => {
        const modelFiles = argv.model.flatMap(model => {
            if (glob.hasMagic(model)) {
                return glob.sync(model);
            }
            return model;
        });
        return Commands.version(argv.release, modelFiles, argv.prerelease)
            .then((result) => {
                if (result) {
                    Logger.info(result);
                }
            });
    })
    .command('compare', 'compare two Concerto model files', yargs => {
        yargs.demandOption(['old'], 'Please provide the old model');
        yargs.demandOption(['new'], 'Please provide the new model');
        yargs.option('old', {
            describe: 'the old Concerto model file',
            type: 'string',
        });
        yargs.option('new', {
            describe: 'the new Concerto model file',
            type: 'string',
        });
    }, argv => {
        return Commands.compare(argv.old, argv.new)
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
