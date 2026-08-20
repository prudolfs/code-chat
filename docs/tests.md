# Testing and Code Quality

## Purpose

This document defines the testing strategy and engineering conventions for the project.

The goal is not to maximize the number of tests. The goal is to build confidence in the application with fast feedback and a sensible balance between unit, integration, and end-to-end tests.

We follow the **testing pyramid**:

```text
                    /\
                   /  \
                  / E2E\
                 /------\
                /Integration\
               /------------\
              /     Unit     \
             /________________\
```

- **Unit tests** are the foundation: numerous, fast, and focused.
- **Integration tests** verify important parts working together.
- **End-to-end tests** cover a small number of critical user journeys.

The higher the test level, the fewer tests we should generally need.

---

# Test Stack

## Vitest

[Vitest](https://vitest.dev/) is the primary test runner and assertion framework.

It is used for:

- Unit tests
- Integration tests
- Test utilities and mocks

We use explicit imports from `vitest` and prefer `test` over `it` for consistency.

```ts
import { expect, test } from 'vitest'
```

## Testing Library

Testing Library is used for React unit and integration tests.

Tests should focus on observable user behavior rather than implementation details.

Prefer:

- querying by accessible role and name
- interacting with components as a user would
- asserting visible behavior

Avoid:

- testing private implementation details
- testing component state directly
- assertions unnecessarily tied to DOM structure
- tests that duplicate implementation logic

## Playwright

[Playwright](https://playwright.dev/) is used for end-to-end tests.

E2E tests cover critical workflows across the real application stack. They are intentionally fewer than unit and integration tests because they are slower and more expensive to maintain.

---

# Testing Pyramid

## Unit Tests

Unit tests are the largest layer.

Test deterministic behavior in isolation, especially:

- file filtering rules
- supported extensions
- ignored directories
- file validation
- path normalization
- chunking logic
- chunk metadata and line ranges
- project input validation
- GitHub URL parsing
- prompt/context construction
- utility functions
- pure domain logic

Tests should be colocated with the code they test when practical:

```text
src/
  lib/
    file-filter.ts
    file-filter.test.ts
```

### Test contracts, not implementation details

Prefer testing a module's public contract:

```text
input → module → expected output
```

A test should remain valid when the internal implementation changes but the module's behavior remains the same.

Do not unit test every private implementation detail.

---

## Integration Tests

Integration tests verify that multiple pieces work together.

Use Vitest with Testing Library where React/UI integration is involved.

Important integration areas include:

### Authentication

Test application behavior around:

- sign up with email and password
- sign in with email and password
- authenticated vs unauthenticated UI states
- sign out

OAuth providers should not require real external OAuth calls in the normal test suite. Provider boundaries can be mocked.

### Project Ingestion

Test important boundaries working together:

```text
project input
    ↓
filtering
    ↓
normalization
    ↓
chunking
    ↓
stored chunk representation
```

Cover both supported sources at the appropriate boundary:

- local project ingestion
- public GitHub repository ingestion

External network calls should normally be replaced with controlled test doubles.

### Chat Behavior

Test:

- creating a chat
- saving a user message
- loading chat history
- displaying assistant responses
- displaying retrieval sources
- recent chats in the sidebar

### Retrieval Workflow

Where practical, test the application workflow around:

```text
question
    ↓
query embedding boundary
    ↓
vector search boundary
    ↓
retrieved chunks
    ↓
context construction
```

Use deterministic fixtures instead of relying on real embedding or LLM responses.

---

## End-to-End Tests

Playwright covers a small set of critical user journeys.

### Authentication

```text
Open application
    ↓
Sign up or sign in
    ↓
Reach authenticated application
```

### Local Project Workflow

```text
Sign in
    ↓
Select a project folder
    ↓
Project is accepted for indexing
    ↓
Wait for ready state
    ↓
Create a new chat
    ↓
Ask a question
    ↓
Receive an answer with sources
```

The exact file-selection mechanics should use a controlled fixture project rather than arbitrary local files.

### GitHub Workflow

```text
Sign in
    ↓
Enter a public GitHub repository URL
    ↓
Import project
    ↓
Wait for indexing
    ↓
Ask a question
    ↓
Receive an answer
```

Use a stable test repository or mock the external GitHub boundary when running the normal automated suite.

### Chat Navigation

```text
Create chat
    ↓
Send messages
    ↓
Create another chat
    ↓
Return to previous chat
    ↓
Previous messages are preserved
```

We do not aim to test every edge case through the browser. E2E tests protect the highest-value user journeys.

---

# Testing AI-Dependent Code

AI output is not deterministic enough to make exact generated prose the main test contract.

We separate deterministic logic from external AI calls.

Test directly:

- file filtering
- chunking
- validation
- retrieval input construction
- context limits
- source metadata
- prompt construction rules
- handling of empty or failed retrieval
- response persistence

Mock or isolate:

- embedding provider calls
- LLM generation calls
- external GitHub requests

For integration tests, use deterministic fake responses where possible.

For example, test that the correct retrieved chunks are passed into context rather than asserting the exact wording produced by an LLM.

Production AI quality can later be evaluated with dedicated evaluation datasets and scenarios. This is outside the initial scope unless time permits.

---

# Test Data and Fixtures

Keep test fixtures small and intentional.

For code ingestion tests:

```text
fixtures/
  simple-react-project/
  project-with-ignored-files/
  project-with-generated-files/
  project-with-unsupported-files/
```

A fixture should demonstrate a specific behavior.

Avoid using a large real repository when a small fixture can express the same test case.

---

# Mocking Principles

Mock at system boundaries, not arbitrary internal implementation details.

Good candidates for mocks:

- GitHub API/archive download
- embedding provider
- LLM provider
- OAuth provider boundaries
- time when deterministic time is required

Prefer real implementations for internal business logic.

The goal is to verify our code, not to recreate our code with mocks.

---

# Code Quality

## TypeScript

### Prefer `type` over `interface`

Use `type` as the default TypeScript construct for describing shapes.

```ts
type Project = {
  id: string
  name: string
}
```

Use `interface` only when there is a specific reason that makes it more appropriate.

### Let TypeScript Infer When Possible

Do not add redundant type annotations when TypeScript can clearly infer the type.

Prefer explicit types at meaningful boundaries:

- public module APIs
- function inputs when inference is not sufficient
- important domain data
- external API boundaries

---

## Functions and Modules Over Classes

Prefer functions and modules over classes.

```text
module
├── parseGitHubUrl()
├── filterProjectFiles()
├── chunkFile()
└── validateProject()
```

Do not introduce classes simply to group related functions.

Classes and inheritance are not the default architectural pattern for this project.

---

## Prefer Deep Modules with Shallow Interfaces

Modules should hide complexity behind small, clear public interfaces.

Prefer:

```text
ingestion/
└── indexProject(input)
```

where the module internally handles validation, normalization, filtering, and orchestration.

Consumers should depend on what a module does, not how its internal implementation is organized.

A good module provides substantial functionality through a small interface.

---

## Prefer Function Declarations for Top-Level Functions

Use function declarations for top-level functions by default.

```ts
export function filterProjectFiles(files: FileInput[]) {
  // ...
}
```

Arrow functions remain appropriate for:

- callbacks
- small local functions
- cases where lexical `this` behavior is intentionally needed

The default for top-level reusable functions is:

```ts
function name() {}
```

rather than:

```ts
const name = () => {}
```

---

## Compose Behavior Instead of Building Inheritance Hierarchies

Prefer composition.

Build behavior by combining functions and modules:

```text
validate
  ↓
normalize
  ↓
filter
  ↓
chunk
  ↓
store
```

Avoid creating class hierarchies such as:

```text
BaseProjectImporter
  ├── LocalProjectImporter
  └── GitHubProjectImporter
```

unless a future requirement genuinely makes that abstraction necessary.

For the current application, composition is simpler and easier to test.

---

# Linting and Formatting

## Oxlint

Use `oxlint` for linting.

Run linting in local development and CI.

## Oxfmt

Use `oxfmt` for formatting.

The project follows **JavaScript Standard Style** conventions:

- no semicolons
- consistent spacing
- readable, conventional JavaScript/TypeScript formatting

Formatting should be automated rather than enforced manually during code review.

Developers and AI coding tools should run formatting before changes are considered complete.

---

# Development and CI Checks

The expected verification flow is:

```text
1. Type check
2. Lint
3. Format check
4. Unit and integration tests
5. E2E tests
```

A change should not be considered complete merely because it compiles.

The same checks should run consistently outside the developer's machine.

---

# What We Test vs What We Do Not

## Prioritize

- core business logic
- ingestion correctness
- filtering correctness
- chunking correctness
- important authentication behavior
- chat persistence
- critical retrieval workflow
- critical end-to-end user journeys

## Do Not Optimize For

- arbitrary coverage percentages
- snapshotting large component trees
- testing every private helper
- duplicating implementation logic inside tests
- exhaustive browser testing of every edge case

Coverage can be used as a signal, but not as the primary definition of quality.

A smaller suite of meaningful tests is more valuable than a large suite of brittle tests.

---

# Testing Philosophy

1. **Test behavior and contracts.**
2. **Keep most tests fast and close to the code.**
3. **Use integration tests for important boundaries.**
4. **Use E2E tests sparingly for critical user journeys.**
5. **Keep deterministic logic separate from AI and network boundaries.**
6. **Mock external systems, not the internal logic being tested.**
7. **Prefer maintainable tests over maximum coverage numbers.**
8. **Use composition and small module interfaces to make code easier to understand and test.**

The result should be a practical strategy appropriate for a small, well-engineered assignment: enough confidence to safely change the application without building an unnecessarily large test suite.
