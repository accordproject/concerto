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

const Logger = require('../lib/logger');
const Fs = require('fs');
const Chai = require('chai');

Chai.should();
Chai.use(require('chai-things'));

describe('logger', () => {

    describe('#logger.error', function () {
        it('should call logger.error', async function () {
            Logger.error('This is logging some error');
        });
        it('should call logger.error', async function () {
            Logger.log({
                level: 'error',
                message: 'Hey! Log something?',
                stack: 'stack says boo!'
            });
        });
        it('should call logger.error with a stack', async function () {
            Logger.log({
                level: 'error',
                message: 'Hey! Log something?',
                stack: 'stack says boo!'
            });
        });
        it('should call logger.error with some padding', async function () {
            Logger.log({
                level: 'error',
                message: 'Hey! Log something?',
                padding: { error: '>>>' }
            });
        });
    });
    describe('#logger.warn', function () {
        it('should call logger.warn', async function () {
            Logger.warn('This is logging some warning');
        });
        it('should call logger.warn with JSON', async function () {
            Logger.log({
                level: 'warn',
                message: { 'message' : 'This is a JSON message' }
            });
        });
        it('should call logger.warn with stringified JSON', async function () {
            Logger.warn('{ "message" : "This is a JSON message" }');
        });
    });
    describe('#logger.info', function () {
        it('should call logger.info', async function () {
            Logger.info('This is logging some useful information');
        });
        it('should call logger.info with JSON', async function () {
            Logger.log({
                level: 'info',
                message: { 'message' : 'This is a JSON message' }
            });
        });
        it('should call logger.info with stringified JSON', async function () {
            Logger.info('{ "message" : "This is a JSON message" }');
        });
    });
    describe('#logger.debug', function () {
        it('should call logger.debug', async function () {
            Logger.debug('This is logging some debug message');
        });
        it('should call logger.debug with an Error object', async function () {
            Logger.debug(new Error('This is some debug message'));
        });
        it('should call logger.info with an Error object in the message', async function () {
            Logger.log({
                level: 'info',
                message: new Error('The proof is in the pudding')
            });
        });
    });
    describe('#logger.info (in production)', function () {
        it('should call logger.info', async function () {
            process.env.NODE_ENV = 'production';
            Logger.info('This is logging some useful information');
        });
    });
    describe('#setuplogger', () => {
        const logDir = 'log';
        const logDirTest = 'logtest';
        it('should setup logger', async function () {
            Logger.setup(process,'development',logDir);
        });
        it('should setup logger (production)', async function () {
            Logger.setup(process,'production',logDir);
        });
        it('should setup logger with log directory', async function () {
            Logger.setup(process,'development',logDirTest);
            Fs.existsSync(logDir).should.be.true;
            try { Fs.unlinkSync(`${logDirTest}/trace.log`); } catch (err) { Logger.info(err); }
            try { Fs.rmdirSync(logDirTest, (err) => {}); } catch (err) { Logger.info(err); }
            Logger.setup(process,'development',logDir);
        });
        it('should setup logger with log directory (in production)', async function () {
            Logger.setup(process,'production',logDirTest);
            Fs.existsSync(logDir).should.be.true;
            try { Fs.unlinkSync(`${logDirTest}/trace.log`); } catch (err) { Logger.info(err); }
            try { Fs.rmdirSync(logDirTest, (err) => {}); } catch (err) { Logger.info(err); }
            Logger.setup(process,'development',logDir);
        });
    });
});
