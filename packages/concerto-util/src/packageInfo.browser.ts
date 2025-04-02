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
 * Provides mock package.json data for browser builds.
 * @module packageInfo.browser
 */
const packageJson: { name: string; version: string; [key: string]: any } = {
    // Hardcoded values for browser builds; if dynamic package names are needed in the browser,
    // a build-time injection solution (e.g., Webpack plugin) would be required.
    name: 'concerto-util',
    version: '4.0.0-alpha.0'
};

export default packageJson;