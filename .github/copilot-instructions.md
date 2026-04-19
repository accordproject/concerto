# GitHub Copilot Instructions for Concerto

This repository is **Concerto** - a lightweight schema language and runtime for business concepts, maintained by the Accord Project under the Linux Foundation. Concerto provides object-oriented modeling capabilities with powerful serialization, validation, and code generation features.

## Project Architecture

### Tech Stack
- **Language**: JavaScript (ES6+) transitioning to TypeScript
- **Runtime**: Node.js 18+ with npm 10+
- **Build System**: npm workspaces with interdependent packages
- **Testing**: Mocha, Chai, Chai-as-promised, Sinon, Istanbul (99% coverage target)
- **Linting**: ESLint with strict configuration
- **Documentation**: JSDoc (required for all public APIs)
- **CI/CD**: GitHub Actions with multi-platform testing (Linux, Windows, macOS)

### Monorepo Structure
```
concerto/
├── packages/
│   ├── concerto-core/        # Core model management, parsing, validation, serialization
│   ├── concerto-util/         # Utility functions (independent from Concerto)
│   ├── concerto-cto/          # Parser for .cto syntax files
│   ├── concerto-vocabulary/   # Model vocabularies and localization
│   ├── concerto-analysis/     # Model comparison tools
│   ├── concerto-types/        # TypeScript type definitions
│   └── concerto-linter/       # Linting rules for Concerto models
└── scripts/                   # Build and maintenance scripts
```

### Package Dependencies
- **Build Order Critical**: Must run `npm run build` before `npm test` due to workspace interdependencies
- **Example**: `concerto-linter` depends on compiled `concerto-core`
- **Version Pinning**: All workspace packages use exact versions (enforced by `syncpack`)

---

## Critical Requirements

### 1. Developer Certificate of Origin (BLOCKING - ABSOLUTE)

**Every commit MUST include DCO sign-off. PRs cannot be merged without this.**

```bash
# Use one of these for EVERY commit:
git commit --signoff -m "feat(scope): description"
git commit -s -m "fix(scope): description"

# Configure alias for convenience:
git config alias.c 'commit --signoff'
```

**Format Added to Commit**:
```
Signed-off-by: Your Name <your.email@example.com>
```

**Why**: This is a Linux Foundation requirement for all contributions. Missing DCO sign-off will block PR merging.

---

### 2. Commit Message Format (STRICTLY ENFORCED)

**Required Format** (from [Accord Project conventions](https://github.com/accordproject/techdocs/blob/master/DEVELOPERS.md#commit-message-format)):

```
type(scope): description

[optional body explaining the WHY, not the what]

Signed-off-by: Your Name <your.email@example.com>
```

**Types** (from actual merged PRs):
- `feat`: New features (e.g., "feat(concerto-core): migrate package to typescript")
- `fix`: Bug fixes (e.g., "fix(concerto-util): restore legacy constructor argument order")
- `docs`: Documentation changes (e.g., "docs(concerto-analysis): fix incorrect npm install command")
- `chore`: Build/tooling (e.g., "chore(deps): add dependency linting and pin versions")
- `ci`: CI/CD workflows (e.g., "ci: upgrade outdated GitHub Actions in publish workflow")
- `test`: Test additions/modifications
- `refactor`: Code restructuring without behavior changes
- `style`: Formatting changes (whitespace, semicolons, etc.)

**Scopes**: Package name or area affected:
- Package names: `concerto-core`, `concerto-util`, `concerto-cto`, `concerto-vocabulary`, `concerto-analysis`, `concerto-linter`, `concerto-types`
- Areas: `deps`, `ci`, `docs`, `build`

**Key Principles**:
- ✅ Lowercase type and scope
- ✅ Imperative mood: "add feature" not "added feature"
- ✅ No period at end of subject line
- ✅ Explain WHY in body for non-obvious changes
- ❌ Never: "update readme", "fix stuff", "WIP"

**Examples from Merged PRs**:
```
✅ feat(concerto-core): migrate package to typescript
✅ fix(concerto-util): restore legacy constructor argument order
✅ docs(concerto-analysis): fix incorrect npm install command
✅ ci: upgrade outdated GitHub Actions in publish workflow
✅ chore(deps): add dependency linting and pin versions
❌ update readme (missing type, scope, DCO)
❌ Add new feature (missing scope, DCO, wrong case)
```

---

### 3. Testing Requirements (VITAL - 99% Coverage Target)

**Coverage Standards** (enforced in nyc configuration):
- Statements: 99%
- Branches: 97%
- Functions: 98%
- Lines: 99%

**Test Requirements by Change Type**:
- **New Features**: Must have comprehensive unit tests
- **Bug Fixes**: Must include regression tests demonstrating the fix
- **TypeScript Migrations**: Must maintain or improve existing coverage
- **Refactoring**: All existing tests must continue to pass

**Build-Then-Test Pattern (CRITICAL)**:
```bash
# ALWAYS build before testing in workspace repos:
npm run build    # Compile all packages
npm test         # Run all tests

# Or for specific package:
npm run build
npm test -w @accordproject/concerto-core
```

**Why**: Workspace packages depend on compiled versions of other packages. Tests will fail if dependencies aren't built first.

**Test Framework Patterns**:
```javascript
// Standard test structure
const chai = require('chai');
chai.should();
chai.use(require('chai-as-promised'));
chai.use(require('chai-things'));

describe('ClassName', () => {
    let sandbox;

    beforeEach(() => {
        sandbox = require('sinon').createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('#methodName', () => {
        it('should handle nominal case', () => {
            // Arrange
            const instance = new ClassName();
            
            // Act
            const result = instance.methodName();
            
            // Assert
            result.should.equal(expectedValue);
        });

        it('should throw when invalid input', () => {
            const instance = new ClassName();
            (() => {
                instance.methodName(null);
            }).should.throw(/expected error message/);
        });
    });
});
```

**Test File Organization**:
- Location: `test/` directory within each package
- Naming: Match source file names (e.g., `lib/introspect/modelmanager.js` → `test/introspect/modelmanager.js`)
- Coverage: Istanbul reports generated in `coverage/` (gitignored)

---

### 4. Cross-Platform Compatibility (ESSENTIAL)

**Critical Issue**: Windows build failures are common blockers. All scripts must work on Windows, macOS, and Linux.

#### Environment Variables
❌ **Never Use Platform-Specific Syntax**:
```bash
# WRONG - Windows only:
SET ENABLE_MAP_TYPE=true && npm test

# WRONG - Unix only:
export ENABLE_MAP_TYPE=true && npm test
```

✅ **Always Use `cross-env`**:
```bash
cross-env ENABLE_MAP_TYPE=true npm test
```

#### File Operations
❌ **Never Use Unix-Specific Commands**:
```bash
# WRONG - Unix only:
cp -R src/ dist/
rm -rf build/
```

✅ **Use Cross-Platform Alternatives**:
```bash
# Use 'cpx' for file copying:
cpx "src/**/*" dist/

# Use Node.js scripts or cross-platform tools
```

#### Path Handling
✅ **Use `path` module for all file paths**:
```javascript
// WRONG:
const file = 'src/models/person.cto';

// RIGHT:
const path = require('path');
const file = path.join('src', 'models', 'person.cto');
```

**Evidence**: Multiple PRs (#1120, #1105) specifically addressed Windows build failures with these exact fixes.

---

### 5. TypeScript Migration Patterns (v4.0.0 Initiative)

**Current State**: Incremental migration from JavaScript to TypeScript
- v3.x: JavaScript with JSDoc
- v4.x: Hybrid TypeScript (in progress)
- Future: Full TypeScript with strict mode

#### Migration Standards

**Package-by-Package Approach**:
- Migrate one package at a time
- Recent examples: `concerto-core`, `concerto-util`, `concerto-vocabulary`
- Maintain API compatibility during migration

**CommonJS Export Pattern** (Current Standard):
```typescript
// index.ts or index.js
export = {
    ModelManager,
    ClassDeclaration,
    // ... other exports
};
```

**Why**: Maintains backward compatibility with existing CommonJS consumers. ESM migration deferred to post-v4.

**Type Safety During Migration**:
```typescript
// Initial migration - document any types
function legacyMethod(data: any): any { // TODO: Type this properly
    return data.property;
}

// Follow-up improvement (maintainers will request):
interface DataType {
    property: string;
}
function legacyMethod(data: DataType): string {
    return data.property;
}
```

**Pattern**: Initial migration may use `any` types, but maintainers will push for stricter typing in follow-up reviews.

#### Circular Dependency Resolution

**Critical Pattern** (from PR #1105):

❌ **Causes Circular Dependency**:
```javascript
// Top of file
const Introspector = require('./introspector');

class ModelManager {
    validate() {
        const introspector = new Introspector(this);
    }
}
```

✅ **Lazy Loading Solution**:
```javascript
class ModelManager {
    validate() {
        // Move require() inside method
        const Introspector = require('./introspector');
        const introspector = new Introspector(this);
    }
}
```

✅ **Runtime Safety Check**:
```javascript
class Decorator {
    constructor() {
        // Delayed registration to avoid circular dependency
        if (typeof global.decoratorRegistered === 'undefined') {
            global.decoratorRegistered = true;
            // ... registration logic
        }
    }
}
```

---

## Code Style and Conventions

### ESLint Configuration (Strictly Enforced)

**Key Rules** (from `.eslintrc.yml`):
```yaml
indent: 4 spaces (error)
quotes: single quotes (error)
semi: always (error)
no-var: error (use const/let)
curly: error (always use braces)
eqeqeq: error (use === and !==)
strict: error (use strict mode)
no-trailing-spaces: error
require-jsdoc: error (all classes, methods, functions)
valid-jsdoc: error
```

### JSDoc Requirements (MANDATORY)

**All public APIs must have JSDoc comments**:

```javascript
/**
 * Validates a model file against the metamodel.
 * @param {string} modelFile - The model file content
 * @param {string} fileName - The filename for error reporting
 * @throws {IllegalModelException} If the model is invalid
 * @returns {ModelFile} The validated model file
 */
function validateModelFile(modelFile, fileName) {
    // implementation
}

/**
 * Represents a class declaration in a Concerto model.
 * @class
 * @memberof module:concerto-core
 */
class ClassDeclaration {
    /**
     * Create a ClassDeclaration.
     * @param {ModelFile} modelFile - The model file containing this class
     * @param {Object} ast - The AST node for this class
     */
    constructor(modelFile, ast) {
        // implementation
    }
}
```

**JSDoc Guidelines**:
- Use `@param {Type} name - description` for all parameters
- Use `@returns {Type} description` for return values
- Use `@throws {ExceptionType} description` for exceptions
- Use `@private` for internal methods (still require JSDoc)
- Use `@deprecated` when phasing out APIs

### Code Formatting

**Indentation**:
```javascript
// 4 spaces (not tabs)
function example() {
    if (condition) {
        doSomething();
    } else {
        doSomethingElse();
    }
}
```

**Braces**: Always required, even for single-line blocks
```javascript
// WRONG:
if (condition) doSomething();

// RIGHT:
if (condition) {
    doSomething();
}
```

**Quotes**: Single quotes for strings
```javascript
// WRONG:
const message = "Hello world";

// RIGHT:
const message = 'Hello world';
```

**Semicolons**: Always required
```javascript
// WRONG:
const value = getValue()

// RIGHT:
const value = getValue();
```

**Variable Declarations**:
```javascript
// WRONG:
var count = 0;

// RIGHT:
const count = 0; // Use const when not reassigned
let index = 0;   // Use let when reassigned
```

---

## PR Structure and Process

### Standard PR Template

**Required Sections** (from merged PRs):
```markdown
## Summary
[2-3 sentences explaining what this PR does and why]

## Changes
• Specific change 1
• Specific change 2
• Specific change 3

## Flags
[Any caveats, pre-existing issues, or testing notes]
[Note if tests fail on main branch (not introduced by this PR)]

## Screenshots or Video
[If applicable, otherwise N/A]

## Related Issues
• Closes #XXX
• Addresses #YYY

## Author Checklist
☑ DCO sign-off provided on all commits
☑ Vital features captured in unit tests (99% coverage target)
☑ Commits follow Accord Project format (type(scope): description)
☑ Documentation extended if necessary (JSDoc, README)
☑ Merging to `main` from `fork:branchname`
☑ Build passes (`npm run build && npm test`)
☑ ESLint passes (no warnings or errors)
```

### Quality Indicators (from Approved PRs)

**Strong PR Descriptions Include**:
- Clear problem statement
- Test coverage percentages ("99% coverage", "69 passing tests")
- Explicit list of changes
- Verification steps
- Screenshots/logs demonstrating fixes
- "Closes #XXX" syntax for automatic issue linking

**Example from Merged PR**:
```markdown
## Summary
Migrates `concerto-core` and `concerto-util` packages to TypeScript
while maintaining CommonJS compatibility for v4.0.0.

## Changes
• Converted 127 JavaScript files to TypeScript
• Resolved circular dependencies using lazy loading pattern
• Added explicit type definitions for public APIs
• Updated build scripts to compile TypeScript before tests
• Maintained 99% test coverage (1,234 passing tests)

## Flags
• Initial migration uses `any` types in some legacy areas (documented with TODOs)
• Follow-up PR planned for stricter type definitions

## Test Coverage
• Statements: 99.12%
• Branches: 97.43%
• Functions: 98.87%
• Lines: 99.15%

## Related Issues
• Closes #1234 - TypeScript migration for core packages
```

---

## Code Review Expectations

### For Contributors

**BEFORE Submitting PR**:
1. ✅ Run `npm run build && npm test` locally - all tests must pass
2. ✅ Run `npm run licchk` - license headers required
3. ✅ Verify DCO sign-off on ALL commits
4. ✅ Check commit message format (type(scope): description)
5. ✅ Verify cross-platform compatibility (test on Windows if possible)
6. ✅ Confirm test coverage meets 99% target
7. ✅ Review own code for whitespace changes (avoid unintentional changes)

**During Review**:
- Respond promptly to feedback (maintainers expect "quick turnaround")
- Address all comments before requesting re-review
- If requested, apply similar fixes to other branches (e.g., v4.0.0 branch)
- Update PR description if scope changes

### For Reviewers

**Mandatory Checks**:
1. ✅ DCO sign-off present on all commits
2. ✅ Commit messages follow `type(scope): description` format
3. ✅ Tests added for new features/bug fixes
4. ✅ Test coverage meets nyc thresholds (99%/97%/98%/99%)
5. ✅ CI passes on all platforms (Linux, Windows, macOS)
6. ✅ No unintentional whitespace changes
7. ✅ JSDoc present for all public APIs
8. ✅ Breaking changes explicitly documented

**Common Review Feedback** (from actual PRs):
- "In future please don't make whitespace changes, it slows down the review"
- "Could you enhance the type definitions here? Initial `any` is fine but let's improve it"
- "Could you do a similar scan of the `v4.0.0` branch too?"
- "Are you ok with loosely typed functions e.g. lots of any types?" (answer: document with TODO for follow-up)
- "Thanks for the quick turnaround!" (positive reinforcement for responsiveness)

### Breaking Changes

**Must Preserve API Compatibility When Possible**:
- Example: PR #1107 left method name `reportNotResouceViolation` (typo) unchanged to avoid breaking API
- Document breaking changes explicitly in PR description
- Justify why breaking change is necessary
- Consider deprecation path for major API changes

---

## CI/CD and GitHub Actions

### GitHub Actions Best Practices

**Action Versioning** (from multiple PRs):
```yaml
# WRONG - unstable reference:
- uses: actions/checkout@master

# RIGHT - pinned to major version:
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
- uses: peter-evans/create-pull-request@v7
```

**Node.js Setup with Caching**:
```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'  # Speeds up builds significantly
```

**Concurrency Control** (prevents wasted CI resources):
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

### Workflow Structure

**Standard Workflow Pattern**:
1. Checkout code
2. Setup Node.js with npm caching
3. Install dependencies (`npm ci`)
4. Build all packages (`npm run build`)
5. Run license check (`npm run licchk`)
6. Run tests (`npm test`)
7. Upload coverage to Coveralls

**Multi-Platform Testing**:
```yaml
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest, macos-latest]
    node-version: [18, 20]
```

---

## Dependency Management

### Strict Version Pinning (ENFORCED)

**Why**: Supply chain attack prevention (PR #1081)

**Tools**:
- `syncpack`: Enforces exact versions across workspace (no `^` or `~`)
- `lockfile-lint`: Prevents lockfile injection attacks

**Scripts**:
```bash
# Check for version mismatches:
npm run lint:deps

# Fix version mismatches:
npm run lint:deps:fix

# Validate lockfile integrity:
npm run lint:lockfile
```

**Configuration** (`package.json`):
```json
{
  "scripts": {
    "lint:deps": "syncpack lint",
    "lint:deps:fix": "syncpack fix",
    "lint:lockfile": "lockfile-lint --path package-lock.json --type npm --allowed-hosts npm --validate-https",
    "preinstall": "npm run lint:lockfile && npm run lint:deps"
  }
}
```

**In Package Files**:
```json
// WRONG - uses version ranges:
{
  "dependencies": {
    "debug": "^4.3.0",
    "semver": "~7.6.0"
  }
}

// RIGHT - exact versions:
{
  "dependencies": {
    "debug": "4.3.7",
    "semver": "7.6.3"
  }
}
```

**Workspace Dependencies**:
```json
// All workspace packages use exact versions:
{
  "dependencies": {
    "@accordproject/concerto-cto": "3.25.0",  // Not ^3.25.0
    "@accordproject/concerto-util": "3.25.0"
  }
}
```

---

## Concerto-Specific Patterns

### Model Files (.cto)

**Concerto Syntax**:
```concerto
namespace org.example

/**
 * Represents a person in the system.
 */
@description("A person with identifying information")
concept Person identified by email {
  o String email
  o String firstName
  o String lastName optional
  o DateTime dateOfBirth
  o Address address optional
  @description("Height in centimeters")
  o Double height range=[0,] default=170.0
}

concept Address {
  o String street
  o String city
  o String country
}
```

**Key Concepts**:
- `namespace`: Required declaration at top of file
- `concept`: Class-like structure for data
- `o`: Property declaration (object property)
- `-->`: Reference to another concept
- `identified by`: Primary key field
- `optional`: Field can be null/undefined
- `range`: Numeric constraints
- `default`: Default value
- `@decorator`: Metadata annotations

### ModelManager Usage

**Core API Pattern**:
```javascript
const { ModelManager, Concerto } = require('@accordproject/concerto-core');

// Create model manager
const modelManager = new ModelManager();

// Add model file
const modelFile = `
namespace org.example
concept Person {
    o String name
}
`;
modelManager.addCTOModel(modelFile, 'person.cto');

// Validate against models
const concerto = new Concerto(modelManager);
const obj = {
    $class: 'org.example.Person',
    name: 'Alice'
};
const validatedObject = concerto.validate(obj);
```

### Error Handling Patterns

**Custom Exception Hierarchy**:
```javascript
const { BaseException } = require('@accordproject/concerto-core');

// Throwing exceptions
if (!namespace) {
    throw new IllegalModelException('Model must declare a namespace');
}

// Catching specific exceptions
try {
    modelManager.validateModelFile(content);
} catch (error) {
    if (error instanceof IllegalModelException) {
        // Handle model errors
    } else {
        throw error; // Re-throw unknown errors
    }
}
```

**Exception Types**:
- `IllegalModelException`: Invalid model syntax/structure
- `ValidationException`: Instance doesn't match model
- `TypeNotFoundException`: Referenced type not found
- `ParseException`: CTO parsing failure

---

## Common Pitfalls and Anti-Patterns

### Build Issues

❌ **Wrong: Platform-specific commands**
```json
{
  "scripts": {
    "test": "SET DEBUG=true && mocha"  // Windows only
  }
}
```

✅ **Right: Cross-platform tools**
```json
{
  "scripts": {
    "test": "cross-env DEBUG=true mocha"
  }
}
```

### Testing Issues

❌ **Wrong: Test without building first**
```bash
npm test  # Will fail if workspace deps not built
```

✅ **Right: Build before testing**
```bash
npm run build && npm test
```

### Import/Export Issues

❌ **Wrong: Circular dependencies at module level**
```javascript
// modelmanager.js
const Introspector = require('./introspector');

// introspector.js
const ModelManager = require('./modelmanager');
```

✅ **Right: Lazy loading in methods**
```javascript
// modelmanager.js
class ModelManager {
    introspect() {
        const Introspector = require('./introspector');
        return new Introspector(this);
    }
}
```

### Type Safety (TypeScript Migration)

❌ **Wrong: Silent any types**
```typescript
function process(data: any): any {
    return data.someProperty;
}
```

✅ **Right: Document temporary any types**
```typescript
// TODO: Type this properly once Data interface is defined
function process(data: any): any {
    return data.someProperty;
}
```

✅ **Best: Use proper types**
```typescript
interface Data {
    someProperty: string;
}
function process(data: Data): string {
    return data.someProperty;
}
```

### Whitespace Changes

❌ **Wrong: Reformatting unrelated code**
```diff
  function oldFunction() {
-    return value;
+     return value;  // Unintentional spacing change
  }
```

**Reviewer Feedback**: "In future please don't make whitespace changes, it slows down the review"

✅ **Right: Only change what's necessary**
- Use `.editorconfig` to match project style
- Avoid bulk reformatting in feature PRs
- If reformatting needed, do it in separate PR

---

## Documentation Standards

### README Files

**Required Sections**:
- Brief description of package purpose
- Installation instructions
- Basic usage examples
- Link to full documentation
- License information
- Accord Project branding

**Example Structure**:
```markdown
# @accordproject/concerto-core

Core library for Concerto model management, parsing, validation, and serialization.

## Installation

```bash
npm install @accordproject/concerto-core
```

## Usage

```javascript
const { ModelManager } = require('@accordproject/concerto-core');
const modelManager = new ModelManager();
// ...
```

## Documentation

Full documentation: https://docs.accordproject.org/

## License

Apache-2.0 - See LICENSE file

---

<p align="center">
  <a href="https://www.accordproject.org/">
    <img src="assets/APLogo.png" alt="Accord Project Logo" width="400" />
  </a>
</p>
```

### API Documentation (JSDoc)

**Documentation Generation**:
```bash
# Generate API docs:
npm run jsdoc

# Output: out/docs/
```

**JSDoc Configuration** (`jsdoc.json` in each package):
- Generator: `better-docs`
- Include: `lib/**/*.js` or `src/**/*.ts`
- Exclude: Private implementation files

### Changelog

**Maintained Automatically**:
- Conventional commits enable automatic changelog generation
- Each package has `changelog.txt`
- Updated during release process

---

## Performance Considerations

### Model Loading

**Lazy Loading Models**:
```javascript
// WRONG - load all models upfront:
const modelManager = new ModelManager();
allModels.forEach(m => modelManager.addCTOModel(m));

// RIGHT - load models on demand:
class ModelCache {
    getModel(namespace) {
        if (!this.cache[namespace]) {
            this.cache[namespace] = loadFromFile(namespace);
        }
        return this.cache[namespace];
    }
}
```

### Validation Caching

**Cache Expensive Operations**:
```javascript
class ModelFile {
    constructor() {
        this._validationCache = null;
    }

    validate() {
        if (!this._validationCache) {
            this._validationCache = this._performValidation();
        }
        return this._validationCache;
    }

    clearCache() {
        this._validationCache = null;
    }
}
```

---

## Security Considerations

### Model Validation

**Always Validate Untrusted Input**:
```javascript
// User-provided model file
const userModel = req.body.modelContent;

try {
    // Validate before using
    modelManager.addCTOModel(userModel, 'user.cto', true); // true = enable validation
} catch (error) {
    return res.status(400).json({
        error: 'Invalid model',
        details: error.message
    });
}
```

### Dependency Security

**Lockfile Validation** (enforced):
```bash
# Validates package-lock.json:
npm run lint:lockfile

# Checks for:
# - HTTPS URLs only
# - Allowed hosts (npm registry)
# - No injected dependencies
```

**Supply Chain Protection**:
- Exact version pinning (via `syncpack`)
- Lockfile integrity checks (via `lockfile-lint`)
- Regular dependency audits (`npm audit`)

---

## Learning Resources

### Official Documentation
- [Concerto Language Specification](https://docs.accordproject.org/docs/model-concerto.html)
- [Concerto API Documentation](https://docs.accordproject.org/docs/model-api.html)
- [Accord Project Developer Guide](https://github.com/accordproject/techdocs/blob/master/DEVELOPERS.md)
- [Model Repository](https://models.accordproject.org)

### Community
- [Discord Community](https://discord.com/invite/Zm99SKhhtA)
- [Accord Project Website](https://accordproject.org/)
- [Accord Project Blog](https://medium.com/@accordhq)

### Tools
- [VSCode Extension](https://marketplace.visualstudio.com/items?itemName=accordproject.cicero-vscode-extension)
- [Concerto CLI](https://www.npmjs.com/package/@accordproject/concerto-cli)

---

## Summary Checklist for Contributors

Before submitting a PR, verify:

**Mandatory (Will Block Merge)**:
- [ ] DCO sign-off on ALL commits (`git commit --signoff`)
- [ ] Commit messages follow format: `type(scope): description`
- [ ] All tests pass (`npm run build && npm test`)
- [ ] Test coverage meets 99% target (check nyc output)
- [ ] CI passes on all platforms (Linux, Windows, macOS)
- [ ] License headers present (`npm run licchk`)

**Quality (Expected in Review)**:
- [ ] JSDoc on all public APIs
- [ ] Unit tests for new features/bug fixes
- [ ] Cross-platform compatibility verified
- [ ] No unintentional whitespace changes
- [ ] API compatibility preserved (or breaking changes documented)
- [ ] PR description includes summary, changes, test coverage

**TypeScript-Specific (if applicable)**:
- [ ] CommonJS export format maintained (`export = { ... }`)
- [ ] Circular dependencies resolved (lazy loading)
- [ ] `any` types documented with TODO comments
- [ ] Type definitions exported for external consumers

**Documentation (if applicable)**:
- [ ] README updated for new features
- [ ] JSDoc added/updated for API changes
- [ ] Examples updated if behavior changed

---

## Quick Reference: Common Commands

```bash
# Setup
git clone https://github.com/<YOUR_USERNAME>/concerto.git
cd concerto
git remote add upstream https://github.com/accordproject/concerto.git
npm install

# Development
npm run build          # Build all packages
npm test               # Run all tests
npm test -w @accordproject/concerto-core  # Test specific package

# Code Quality
npm run licchk         # Check license headers
npm run lint:deps      # Check dependency versions
npm run lint:lockfile  # Validate lockfile

# Git Workflow
git checkout main
git pull upstream main
git checkout -b feat-my-feature
# ... make changes ...
git commit --signoff -m "feat(concerto-core): add new feature"
git push origin feat-my-feature
# ... create PR on GitHub ...

# Updating PR
git checkout feat-my-feature
git pull upstream main  # Get latest changes
git push origin feat-my-feature
```

---

## Appendix: Analysis Methodology

These instructions were generated by analyzing:
- 12+ recently merged PRs (#1132, #1124, #1120, #1107, #1113, #1100, #1101, #1105, #1089, #1091, #1081, #1077)
- Repository documentation (CONTRIBUTING.md, DEVELOPERS.md, coding-guidelines.md)
- ESLint configurations and package.json settings
- Actual review comments and maintainer feedback
- Build and CI/CD workflow patterns

**Key Patterns Identified**:
- DCO sign-off is absolute requirement (mentioned in every PR)
- 99% test coverage consistently achieved
- Cross-platform Windows issues are recurring theme
- TypeScript migration is major focus for v4.0.0
- Conventional commits strictly enforced
- Supply chain security prioritized with tooling

---

**Remember**: When GitHub Copilot suggests code, always verify:
1. DCO sign-off will be added to commits
2. Commit message will follow conventional format
3. Tests will be written for new functionality
4. Cross-platform compatibility is maintained
5. JSDoc is present for public APIs

GitHub Copilot is a powerful tool, but human review of these critical requirements remains essential for the Accord Project Concerto repository.
