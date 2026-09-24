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
 * Canonicalisation of oracle outcomes (plan §2.2).
 *
 * - object keys are sorted (outcomes only: inputs are order-significant and
 *   are never re-sorted);
 * - a v4 UUID inside any string becomes "<uuid>", unless that UUID occurs in
 *   the op's inputs (then it was supplied, not generated);
 * - an ISO-8601 date-time inside any string becomes "<now>" when its instant
 *   lies inside the op's execution window [start, end] (wall clock, ms,
 *   measured around the call) and is not the instant of any date-time in the
 *   op's inputs. Generated timestamps are therefore normalised and supplied
 *   ones are kept, whatever their formatting.
 */

const crypto = require('crypto');

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;
const ISO_RE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:?\d{2})?/g;

/**
 * Facts about the inputs used to decide what counts as generated.
 * @param {string} inputsText JSON text of the (fully resolved) op inputs
 * @returns {{uuids: Set<string>, instants: Set<number>}} facts
 */
function inputFacts(inputsText) {
    const uuids = new Set();
    const instants = new Set();
    const text = inputsText || '';
    for (const m of text.match(UUID_RE) || []) {
        uuids.add(m.toLowerCase());
    }
    for (const m of text.match(ISO_RE) || []) {
        const t = Date.parse(m);
        if (!Number.isNaN(t)) {
            instants.add(t);
        }
    }
    return { uuids, instants };
}

/**
 * Normalise one string.
 * @param {string} s the string
 * @param {object} facts inputFacts()
 * @param {{start:number,end:number}} window execution window
 * @returns {string} normalised string
 */
function normaliseString(s, facts, window) {
    let out = s.replace(UUID_RE, (m) => (facts.uuids.has(m.toLowerCase()) ? m : '<uuid>'));
    if (window) {
        out = out.replace(ISO_RE, (m) => {
            const t = Date.parse(m);
            if (Number.isNaN(t) || facts.instants.has(t)) {
                return m;
            }
            return t >= window.start && t <= window.end ? '<now>' : m;
        });
    }
    return out;
}

/**
 * Deep-canonicalise a JSON value (sorted keys, normalised strings).
 * @param {*} value a JSON value
 * @param {string|object} inputsText JSON text of the op inputs, or inputFacts() of it
 * @param {{start:number,end:number}} [window] execution window
 * @returns {*} canonical JSON value
 */
function canonicalise(value, inputsText, window) {
    const facts = typeof inputsText === 'object' && inputsText !== null ? inputsText : inputFacts(inputsText);
    const walk = (v) => {
        if (v === null || typeof v === 'number' || typeof v === 'boolean') {
            return v;
        }
        if (typeof v === 'string') {
            return normaliseString(v, facts, window);
        }
        if (Array.isArray(v)) {
            return v.map(walk);
        }
        if (typeof v === 'object') {
            const out = {};
            for (const k of Object.keys(v).sort()) {
                out[k] = walk(v[k]);
            }
            return out;
        }
        throw new Error(`canonicalise: non-JSON value of type ${typeof v}`);
    };
    return walk(value);
}

/**
 * Sort keys only (no string normalisation).
 * @param {*} v JSON value
 * @returns {*} sorted copy
 */
function canonicalSort(v) {
    if (Array.isArray(v)) {
        return v.map(canonicalSort);
    }
    if (v && typeof v === 'object') {
        const out = {};
        for (const k of Object.keys(v).sort()) {
            out[k] = canonicalSort(v[k]);
        }
        return out;
    }
    return v;
}

/**
 * Stable stringify with sorted keys.
 * @param {*} v JSON value
 * @returns {string} text
 */
function sortedStringify(v) {
    return JSON.stringify(canonicalSort(v));
}

/**
 * sha256 hex of a string.
 * @param {string} s text
 * @returns {string} hex digest
 */
function sha256(s) {
    return crypto.createHash('sha256').update(s).digest('hex');
}

module.exports = { canonicalise, sortedStringify, canonicalSort, sha256, normaliseString, inputFacts, UUID_RE, ISO_RE };
