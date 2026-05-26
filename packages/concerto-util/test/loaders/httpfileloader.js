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

const HTTPFileLoader = require('../../src/loaders/httpfileloader');

const chai = require('chai');
chai.should();
chai.use(require('chai-things'));
chai.use(require('chai-as-promised'));
const sinon = require('sinon');

const { Agent, MockAgent, setGlobalDispatcher } = require('undici');
const model = 'namespace org.accordproject.usa.business';

const defaultProcessFile = (name, data) => {
    return { name, data };
};

describe('HTTPModeFilelLoader', () => {
    let sandbox;
    let mockAgent;

    beforeEach(() => {
        mockAgent = new MockAgent();

        mockAgent
            .get('https://raw.githubusercontent.com')
            .intercept({ path: '/accordproject/business.cto' })
            .reply(200, model);

        mockAgent
            .get('https://missing.com')
            .intercept({ path: '/test' })
            .reply(404);

        setGlobalDispatcher(mockAgent);
        mockAgent.disableNetConnect();
        sandbox = sinon.createSandbox();
    });

    afterEach(async () => {
        await mockAgent.close();
        setGlobalDispatcher(new Agent());
        sandbox.restore();
    });

    describe('#accept', () => {
        it('should accept http URIs', () => {
            const ml = new HTTPFileLoader(defaultProcessFile);
            ml.accepts('http://goo').should.be.true;
        });

        it('should accept https URIs', () => {
            const ml = new HTTPFileLoader(defaultProcessFile);
            ml.accepts('https://goo').should.be.true;
        });

        it('should reject unknown URIs', () => {
            const ml = new HTTPFileLoader(defaultProcessFile);
            ml.accepts('foo://goo').should.be.false;
        });
    });

    describe('#load', () => {

        it('should load https URIs', () => {
            const ml = new HTTPFileLoader(defaultProcessFile);
            const url = 'https://raw.githubusercontent.com/accordproject/business.cto';
            return ml.load(url)
                .then((mf) => {
                    mf.should.be.deep.equal({
                        name: '@raw.githubusercontent.com.accordproject.business.cto',
                        data: model
                    });
                });
        });

        it('should throw on 404', () => {
            const ml = new HTTPFileLoader(defaultProcessFile);
            const url = 'https://missing.com/test';
            ml.load(url).should.eventually.throw(/HTTP request failed with status: 404/);
        });
    });
});
