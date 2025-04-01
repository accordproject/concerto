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

import GitHubFileLoader from '../../src/loaders/githubfileloader';
import chai, { expect } from 'chai';
import sinon from 'sinon';
import chaiAsPromised from 'chai-as-promised';
import { Agent, MockAgent, setGlobalDispatcher } from 'undici';

chai.use(chaiAsPromised);

const model = 'namespace org.accordproject.usa.business';

const defaultProcessFile = (data: string) => {
    return { name: '@raw.githubusercontent.com.accordproject.business.cto', data };
};

describe('GitHubFileLoader', () => {
    let sandbox: sinon.SinonSandbox;
    let mockAgent: MockAgent;

    beforeEach(() => {
        mockAgent = new MockAgent();

        mockAgent
            .get('https://raw.githubusercontent.com')
            .intercept({ path: '/accordproject/business.cto' })
            .reply(200, model);

        setGlobalDispatcher(mockAgent);
        mockAgent.disableNetConnect();
        sandbox = sinon.createSandbox();
    });

    afterEach(async () => {
        await mockAgent.close();
        setGlobalDispatcher(new Agent());
        sandbox.restore();
    });

    describe('#accepts', () => {
        it('should accept github URIs', () => {
            const ml = new GitHubFileLoader(defaultProcessFile);
            expect(ml.accepts('github://goo')).to.be.true;
        });

        it('should reject unknown URIs', () => {
            const ml = new GitHubFileLoader(defaultProcessFile);
            expect(ml.accepts('foo://goo')).to.be.false;
        });
    });

    describe('#load', () => {
        it('should load github URIs', async () => {
            const ml = new GitHubFileLoader(defaultProcessFile);
            const result = await ml.load('github://accordproject/business.cto', { foo: 'bar' });
            expect(result).to.deep.equal({
                name: '@raw.githubusercontent.com.accordproject.business.cto',
                data: model
            });
        });
    });
});