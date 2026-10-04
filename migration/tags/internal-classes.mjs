// Shared helper: the set of class names defined inside concerto-core's own
// src/ tree. Used by both the static tagger (tag-tests.mjs) and the runtime
// sinon-trace hook (sinon-trace-hook.cjs) so "internal" means the same thing
// in both passes.
//
// A class counted here is one whose *methods and fields* a W (white-box)
// test could stub, spy on, or reach through, per plan §2.1. External
// collaborators (the concerto-cto Parser, FileDownloader, uuid, dayjs) are
// deliberately not part of this list even though concerto-core imports them.

import fs from 'node:fs';
import path from 'node:path';

const CLASS_RE = /^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/gm;

/**
 * Walk srcDir recursively and collect every `class Foo` (or `export class
 * Foo`) declaration name found in .ts/.js files.
 * @param {string} srcDir absolute path to concerto-core/src
 * @returns {Set<string>}
 */
export function computeInternalClassNames(srcDir) {
    const names = new Set();
    /** @param {string} dir */
    function walk(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (/\.(ts|js)$/.test(entry.name)) {
                const src = fs.readFileSync(full, 'utf8');
                let m;
                CLASS_RE.lastIndex = 0;
                while ((m = CLASS_RE.exec(src))) {
                    names.add(m[1]);
                }
            }
        }
    }
    walk(srcDir);
    return names;
}

// Known collaborators that live outside concerto-core's own src tree, but
// that plan §2.1 explicitly says do NOT make a test white-box even when
// stubbed: the CTO Parser, FileDownloader, uuid, dayjs, and Factory's
// newId specifically (as opposed to the rest of Factory's behaviour).
export const EXTERNAL_COLLABORATORS = new Set([
    'Parser',
    'FileDownloader',
    'uuid',
    'Uuid',
    'UUID',
    'dayjs',
    'Dayjs',
    'DayJS',
    'Globalize', // message-catalogue lookup, treated as external/pure
]);

// Method names that, even when the receiver's class can't be identified,
// are internal-only surface (private/internal helpers or visitor entry
// points) and so are always a W signal when stubbed/spied/read.
export const INTERNAL_ONLY_MEMBER_RE =
    /\b(?:_resolveSuperType|_resolveInternal|visit[A-Z]\w*|modelFiles\[|\.ast\b|\.getAst\(\))\b/;
