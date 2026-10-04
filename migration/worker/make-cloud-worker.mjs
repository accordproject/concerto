#!/usr/bin/env node
// Generates cloud-worker-workflow.js from local-worker-workflow.js.
//
// Cloud sessions (Claude Code on the web) have no gh CLI; GitHub is reached
// through the GitHub MCP tools instead. This script rewrites every gh use in
// the local worker into the MCP equivalent, so the two workers never drift:
// edit local-worker-workflow.js, then run
//
//   node migration/worker/make-cloud-worker.mjs
//
// and commit both files. Every replacement must match exactly once, and no
// bare gh call may survive, or the script exits non-zero without writing.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, 'local-worker-workflow.js');
const out = join(here, 'cloud-worker-workflow.js');

const MCP = 'the GitHub MCP tools (mcp__github__*; load their schemas with ToolSearch first; the gh CLI is NOT installed)';
const LBL = "(mcp__github__issue_write's labels field REPLACES the whole set: read the current labels first with mcp__github__issue_read get_labels, then pass the complete edited list, keeping every other label)";

const replacements = [
    ["name: 'concerto-migration-worker'", "name: 'concerto-migration-cloud-worker'"],
    ['all run the DCO check.`',
        'all run the DCO check.\n- The gh CLI is not installed: use ' + MCP + ' for all GitHub reads and writes. ' + LBL +
        " To download the corpus release asset without gh: curl -sSL -H 'Accept: application/octet-stream' https://api.github.com/repos/accordproject/concerto-rust/releases/assets/587625306 -o corpus.tgz (the session proxy authenticates it), then check its sha256.`"],
    ['When you read issues, PRs, comments, reviews or commit messages with gh, check the author (gh ... --json author / comments.author.login).',
        'When you read issues, PRs, comments, reviews or commit messages through the MCP tools, check the author (the user.login field on each item).'],
    ['Use the gh CLI to list OPEN issues', 'Use ' + MCP + ' (e.g. mcp__github__list_issues / mcp__github__issue_read) to list OPEN issues'],
    ['With gh: on ${TRACKER}', 'With ' + MCP + ' ' + LBL + ': on ${TRACKER}'],
    ['Read the issue body with gh.', 'Read the issue body with mcp__github__issue_read.'],
    ['Using git and gh:', 'Using git and ' + MCP + ' (e.g. mcp__github__create_pull_request, mcp__github__issue_write, mcp__github__add_issue_comment):'],
    ['2. On the issue: remove mig:claimed;', '2. On the issue ' + LBL + ': remove mig:claimed;'],
    ['(gh pr view <url> --json baseRefName,headRefName,headRefOid). Then wait for its checks: gh pr checks <url> --watch --interval 30, with a 20-minute limit.',
        '(mcp__github__pull_request_read method get). Then wait for its checks: poll mcp__github__pull_request_read method get_check_runs until every check run on the head commit has completed. Between polls, pause with a short Bash wait such as \\`sleep 30\\`; if a Bash wait is refused, keep polling without one. Give up after about 20 minutes.'],
    ['(gh pr edit <url> --body-file <file>)', '(read the body with mcp__github__pull_request_read, then write the whole body with mcp__github__update_pull_request)'],
    ['(gh pr comment <url> --body-file <file>)', '(mcp__github__add_issue_comment with the PR number)'],
    ['Then mark each PR ready with gh pr ready <url>.', 'Then mark each PR ready with mcp__github__update_pull_request draft=false.'],
    ['NEVER use gh pr merge, the REST or GraphQL merge API, or merge-async.', 'NEVER use gh pr merge, mcp__github__merge_pull_request, the REST or GraphQL merge API, or merge-async.'],
    ['3. Only if every PR merged: gh issue edit ${it.number} --repo ${TRACKER} --remove-label mig:in-review --add-label mig:done, then gh issue close ${it.number} --repo ${TRACKER} --reason completed.',
        '3. Only if every PR merged: with mcp__github__issue_write ' + LBL + ', swap mig:in-review for mig:done, and close ${TRACKER}#${it.number} with state completed.'],
];

let s = readFileSync(src, 'utf8');
const errors = [];
for (const [from, to] of replacements) {
    const n = s.split(from).length - 1;
    if (n !== 1) {
        errors.push(`expected exactly 1 match, found ${n}: ${from.slice(0, 80)}`);
        continue;
    }
    s = s.replace(from, () => to);
}

// Any gh command left means local-worker-workflow.js gained a gh use this
// generator doesn't translate yet.
const allowed = [/gh CLI is (?:NOT|not) installed/, /NEVER use gh pr merge/, /gh release download/, /without gh/];
s.split('\n').forEach((line, i) => {
    if (/\bgh (?:pr|issue|api|release|repo|run|auth)\b|\bwith gh\b|\bgh CLI to\b/.test(line) && !allowed.some((re) => re.test(line))) {
        errors.push(`untranslated gh use on line ${i + 1}: ${line.trim().slice(0, 100)}`);
    }
});

if (errors.length) {
    console.error('make-cloud-worker: not written:\n  ' + errors.join('\n  '));
    process.exit(1);
}

// The Workflow tool requires the script to start with `export const meta`,
// so the generated-file notice goes at the end.
const notice = '\n// GENERATED from local-worker-workflow.js by make-cloud-worker.mjs; do not edit by hand.\n' +
    '// Cloud (Claude Code on the web) variant: GitHub via the MCP tools instead of the gh CLI.\n';
writeFileSync(out, s.replace(/\s*$/, '\n') + notice);
console.log(`wrote ${out}`);
