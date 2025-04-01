/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * You may not use this file except in compliance with the License.
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

import GitHubFileLoader from '../src/loaders/githubfileloader';
import FileDownloader from '../src/filedownloader';
import chai, { expect } from 'chai';
import sinon from 'sinon';
import chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);

describe('FileDownloader', () => {
    let sandbox: sinon.SinonSandbox;
    let ml: sinon.SinonStubbedInstance<GitHubFileLoader>;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        ml = sinon.createStubInstance(GitHubFileLoader);
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('#downloadExternalDependencies', () => {
        it('should handle generic loader errors properly', async () => {
            ml.load.withArgs('github://external.cto').rejects(new Error('oh noes!'));

            const files = [`namespace org.root\nimport org.external from github://external.cto\nconcept Foo {};`];
            const getExternalImports = (_file: string): Record<string, string> => ({ 'org.external': 'github://external.cto' });

            const mfd = new FileDownloader(ml, getExternalImports, 1);
            await expect(mfd.downloadExternalDependencies(files)).to.be.rejectedWith(
                Error,
                "Failed to load model file. Job: github://external.cto Details: Error: oh noes!"
            );
        });

        it('should handle DNS failure correctly', async () => {
            const dnsError = new Error('DNS failure');
            (dnsError as any).code = 'ENOTFOUND';
            ml.load.withArgs('github://external.cto').rejects(dnsError);

            const files = [`namespace org.root\nimport org.external from github://external.cto\nconcept Foo {};`];
            const getExternalImports = (_file: string): Record<string, string> => ({ 'org.external': 'github://external.cto' });

            const mfd = new FileDownloader(ml, getExternalImports, 1);
            await expect(mfd.downloadExternalDependencies(files)).to.be.rejectedWith(
                "Unable to download external model dependency 'github://external.cto'"
            );
        });

        it('should handle HTTP errors correctly', async () => {
            const httpError = new Error('HTTP error');
            (httpError as any).response = { status: 404 };
            ml.load.withArgs('github://external.cto').rejects(httpError);

            const files = [`namespace org.root\nimport org.external from github://external.cto\nconcept Foo {};`];
            const getExternalImports = (_file: string): Record<string, string> => ({ 'org.external': 'github://external.cto' });

            const mfd = new FileDownloader(ml, getExternalImports, 1);
            await expect(mfd.downloadExternalDependencies(files)).to.be.rejectedWith(
                "Unable to download external model dependency 'github://external.cto'"
            );
        });
    });
});