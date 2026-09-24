#!/usr/bin/env bash
# P0-02(B): a Claude Code PreToolUse hook that blocks edits to
# packages/concerto-core/test/** (the "test files are never edited"
# invariant in RUST_MIGRATION_PLAN.md §0/§2.1).
#
# NOT installed by this task — it is provided under migration/bin/ for
# whoever wires up hooks (e.g. via .claude/settings.json's
# `hooks.PreToolUse`) to point at. To install it, add an entry like:
#   { "matcher": "Edit|Write|NotebookEdit|Bash",
#     "hooks": [{ "type": "command", "command": "migration/bin/guard-tests-hook.sh" }] }
#
# Protocol: reads the PreToolUse tool-call JSON on stdin
# ({ tool_name, tool_input: {...}, ... }); exits 2 with a message on stderr
# to BLOCK the call, or exits 0 to allow it. See Claude Code's hooks docs
# for the exact JSON shape this expects; the fields read below
# (.tool_name, .tool_input.file_path, .tool_input.notebook_path,
# .tool_input.command) are the stable ones across recent versions.
set -euo pipefail

GUARD_PATTERN='packages/concerto-core/test/'

INPUT="$(cat)"

# jq is the only thing this needs beyond bash; if it's missing, fail open
# with a warning rather than silently blocking (or silently allowing)
# everything — a broken hook should be loud, not invisible.
if ! command -v jq >/dev/null 2>&1; then
    echo "guard-tests-hook.sh: jq not found on PATH; cannot inspect tool input, allowing call through unchecked" >&2
    exit 0
fi

TOOL_NAME="$(printf '%s' "$INPUT" | jq -r '.tool_name // empty')"

block() {
    local reason="$1"
    echo "BLOCKED by guard-tests-hook.sh: $reason" >&2
    echo "packages/concerto-core/test/** must never be edited (RUST_MIGRATION_PLAN.md §0/§2.1); if a test genuinely needs to change, that is a human decision, not an automated one." >&2
    exit 2
}

path_hits_guard() {
    # Normalise backslashes (Windows-style paths, just in case) and check
    # for the guarded prefix anywhere in the path, so this catches both
    # repo-relative and absolute-checkout paths.
    local p="${1//\\//}"
    [[ "$p" == *"$GUARD_PATTERN"* ]]
}

case "$TOOL_NAME" in
    Edit|Write)
        FILE_PATH="$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty')"
        if [ -n "$FILE_PATH" ] && path_hits_guard "$FILE_PATH"; then
            block "$TOOL_NAME targets $FILE_PATH"
        fi
        ;;
    NotebookEdit)
        FILE_PATH="$(printf '%s' "$INPUT" | jq -r '.tool_input.notebook_path // .tool_input.file_path // empty')"
        if [ -n "$FILE_PATH" ] && path_hits_guard "$FILE_PATH"; then
            block "NotebookEdit targets $FILE_PATH"
        fi
        ;;
    Bash)
        COMMAND="$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')"
        if [ -n "$COMMAND" ] && printf '%s' "$COMMAND" | grep -Eq "$GUARD_PATTERN"; then
            # The guarded path appears somewhere in the command. Allow it
            # through only if the *entire* command is one of a small set of
            # read-only-looking commands (no pipes/chaining at all) — any
            # pipeline, redirection, or mutating verb is treated as a
            # potential write and blocked. Being conservative here (a few
            # false positives on exotic read-only one-liners) is the point:
            # a false negative would let a test file get silently edited.
            READ_ONLY_WHOLE_RE='^[[:space:]]*(cat|less|more|head|tail|grep|rg|find|ls|wc|diff|file|stat|realpath|dirname|basename|md5sum|sha256sum)([[:space:]].*)?[[:space:]]*$'
            HAS_SHELL_METACHARS=0
            case "$COMMAND" in
                *'>'*|*'|'*|*';'*|*'&&'*|*'||'*|*'`'*|'$('*|*'$('*) HAS_SHELL_METACHARS=1 ;;
            esac
            if [ "$HAS_SHELL_METACHARS" -eq 1 ] || ! printf '%s' "$COMMAND" | grep -Eq "$READ_ONLY_WHOLE_RE"; then
                block "Bash command touches $GUARD_PATTERN and is not a plain read-only command: $COMMAND"
            fi
        fi
        ;;
esac

exit 0
