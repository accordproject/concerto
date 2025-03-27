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

declare module 'path-browserify' {
    export function extname(path: string): string;
    export function basename(path: string, ext?: string): string;
    export function dirname(path: string): string;
    export function join(...paths: string[]): string;
    export function resolve(...paths: string[]): string;
    export function normalize(path: string): string;
    export function isAbsolute(path: string): boolean;
    export function relative(from: string, to: string): string;
    export function parse(path: string): {
        root: string;
        dir: string;
        base: string;
        ext: string;
        name: string;
    };
    export function format(pathObject: {
        root?: string;
        dir?: string;
        base?: string;
        ext?: string;
        name?: string;
    }): string;
} 