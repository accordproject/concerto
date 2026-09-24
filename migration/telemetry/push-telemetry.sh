#!/usr/bin/env bash
# migration/telemetry/push-telemetry.sh
#
# Copies migration/telemetry/ into a separate git worktree of this repo
# checked out on the durability branch 'migration-telemetry' (plan §5.1:
# "Telemetry lives on a separate migration-telemetry branch of the
# concerto repo, so it stays out of the PRs. It is pushed after every
# snapshot, because containers are ephemeral."), then commits and pushes
# that worktree.
#
# This script is NOT run automatically by anything in this task -- it is
# meant to be invoked by the dispatcher (or by hand) after a telemetry
# snapshot, on whatever cadence it chooses.
#
# What it does, in order:
#   1. Finds this repo's root (the directory containing migration/) via
#      `git rev-parse --show-toplevel` from this script's own location.
#   2. Ensures a worktree exists at WORKTREE_DIR (default:
#      <repo-root>/../<repo-name>-migration-telemetry-worktree) checked
#      out on branch 'migration-telemetry':
#        - if the branch exists (locally or on the remote), the worktree
#          is added on that branch;
#        - if it doesn't exist anywhere, an ORPHAN branch is created (no
#          shared history with any other branch -- deliberately, so this
#          never touches or rewrites the branches other tasks work on).
#   3. rsyncs (or cp -a, if rsync is unavailable) migration/telemetry/
#      from the main worktree into <WORKTREE_DIR>/migration/telemetry/,
#      deleting files on the far side that no longer exist on this side
#      (--delete), so the branch always mirrors this directory exactly.
#   4. Stages migration/telemetry/, and commits if there's anything to
#      commit (a snapshot with no changes since the last push is a
#      silent no-op, not an error).
#   5. Pushes migration-telemetry to the 'origin' remote (override with
#      --remote), creating the upstream on first push.
#
# It never touches any other branch, never runs from inside the main
# worktree's index (all git commit/push happens with -C pointed at the
# separate worktree), and never force-pushes.
#
# Usage:
#   bash migration/telemetry/push-telemetry.sh [--remote NAME]
#        [--worktree-dir PATH] [--message TEXT] [--dry-run]
#
# --dry-run does everything except the final `git push` (the worktree is
# still created/updated and the commit is still made locally), so you can
# inspect what would be pushed.

set -euo pipefail

REMOTE="origin"
WORKTREE_DIR=""
MESSAGE=""
DRY_RUN=0

while [ $# -gt 0 ]; do
  case "$1" in
    --remote) REMOTE="$2"; shift 2 ;;
    --worktree-dir) WORKTREE_DIR="$2"; shift 2 ;;
    --message) MESSAGE="$2"; shift 2 ;;
    --dry-run) DRY_RUN=1; shift ;;
    *) echo "push-telemetry: unknown argument: $1" >&2; exit 1 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
REPO_NAME="$(basename "$REPO_ROOT")"
BRANCH="migration-telemetry"

if [ -z "$WORKTREE_DIR" ]; then
  WORKTREE_DIR="$(dirname "$REPO_ROOT")/${REPO_NAME}-${BRANCH}-worktree"
fi

if [ -z "$MESSAGE" ]; then
  MESSAGE="telemetry snapshot $(date -u +%Y-%m-%dT%H:%M:%SZ)"
fi

echo "push-telemetry: repo root:      $REPO_ROOT"
echo "push-telemetry: worktree dir:   $WORKTREE_DIR"
echo "push-telemetry: branch:         $BRANCH"
echo "push-telemetry: remote:         $REMOTE"

# ---- 1/2: make sure the worktree + branch exist -----------------------
if [ -d "$WORKTREE_DIR/.git" ] || git -C "$WORKTREE_DIR" rev-parse --git-dir >/dev/null 2>&1; then
  echo "push-telemetry: worktree already exists, reusing it"
else
  mkdir -p "$(dirname "$WORKTREE_DIR")"
  if git -C "$REPO_ROOT" show-ref --verify --quiet "refs/heads/$BRANCH"; then
    echo "push-telemetry: local branch '$BRANCH' exists; adding worktree on it"
    git -C "$REPO_ROOT" worktree add "$WORKTREE_DIR" "$BRANCH"
  elif git -C "$REPO_ROOT" ls-remote --exit-code --heads "$REMOTE" "$BRANCH" >/dev/null 2>&1; then
    echo "push-telemetry: remote branch '$REMOTE/$BRANCH' exists; fetching and adding worktree on it"
    git -C "$REPO_ROOT" fetch "$REMOTE" "$BRANCH"
    git -C "$REPO_ROOT" worktree add -b "$BRANCH" "$WORKTREE_DIR" "$REMOTE/$BRANCH"
  else
    echo "push-telemetry: branch '$BRANCH' doesn't exist anywhere; creating it as an orphan"
    git -C "$REPO_ROOT" worktree add --detach "$WORKTREE_DIR" HEAD
    git -C "$WORKTREE_DIR" checkout --orphan "$BRANCH"
    git -C "$WORKTREE_DIR" rm -rf --quiet . >/dev/null 2>&1 || true
  fi
fi

# ---- 3: mirror migration/telemetry/ into the worktree ------------------
mkdir -p "$WORKTREE_DIR/migration/telemetry"
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete "$SCRIPT_DIR/" "$WORKTREE_DIR/migration/telemetry/"
else
  rm -rf "${WORKTREE_DIR:?}/migration/telemetry"
  mkdir -p "$WORKTREE_DIR/migration/telemetry"
  cp -a "$SCRIPT_DIR/." "$WORKTREE_DIR/migration/telemetry/"
fi

# ---- 4: commit if there's anything to commit ---------------------------
git -C "$WORKTREE_DIR" add migration/telemetry

if git -C "$WORKTREE_DIR" diff --cached --quiet; then
  echo "push-telemetry: nothing changed since the last snapshot; nothing to commit"
else
  git -C "$WORKTREE_DIR" commit -m "$MESSAGE" --quiet
  echo "push-telemetry: committed: $MESSAGE"
fi

# ---- 5: push -------------------------------------------------------------
if [ "$DRY_RUN" -eq 1 ]; then
  echo "push-telemetry: --dry-run set, not pushing (worktree left at $WORKTREE_DIR for inspection)"
  exit 0
fi

if git -C "$WORKTREE_DIR" rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
  git -C "$WORKTREE_DIR" push "$REMOTE" "$BRANCH"
else
  git -C "$WORKTREE_DIR" push --set-upstream "$REMOTE" "$BRANCH"
fi

echo "push-telemetry: pushed $BRANCH to $REMOTE"
