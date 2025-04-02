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



import chai, { expect } from 'chai';
import Logger from '../src/logger';

describe('Logger', () => {
    describe('#logger.error', () => {
        it('should call logger.error', () => {
            Logger.error('This is logging some error');
        });

        it('should call logger.error with log method', () => {
            Logger.log({
                level: 'error',
                message: 'Hey! Log something?',
                stack: 'stack says boo!'
            });
        });

        it('should call logger.error with a stack', () => {
            Logger.log({
                level: 'error',
                message: 'Hey! Log something?',
                stack: 'stack says boo!'
            });
        });

        it('should call logger.error with some padding', () => {
            Logger.log({
                level: 'error',
                message: 'Hey! Log something?',
                padding: { error: '>>>' }
            });
        });
    });

    describe('#logger.warn', () => {
        it('should call logger.warn', () => {
            Logger.warn('This is logging some warning');
        });

        it('should call logger.warn with JSON', () => {
            Logger.log({
                level: 'warn',
                message: { message: 'This is a JSON message' }
            });
        });

        it('should call logger.warn with stringified JSON', () => {
            Logger.warn('{ "message" : "This is a JSON message" }');
        });
    });

    describe('#logger.info', () => {
        it('should call logger.info', () => {
            Logger.info('This is logging some useful information');
        });

        it('should call logger.info with JSON', () => {
            Logger.log({
                level: 'info',
                message: { message: 'This is a JSON message' }
            });
        });

        it('should call logger.info with stringified JSON', () => {
            Logger.info('{ "message" : "This is a JSON message" }');
        });
    });

    describe('#logger.debug', () => {
        it('should call logger.debug', () => {
            Logger.debug('This is logging some debug message');
        });

        it('should call logger.debug with an Error object', () => {
            Logger.debug(new Error('This is some debug message'));
        });

        it('should call logger.info with an Error object in the message', () => {
            Logger.log({
                level: 'info',
                message: new Error('The proof is in the pudding')
            });
        });
    });

    describe('#logger.verbose', () => {
        it('should call logger.verbose', () => {
            Logger.verbose('This is logging some verbose message');
        });

        it('should call logger.verbose with an Error object', () => {
            Logger.verbose(new Error('This is some verbose message'));
        });
    });

    describe('#logger.silly', () => {
        it('should call logger.silly', () => {
            Logger.silly('This is logging some silly message');
        });

        it('should call logger.silly with an Error object', () => {
            Logger.silly(new Error('This is some silly message'));
        });
    });

    describe('#logger.http', () => {
        it('should call logger.http', () => {
            Logger.http('This is logging some http message');
        });

        it('should call logger.http with an Error object', () => {
            Logger.http(new Error('This is some http message'));
        });
    });

    describe('#logger.dispatch', () => {
        it('should call logger.http (intended as dispatch)', () => {
            Logger.http('This is logging some http message');
        });

        it('should call logger.http with an Error object (intended as dispatch)', () => {
            Logger.http(new Error('This is some http message'));
        });
    });

    describe('#logger.add', () => {
        it('should add a custom transport', () => {
            const messages: any[] = [];
            Logger.add({
                info: (...args: any[]) => {
                    messages.push(args);
                }
            });
            Logger.info('This is logging to the default logger and my custom transport');
            Logger.info(new Error('This is some silly message'));
            expect(messages).to.have.lengthOf(2);
        });
    });
});