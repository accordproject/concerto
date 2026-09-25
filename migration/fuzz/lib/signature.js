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
 * Cluster-signature computation, shared by bin/triage.js (clustering
 * divergences.jsonl) and bin/minimize-clusters.js (verifying that a
 * shrunk reproducer still belongs to the same cluster). Pulled out of
 * triage.js during P5-05 stage-1 review fixes so the two tools cannot
 * silently drift into computing "the same cluster" two different ways.
 */

function outcomeKind(canon) {
    if (canon && typeof canon === 'object' && 'error' in canon) {
        return { verdict: 'error', cls: canon.error && canon.error.class || 'unknown' };
    }
    if (canon && typeof canon === 'object' && 'ok' in canon) {
        return { verdict: 'ok', cls: null };
    }
    return { verdict: 'other:' + JSON.stringify(canon).slice(0, 40), cls: null };
}

function template(msg) {
    if (typeof msg !== 'string') { return ''; }
    return msg
        .replace(/'[^']*'/g, "'…'")
        .replace(/"[^"]*"/g, '"…"')
        .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<uuid>')
        .replace(/\b\d+\b/g, '<n>')
        .slice(0, 160);
}

/**
 * @param {object} d a divergence record: {op, ts, rust, ...}
 * @returns {string} the signature bin/triage.js clusters by: (op, TS outcome
 *   kind, Rust outcome kind, templated message)
 */
function signatureOf(d) {
    const t = outcomeKind(d.ts);
    const r = outcomeKind(d.rust);
    const tMsg = d.ts && d.ts.error ? template(d.ts.error.message) : '';
    const rMsg = d.rust && d.rust.error ? template(d.rust.error.message) : '';
    return [d.op, `ts=${t.verdict}${t.cls ? '(' + t.cls + ')' : ''}`, `rust=${r.verdict}${r.cls ? '(' + r.cls + ')' : ''}`, tMsg && `ts:"${tMsg}"`, rMsg && `rust:"${rMsg}"`].filter(Boolean).join(' | ');
}

module.exports = { outcomeKind, template, signatureOf };
