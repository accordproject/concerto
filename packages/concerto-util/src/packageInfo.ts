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

import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';

/**
 * Traverses up the directory tree to find the nearest package.json file.
 * @param startDir - The directory to start searching from.
 * @returns The path to the nearest package.json file.
 * @throws If no package.json file is found.
 */
function findPackageJson(startDir: string): string {
    let currentDir = startDir;
    while (currentDir !== dirname(currentDir)) { // Stop at the root directory
        const potentialPath = join(currentDir, 'package.json');
        if (existsSync(potentialPath)) {
            return potentialPath;
        }
        currentDir = dirname(currentDir);
    }
    throw new Error('Could not find package.json in any parent directory.');
}

/**
 * Provides access to package.json data.
 * @module packageInfo
 */
const packageJsonPath = findPackageJson(__dirname);
let packageJson: { name: string; version: string; [key: string]: any };

try {
    const rawData = readFileSync(packageJsonPath, 'utf8');
    packageJson = JSON.parse(rawData);
} catch (error) {
    if (error instanceof Error) {
        throw new Error(`Failed to read package.json at ${packageJsonPath}: ${error.message}`);
    } else {
        throw new Error('Failed to read package.json due to an unknown error.');
    }
}

export default packageJson;