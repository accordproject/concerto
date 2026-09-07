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

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import type { AddressInfo } from 'net';

/**
 * Maps a URL path prefix (e.g. "/concerto-core/") to the directory on disk
 * that should be served underneath it (e.g. a package's dist/esm-browser dir).
 */
export interface MountPoint {
    prefix: string;
    dir: string;
}

export interface EsmServer {
    baseUrl: string;
    close: () => Promise<void>;
}

const CONTENT_TYPES: Record<string, string> = {
    '.mjs': 'text/javascript; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
};

/**
 * Starts a minimal static HTTP server that serves one or more browser ESM
 * module graphs (a package's dist/esm-browser directory) so that Chromium can
 * `import()` them. A real HTTP server is required because Chromium refuses to
 * resolve ES module graphs (the relative `./chunk-*.mjs` imports) over the
 * `file://` scheme on CORS grounds, and `page.addScriptTag` only inlines a
 * single file rather than serving the sibling chunks the graph imports.
 *
 * @param {MountPoint[]} mounts - URL prefix to on-disk directory mappings.
 * @returns {Promise<EsmServer>} the running server's base URL and a closer.
 */
export function startEsmServer(mounts: MountPoint[]): Promise<EsmServer> {
    const sortedMounts = [...mounts].sort((a, b) => b.prefix.length - a.prefix.length);

    const server = http.createServer((req, res) => {
        const requestUrl = req.url ?? '/';
        const pathname = decodeURIComponent(requestUrl.split('?')[0]);

        // A blank same-origin document to navigate to before injecting an
        // import map and dynamically importing served modules. Chromium's
        // Private Network Access check blocks a page with an opaque origin
        // (e.g. about:blank) from fetching loopback addresses, so tests must
        // load this page first rather than starting from about:blank.
        if (pathname === '/') {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end('<!doctype html><title>esm host</title>');
            return;
        }

        const mount = sortedMounts.find((candidate) => pathname.startsWith(candidate.prefix));
        if (!mount) {
            res.writeHead(404).end('Not found');
            return;
        }

        const relativePath = pathname.slice(mount.prefix.length);
        const resolved = path.normalize(path.join(mount.dir, relativePath));

        // Guard against path traversal escaping the mounted directory.
        if (!resolved.startsWith(path.normalize(mount.dir))) {
            res.writeHead(403).end('Forbidden');
            return;
        }

        fs.readFile(resolved, (err, data) => {
            if (err) {
                res.writeHead(404).end('Not found');
                return;
            }
            const ext = path.extname(resolved);
            const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': contentType }).end(data);
        });
    });

    return new Promise((resolve, reject) => {
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address() as AddressInfo;
            resolve({
                baseUrl: `http://127.0.0.1:${port}`,
                close: () => new Promise((res, rej) => {
                    server.close((closeErr) => (closeErr ? rej(closeErr) : res()));
                }),
            });
        });
    });
}
