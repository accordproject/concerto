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

const HTTPFileLoader = require('../../dist/loaders/httpfileloader');
const moxios = require('moxios');

const chai = require('chai');
chai.should();
chai.use(require('chai-things'));
chai.use(require('chai-as-promised'));
const sinon = require('sinon');

const defaultProcessFile = (name, data) => {
    return { name, data };
};

describe('HTTPModeFilelLoader', () => {
    let sandbox;

    let model = `namespace test@1.0.0
    enum Test {
        o ONE
    }`;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        moxios.install();
    });

    afterEach(() => {
        sandbox.restore();
        moxios.uninstall();
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

            // Match against an exact URL value
            const url = 'https://raw.githubusercontent.com/accordproject/models/master/src/usa/business.cto';

            moxios.stubRequest(url, {
                status: 200,
                responseText: model
            });

            const ml = new HTTPFileLoader(defaultProcessFile);
            return ml.load(url)
                .then((mf) => {
                    mf.should.be.deep.equal({
                        name: '@raw.githubusercontent.com.accordproject.models.master.src.usa.business.cto',
                        data: model
                    });
                });
        });
    });
});
