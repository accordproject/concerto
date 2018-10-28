#!/bin/bash
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
# 
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#

# Script for the deploy phase, to push NPM modules, docker images and
# cloud playground images

# Exit on first error, print all commands.
set -ev
set -o pipefail

# Bring in the standard set of script utilities
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
source ${DIR}/.travis/base.sh

# ----

# Check that this is the main repository.
if [[ "${TRAVIS_REPO_SLUG}" != hyperledger* ]]; then
    _exit "Skipping deploy; wrong repository slug." 0
fi

## Start of release process

# Set the NPM access token we will use to publish.
npm config set registry https://registry.npmjs.org/
npm config set //registry.npmjs.org/:_authToken ${NPM_TOKEN}

# Set the GitHub deploy key we will use to publish.
set-up-ssh --key "$encrypted_573c42e37d8c_key" \
           --iv "$encrypted_573c42e37d8c_iv" \
           --path-encrypted-key ".travis/github_deploy_key.enc"

# Change from HTTPS to SSH.
./.travis/fix_github_https_repo.sh

# Test the GitHub deploy key.
git ls-remote

if [ "${BUILD_RELEASE}" = 'unstable' ]; then
    # Set the prerelease version.
    npm run pkgstamp
fi

# Which tag to use for npm and docker publish
if [ "${BUILD_FOCUS}" = 'latest' ]; then
    [ "${BUILD_RELEASE}" = 'stable' ] && NPM_TAG='latest' || NPM_TAG='unstable'
else
    [ "${BUILD_RELEASE}" = 'stable' ] && NPM_TAG='legacy' || NPM_TAG='legacy-unstable'
fi

# Hold onto the version number & package name
export VERSION=$(node -e "console.log(require('${DIR}/package.json').version)")
export PACKAGE_NAME=$(node -e "console.log(require('${DIR}/package.json').name)")

echo "Checking for existence of npm module ${m}"
if npm view ${PACKAGE_NAME}@${VERSION} | grep dist-tags > /dev/null 2>&1; then
    _exit "${PACKAGE_NAME}@${VERSION} already exists, skipping publish phase"
fi

echo "Publishing to npm with tag ${NPM_TAG}"
npm publish --tag="${NPM_TAG}" 2>&1

## Stable releases only: clean up git, and bump version number
if [[ "${BUILD_RELEASE}" = "stable" ]]; then
    [ "${BUILD_FOCUS}" = 'latest' ] && GIT_BRANCH='master' || GIT_BRANCH="${BUILD_FOCUS}.x"
    echo "Running version bump on Git branch: ${GIT_BRANCH}"

    # Configure the Git repository and clean any untracked and unignored build files.
    git config user.name "${GH_USER_NAME}"
    git config user.email "${GH_USER_EMAIL}"
    git checkout -b "${GIT_BRANCH}"
    git reset --hard
    git clean -d -f

    # Bump the version number.
    npm run pkgset
    export NEW_VERSION=$(node -e "console.log(require('${DIR}/package.json').version)")

    # Add the version number changes and push them to Git.
    git add .
    git commit -m "Automatic version bump to ${NEW_VERSION}"
    git push origin "${GIT_BRANCH}"

fi

_exit "All complete" 0
