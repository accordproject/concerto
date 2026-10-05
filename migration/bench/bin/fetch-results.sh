#!/bin/sh
# P5-135 (accordproject/concerto-rust#516): restore raw benchmark or fuzz
# outputs that are kept out of git as draft-release assets.
#
#   sh migration/bench/bin/fetch-results.sh <name|run|all>...
#
# Each archived directory has a MANIFEST (see archive-results.mjs) naming
# the release asset, its sha256 and the archived files. For each argument
# this downloads the asset with `gh release download`, checks its sha256
# against the MANIFEST, extracts it into the MANIFEST's directory and checks
# that every archived file is back. An argument is a MANIFEST name
# (bench-P5-96, fuzz-stage2, bench-root, tags-mocha-results), a bench run
# without its prefix (P5-96), a fuzz run (fuzz/stage2 or stage2), or `all`.
# The release is a draft, so gh needs a login that can see it.
# Run from anywhere inside the concerto checkout; set FETCH_RESULTS_CACHE to
# keep the downloaded tarballs in that directory (re-used when the sha256
# matches) instead of a temporary one.
set -eu

root=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
cd "$root"

if [ $# -eq 0 ]; then
    echo "usage: $0 <name|run|all>..." >&2
    exit 2
fi

manifests() {
    for m in migration/bench/results/MANIFEST migration/bench/results/*/MANIFEST \
             migration/fuzz/results/MANIFEST migration/fuzz/results/*/MANIFEST \
             migration/tags/MANIFEST migration/logs/MANIFEST; do
        [ -f "$m" ] && echo "$m"
    done
    return 0
}

field() { # <manifest> <key>
    awk -F '\t' -v k="$2" '$1 == k { print $2; exit }' "$1"
}

sha256_of() {
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$1" | cut -d ' ' -f 1
    else
        shasum -a 256 "$1" | cut -d ' ' -f 1
    fi
}

# Resolve every argument to its MANIFEST first, so a typo fails before any download.
selected=""
for arg in "$@"; do
    found=""
    for m in $(manifests); do
        name=$(field "$m" name)
        if [ "$arg" = all ]; then
            found="$found $m"
            continue
        fi
        case "$name" in
            "$arg"|"bench-$arg"|"fuzz-$arg"|"fuzz-${arg#fuzz/}") found="$found $m" ;;
        esac
    done
    if [ -z "$found" ]; then
        echo "fetch-results: no MANIFEST named '$arg'. Known names:" >&2
        for m in $(manifests); do echo "  $(field "$m" name)" >&2; done
        exit 2
    fi
    selected="$selected $found"
done

if [ -n "${FETCH_RESULTS_CACHE:-}" ]; then
    cache=$FETCH_RESULTS_CACHE
    mkdir -p "$cache"
    tmp=""
else
    tmp=$(mktemp -d)
    trap 'rm -rf "$tmp"' EXIT
    cache=$tmp
fi

for m in $(printf '%s\n' $selected | sort -u); do
    name=$(field "$m" name)
    dir=$(field "$m" dir)
    repo=$(field "$m" repo)
    release=$(field "$m" release)
    asset=$(field "$m" asset)
    want=$(field "$m" sha256)
    count=$(field "$m" files)
    file="$cache/$asset"
    if [ ! -f "$file" ] || [ "$(sha256_of "$file")" != "$want" ]; then
        rm -f "$file"
        gh release download "$release" -R "$repo" -p "$asset" -D "$cache"
    fi
    got=$(sha256_of "$file")
    if [ "$got" != "$want" ]; then
        echo "fetch-results: $asset sha256 $got does not match $m ($want)" >&2
        exit 1
    fi
    mkdir -p "$dir"
    tar -xzf "$file" -C "$dir"
    missing=$(sed -n '/^archived:$/,$p' "$m" | sed '1d;/^$/d' | while IFS= read -r f; do
        [ -f "$dir/$f" ] || echo "$f"
    done)
    if [ -n "$missing" ]; then
        echo "fetch-results: $name: files missing after extraction:" >&2
        echo "$missing" >&2
        exit 1
    fi
    echo "fetch-results: $name: $count files restored into $dir (sha256 $want)"
done
