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

const crypto = require('crypto');
const semver = require('semver');
const Logger = require('@accordproject/concerto-util').Logger;
const Globalize = require('../lib/globalize');

/**
 * Checks that a change log file takes into account
 * the signature of a public API (tracks API breakage)
 * and that the version number in package.json is in sync
 * with the contents of the changelog.
 * @private
 * @class
 * @memberof module:concerto-core
 */
class VersionChecker {

    /**
     * @param {string} changelog - the text of a changelog file
     * @param {string} publicApi - the text of a public API description
     * @param {string} packageJson - the text of a package.json file
     * @returns {boolean} true if the version check passes
     * @throws {Error} if there is an issue with the version check
     */
    static check(changelog, publicApi, packageJson) {
        const changelogLines = changelog.split('\n');
        const digest = VersionChecker.getDigest(publicApi);
        let result = false;

        for (let n = 0; n < changelogLines.length; n++) {
            const line = changelogLines[n];

            if (!line.startsWith('#')) {
                // find the first instance of 'Version'
                const versionIndex = line.indexOf('Version');
                if (versionIndex >= 0) {
                    // find the version number
                    const openBraceIndex = line.indexOf('{', versionIndex);

                    if (openBraceIndex < 0) {
                        let formatter = Globalize.messageFormatter('versionchecker-check-missing-open-brace');
                        throw new Error(formatter({
                            line: line
                        }));
                    }

                    const version = line.substring(versionIndex + 'Version'.length, openBraceIndex).trim();

                    // check the version in package.json is up to date
                    const packageObj = JSON.parse(packageJson);

                    if (!semver.lte(version, semver.inc(packageObj.version,'patch'))) {
                        let formatter = Globalize.messageFormatter('versionchecker-check-invalid-version');
                        throw new Error(formatter({
                            version: version,
                            packageObjVersion: packageObj.version
                        }));
                    }

                    // get MD5
                    const closeBraceIndex = line.indexOf('}', openBraceIndex);

                    if (closeBraceIndex < 0) {
                        let formatter = Globalize.messageFormatter('versionchecker-check-missing-close-brace');
                        throw new Error(formatter({
                            line: line
                        }));
                    }

                    const md5 = line.substring(openBraceIndex + 1, closeBraceIndex).trim();

                    if (digest !== md5) {
                        let formatter = Globalize.messageFormatter('versionchecker-check-invalid-md5');
                        throw new Error(formatter({
                            digest: digest,
                        }));
                    }

                    // we're done here...
                    result = true;
                    break;
                }
            }

        }
        if (!result) {
            throw new Error(
                Globalize.formatMessage('versionchecker-check-no-version')
            );
        }
        else {
            Logger.info('SUCCESS: validated public API against package.json and changelog.txt.');
        }

        return true;
    }

    /**
     * Gets the digest (hash) for an input string
     * @param {string} data - the data to hash
     * @returns {string} the hash in hex format
     */
    static getDigest(data) {
        return crypto.createHash('md5').update(data).digest('hex');
    }
}

module.exports = VersionChecker;
