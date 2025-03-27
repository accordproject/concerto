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

import GitHubFileLoader from '../src/loaders/githubfileloader';
import FileDownloader from '../src/filedownloader';
import chai, { expect } from 'chai';
import sinon from 'sinon';
import chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);

const file1 = `namespace org.root
concept Foo {}`;
const file2 = `namespace org.root
import org.external from github://external.cto
concept Foo {}`;
const externalFile = `namespace org.external
import org.external2 from github://external2.cto
concept Foo {}`;
const externalFile2 = `namespace org.external2
import org.external2 from github://external2.cto
concept Foo {}`;

describe('FileDownloader', () => {
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('#downloadExternalDependencies', () => {
        it('should return [] when nothing to do', async () => {
            const ml = sinon.createStubInstance(GitHubFileLoader);
            ml.load.resolves('loaded content');
            const files = [file1];
            const getExternalImports = (file: string): Record<string, string> => ({});
            const mfd = new FileDownloader(ml, getExternalImports, 1);
            const result = await mfd.downloadExternalDependencies(files, {});
            expect(result).to.deep.equal([]);
        });

        it('should download a model file and its external dependencies', async () => {
            const ml = sinon.createStubInstance(GitHubFileLoader);
            ml.load.withArgs('github://external.cto').resolves(externalFile);
            ml.load.withArgs('github://external2.cto').resolves(externalFile2);

            const files = [file2];
            const getExternalImports = (file: string): Record<string, string> => {
                if (file === file2) {
                    return {
                        'org.external': 'github://external.cto',
                        'org.external2': ''
                    };
                } else if (file === externalFile) {
                    return {
                        'org.external': '',
                        'org.external2': 'github://external2.cto'
                    };
                } else if (file === externalFile2) {
                    return {
                        'org.external': '',
                        'org.external2': 'github://external2.cto'
                    };
                } else {
                    return {
                        'org.external': '',
                        'org.external2': ''
                    };
                }
            };
            const mfd = new FileDownloader(ml, getExternalImports, 1);
            const result = await mfd.downloadExternalDependencies(files);
            expect(result.sort()).to.deep.equal([externalFile, externalFile2]);
        });

        it('should handle loader errors', async () => {
            const ml = sinon.createStubInstance(GitHubFileLoader);
            ml.load.withArgs('github://external.cto').rejects(new Error('oh noes!'));
            const files = [file2];
            const getExternalImports = (file: string): Record<string, string> => {
                if (file === file2) {
                    return {
                        'org.external': 'github://external.cto',
                        'org.external2': ''
                    };
                }
                return {
                    'org.external': '',
                    'org.external2': ''
                };
            };
            const mfd = new FileDownloader(ml, getExternalImports, 1);
            await expect(mfd.downloadExternalDependencies(files)).to.be.rejectedWith(Error, /Failed to load model file. Job: github:\/\/external.cto Details: Error: oh noes!/);
        });

        it('should handle loader error caused by DNS failure', async () => {
            const ml = sinon.createStubInstance(GitHubFileLoader);
            const dnsError = new Error('DNS failure');
            (dnsError as any).code = 'ENOTFOUND';
            ml.load.withArgs('github://external.cto').rejects(dnsError);
            const files = [file2];
            const getExternalImports = (file: string): Record<string, string> => {
                if (file === file2) {
                    return {
                        'org.external': 'github://external.cto',
                        'org.external2': ''
                    };
                }
                return {
                    'org.external': '',
                    'org.external2': ''
                };
            };
            const mfd = new FileDownloader(ml, getExternalImports, 1);
            const error = await mfd.downloadExternalDependencies(files).catch(e => e);
            expect(error).to.be.an.instanceOf(Error);
            expect(error.message).to.equal("Unable to download external model dependency 'github://external.cto'");
            expect(error.code).to.equal('MISSING_DEPENDENCY');
        });
    });
});