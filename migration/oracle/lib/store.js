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

/**
 * Content-addressed blob store for large fixture values.
 *
 * Any string longer than STRING_LIMIT characters, and any object/array whose
 * JSON (after its own children were blobbed) is longer than NODE_LIMIT
 * characters, is written once to blobs/<aa>/<sha256>.json and replaced by
 * {"@@oracle":"blob","sha256":"..."}. Model text and ASTs, which recur across
 * thousands of fixtures, are therefore stored once.
 *
 * Resolving a blob that is missing or unreadable raises a HarnessError: a
 * fixture whose input cannot be loaded is never a pass.
 */

const fs = require('fs');
const path = require('path');
const { sha256 } = require('./canon');
const { M, HarnessError } = require('./codec');

const STRING_LIMIT = 1024;
const NODE_LIMIT = 4096;

/**
 * @param {string} dir blob directory
 * @returns {object} store
 */
function blobStore(dir) {
    const known = new Set();
    const cache = new Map();

    const fileFor = (h) => path.join(dir, h.slice(0, 2), h + '.json');

    const put = (value) => {
        const text = JSON.stringify(value);
        const h = sha256(text);
        if (!known.has(h)) {
            const f = fileFor(h);
            if (!fs.existsSync(f)) {
                fs.mkdirSync(path.dirname(f), { recursive: true });
                const tmp = f + '.' + process.pid + '.tmp';
                fs.writeFileSync(tmp, text);
                fs.renameSync(tmp, f);
            }
            known.add(h);
        }
        return { [M]: 'blob', sha256: h };
    };

    /**
     * Replace large subtrees with blob references (bottom-up).
     * @param {*} v JSON value
     * @returns {*} value with blob refs
     */
    const REF_SIZE = 90;
    const packSized = (v) => {
        if (typeof v === 'string') {
            return v.length > STRING_LIMIT ? [put(v), REF_SIZE] : [v, v.length + 2];
        }
        if (v === null || typeof v !== 'object') {
            return [v, 8];
        }
        let out;
        let size = 2;
        if (Array.isArray(v)) {
            out = [];
            for (const x of v) {
                const [p, s] = packSized(x);
                out.push(p);
                size += s + 1;
            }
        } else {
            out = {};
            for (const k of Object.keys(v)) {
                const [p, s] = packSized(v[k]);
                out[k] = p;
                size += s + k.length + 4;
            }
        }
        return size > NODE_LIMIT ? [put(out), REF_SIZE] : [out, size];
    };
    /**
     * @param {*} v JSON value
     * @param {{root: boolean}} [opts] root: false keeps the top-level node
     * (and its direct keys) inline and packs only below it
     * @returns {*} packed value
     */
    const pack = (v, opts) => {
        if (opts && opts.root === false && v && typeof v === 'object' && !Array.isArray(v)) {
            const out = {};
            for (const k of Object.keys(v)) {
                out[k] = packSized(v[k])[0];
            }
            return out;
        }
        return packSized(v)[0];
    };

    /**
     * Resolve every blob reference (recursively).
     * @param {*} v JSON value with blob refs
     * @returns {*} fully resolved value
     */
    const unpack = (v) => {
        if (v === null || typeof v !== 'object') {
            return v;
        }
        if (Array.isArray(v)) {
            return v.map(unpack);
        }
        if (v[M] === 'blob') {
            if (typeof v.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(v.sha256)) {
                throw new HarnessError('malformed blob reference');
            }
            if (cache.has(v.sha256)) {
                return cache.get(v.sha256);
            }
            let text;
            try {
                text = fs.readFileSync(fileFor(v.sha256), 'utf8');
            } catch (e) {
                throw new HarnessError('missing blob ' + v.sha256);
            }
            if (sha256(text) !== v.sha256) {
                throw new HarnessError('corrupt blob ' + v.sha256);
            }
            let parsed;
            try {
                parsed = JSON.parse(text);
            } catch (e) {
                throw new HarnessError('unreadable blob ' + v.sha256);
            }
            const resolved = unpack(parsed);
            if (cache.size > 20000) {
                cache.clear();
            }
            cache.set(v.sha256, resolved);
            return resolved;
        }
        const out = {};
        for (const k of Object.keys(v)) {
            out[k] = unpack(v[k]);
        }
        return out;
    };

    const blobFacts = new Map();
    /**
     * inputFacts() of the fully resolved JSON text of a packed value, computed
     * without materialising it: the packed text plus every referenced blob.
     * @param {*} packed packed JSON value
     * @returns {{uuids:Set<string>, instants:Set<number>}} facts
     */
    const facts = (packed) => {
        const { inputFacts } = require('./canon');
        const acc = { uuids: new Set(), instants: new Set() };
        const merge = (f) => {
            f.uuids.forEach((x) => acc.uuids.add(x));
            f.instants.forEach((x) => acc.instants.add(x));
        };
        const visit = (text) => {
            merge(inputFacts(text));
            const re = /"@@oracle":"blob","sha256":"([0-9a-f]{64})"/g;
            let m;
            while ((m = re.exec(text)) !== null) {
                const h = m[1];
                if (!blobFacts.has(h)) {
                    let t;
                    try {
                        t = fs.readFileSync(fileFor(h), 'utf8');
                    } catch (e) {
                        throw new HarnessError('missing blob ' + h);
                    }
                    blobFacts.set(h, null);
                    const sub = { uuids: new Set(), instants: new Set() };
                    const saved = [acc.uuids, acc.instants];
                    acc.uuids = sub.uuids;
                    acc.instants = sub.instants;
                    visit(t);
                    acc.uuids = saved[0];
                    acc.instants = saved[1];
                    blobFacts.set(h, sub);
                }
                const f = blobFacts.get(h);
                if (f) {
                    merge(f);
                }
            }
        };
        visit(JSON.stringify(packed));
        return acc;
    };

    return { dir, put, pack, unpack, fileFor, facts };
}

module.exports = { blobStore, STRING_LIMIT, NODE_LIMIT };
