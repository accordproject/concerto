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

/**
 * The Concertino format version and its compatibility rule.
 *
 * A Concertino document records the version of the format it was written in
 * as `metadata.concertinoVersion`. The version follows semantic versioning:
 * - a new **minor** version only adds optional fields, so every document of an
 *   earlier minor version of the same major is still a valid document, and a
 *   reader of any minor version can read it (unknown optional fields are
 *   ignored);
 * - a new **major** version is the only kind that may remove, rename or
 *   change the meaning of a field.
 *
 * The runtime (`./runtime`) and the validator (`./validate`) accept every
 * document of the major version below and reject any other with a
 * `ConcertinoVersionError`.
 *
 * The format version is not the npm package version: the package is
 * versioned with the rest of the Concerto monorepo, and it can ship a new
 * major release without changing the format.
 */

/** The format version this package writes (`metadata.concertinoVersion`). */
export const CONCERTINO_VERSION = '5.1.0';

/** The major format version this package reads. */
export const CONCERTINO_MAJOR_VERSION = 5;

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

/**
 * Thrown when a Concertino document's `metadata.concertinoVersion` is
 * missing, is not a semantic version, or has a major version this package
 * does not read.
 */
export class ConcertinoVersionError extends Error {
    /** The version the document records, or undefined when it records none. */
    version: unknown;
    constructor(version: unknown, message: string) {
        super(message);
        this.name = 'ConcertinoVersionError';
        this.version = version;
    }
}

/**
 * The major version of a semantic version string.
 * @param {unknown} version - The version.
 * @returns {number | undefined} The major version, or undefined when `version` is not a semantic version.
 */
export function majorVersionOf(version: unknown): number | undefined {
    if (typeof version !== 'string') {
        return undefined;
    }
    const match = SEMVER.exec(version);
    return match ? Number(match[1]) : undefined;
}

/**
 * Checks that this package can read a Concertino document: its
 * `metadata.concertinoVersion` must be a semantic version with major version
 * `CONCERTINO_MAJOR_VERSION`. Any minor or patch version is accepted.
 * @param {unknown} doc - The Concertino document.
 * @throws {ConcertinoVersionError} When the version is missing, malformed or of another major version.
 */
export function checkConcertinoVersion(doc: unknown): void {
    const metadata = (doc !== null && typeof doc === 'object') ? (doc as { metadata?: unknown }).metadata : undefined;
    const version = (metadata !== null && typeof metadata === 'object') ? (metadata as { concertinoVersion?: unknown }).concertinoVersion : undefined;
    if (version === undefined) {
        throw new ConcertinoVersionError(version, 'Not a Concertino document: metadata.concertinoVersion is missing');
    }
    const major = majorVersionOf(version);
    if (major === undefined) {
        throw new ConcertinoVersionError(version, `Concertino version ${JSON.stringify(version)} is not a semantic version`);
    }
    if (major !== CONCERTINO_MAJOR_VERSION) {
        throw new ConcertinoVersionError(version,
            `Concertino version ${version} is not supported: this package reads major version ${CONCERTINO_MAJOR_VERSION} (${CONCERTINO_MAJOR_VERSION}.x.y) only`);
    }
}
