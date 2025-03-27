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

declare module '@accordproject/concerto-util' {
    export class BaseFileException extends Error {
        constructor(message: string, fileLocation: any, fullMessage: string, fileName?: string, component?: string);
    }

    export class DefaultFileLoader {
        constructor(processFile: (name: string, data: any) => any);
    }

    export class FileDownloader {
        constructor(fileLoader: DefaultFileLoader, getExternalImports: any);
        downloadExternalDependencies(models: any[], options?: any): Promise<any[]>;
    }
} 