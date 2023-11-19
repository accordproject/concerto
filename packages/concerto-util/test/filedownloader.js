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

const { GitHubFileLoader, FileDownloader } = require('../src/');

const chai = require('chai');
chai.should();
chai.use(require('chai-things'));
chai.use(require('chai-as-promised'));
const sinon = require('sinon');

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

    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('#downloadExternalDependencies', function() {

        it('should return [] when nothing to do', function() {

            // create a fake model file loader
            const ml = sinon.createStubInstance(GitHubFileLoader);

            // it accepts all URLs
            ml.accepts.returns(true);

            // add a model file that imports externalFile
            const files = [file1];

            // download all the external models for the model manager (there are none!)
            const getExternalImports = (file) => ({});
            const mfd = new FileDownloader(ml, getExternalImports);
            return mfd.downloadExternalDependencies(files, {})
                .then((result) => {
                    result.should.deep.equal([]);
                });
        });

        it('should download a model file and its external dependencies', function() {

            // create a fake model file loader
            const ml = sinon.createStubInstance(GitHubFileLoader);

            // it accepts all URLs
            ml.accepts.returns(true);

            // bind the model files to namespaces in the fake loader
            ml.load.withArgs('github://external.cto').returns(Promise.resolve(externalFile));
            ml.load.withArgs('github://external2.cto').returns(Promise.resolve(externalFile2));

            const files = [file2];
            const getExternalImports = (file) => {
                if (file === file2) {
                    return {
                        'org.external': 'github://external.cto'
                    };
                } else if (file === externalFile) {
                    return {
                        'org.external2': 'github://external2.cto'
                    };
                } else if (file === externalFile2) {
                    return {
                        'org.external2': 'github://external2.cto'
                    };
                } else {
                    return {};
                }
            };
            const mfd = new FileDownloader(ml, getExternalImports);
            return mfd.downloadExternalDependencies(files)
                .then((result) => {
                // there should be 2 (externalFile and externalFile2)
                    result.should.deep.equal([externalFile2,externalFile]);
                });
        });

        it('should handle loader errors', function() {

            // create a fake model file loader
            const ml = sinon.createStubInstance(GitHubFileLoader);

            // it accepts all URLs
            ml.accepts.returns(true);

            // bind the model files to namespaces in the fake loader
            ml.load.withArgs('github://external.cto').returns(Promise.reject('oh noes!'));

            const files = [file2];
            const getExternalImports = (file) => {
                if (file === file2) {
                    return {
                        'org.external': 'github://external.cto'
                    };
                } else {
                    return {};
                }
            };
            const mfd = new FileDownloader(ml, getExternalImports);
            return mfd.downloadExternalDependencies(files)
                .should.be.rejectedWith(Error, 'Failed to load model file.');
        });

        it('should handle loader error caused by DNS failure', function() {

            // create a fake model file loader
            const ml = sinon.createStubInstance(GitHubFileLoader);

            // it accepts all URLs
            ml.accepts.returns(true);

            // bind the model files to namespaces in the fake loader
            ml.load.withArgs('github://external.cto').returns(Promise.reject({ code: 'ENOTFOUND' }));

            const files = [file2];
            const getExternalImports = (file) => {
                if (file === file2) {
                    return {
                        'org.external': 'github://external.cto'
                    };
                } else {
                    return {};
                }
            };
            const mfd = new FileDownloader(ml, getExternalImports);
            return mfd.downloadExternalDependencies(files)
                .should.be.rejectedWith(Error, 'Unable to download external model dependency ');
        });
    });
});
