# MVP PRD: Code Documentation Assistant

## 1. Summary

Build a full-stack Code Documentation Assistant that lets an authenticated user import a codebase, index useful source and documentation files, and ask grounded questions through a ChatGPT-style interface.

The MVP is a focused RAG application, not an autonomous coding agent. It should prove the core loop:

```text
authenticate -> import project -> index files -> ask question -> receive cited answer
```

## 2. Product Goal

Help a developer quickly understand an unfamiliar codebase by asking natural-language questions and receiving answers grounded in indexed source files, with file paths and line ranges shown as sources.

## 3. MVP Scope

### In Scope

- Email/password authentication.
- Google and GitHub authentication.
- Authenticated project ownership.
- Import from a local project folder.
- Import from a public GitHub repository URL.
- Browser folder picker for local imports.
- Client-side temporary ZIP packaging for filtered local imports.
- Shared ingestion pipeline for local and GitHub sources.
- Client-side file filtering for local imports.
- Server-side filtering, validation, normalization, chunking, and embedding.
- Convex persistence for projects, files, chunks, chats, and messages.
- Convex vector search over stored chunk embeddings.
- Vercel AI SDK through AI Gateway with configurable model IDs.
- Chat interface scoped to one selected project.
- Multiple projects per user.
- Multiple chats per project.
- Each chat belongs to exactly one project.
- Recent chats sidebar.
- Assistant answers with source citations.
- Project indexing status and error state.
- Indexing progress for files processed and chunks embedded.
- Deterministic unit/integration tests around ingestion, retrieval, and chat persistence.
- A small Playwright suite for the critical user journeys.

### Out of Scope

- Private GitHub repositories.
- GitHub OAuth repository access.
- Continuous repository sync or re-indexing.
- Webhooks.
- Public REST API.
- ZIP upload as a direct user-facing option.
- Multi-user collaborative workspaces.
- Chat sharing.
- Chat folders.
- Chat search.
- Convex paginated chat history queries with TanStack infinite scroll.
- Citations for responses that are not based on retrieved code.
- Autonomous code editing.
- Tool-calling agents that repeatedly inspect files.
- Token-by-token response streaming.
- Permanent storage of uploaded repository archives.
- Exhaustive AI quality evaluation datasets.

## 4. Primary Users

- Developers onboarding to a new codebase.
- Reviewers trying to understand architecture and behavior quickly.
- Builders using the app as a demo of a small, well-engineered RAG system.

## 5. Core User Journeys

### 5.1 Sign In

1. User opens the application.
2. User signs up or signs in.
3. User reaches the authenticated app shell.
4. User can sign out.

Acceptance criteria:

- Unauthenticated users cannot access projects, chats, or messages.
- Authenticated users only see their own data.
- Email/password, Google, and GitHub auth work in the MVP.

### 5.2 Import Local Project

1. User selects a local folder in the browser.
2. Client filters obvious noise such as `node_modules`, `.git`, build output, coverage, binaries, and media.
3. If the selected project appears to duplicate an existing project, the UI asks whether to create a duplicate project or replace/re-index the existing project.
4. Client packages remaining supported files into a temporary archive.
5. Backend validates and filters again.
6. Backend chunks and embeds accepted files.
7. Project status changes from `pending` to `indexing` to `ready`, `ready_with_warnings`, or `error`.

Acceptance criteria:

- Unsupported files are skipped.
- Generated/dependency directories are skipped.
- Unsupported/skipped files are ignored silently in the MVP UI.
- Server-side limits are enforced even if client filtering fails.
- User sees indexing status.
- User sees indexing progress, including files processed and chunks embedded when available.
- Duplicate imports ask the user to create a duplicate project or replace/re-index the existing project.
- If indexing partially succeeds, the UI shows a popup with a generic warning message, the failed file list, and actions to delete the project or proceed with warnings.
- Temporary archives are not persisted as product data.

### 5.3 Import Public GitHub Repository

1. User enters a public GitHub repository URL.
2. Backend validates the URL.
3. If the URL duplicates an existing project, the UI asks whether to create a duplicate project or replace/re-index the existing project.
4. Backend downloads the repository archive.
5. Backend runs the same extraction, filtering, chunking, embedding, and persistence pipeline as local imports.
6. User can chat once indexing is ready.

Acceptance criteria:

- Invalid or unsupported GitHub URLs are rejected with a useful error.
- Private repository access is not attempted.
- GitHub ZIP archives are temporary transport artifacts only.
- The same server-side ingestion rules apply as local import.
- Duplicate GitHub URLs ask the user to create a duplicate project or replace/re-index the existing project.

### 5.4 Ask About Code

1. User opens or creates a chat for a ready project.
2. User asks a question.
3. Backend saves the user message.
4. Backend embeds the question.
5. Backend retrieves top relevant chunks from Convex vector search.
6. Backend builds a bounded prompt from the question, relevant conversation context, and retrieved chunks.
7. Backend calls the LLM through the Vercel AI SDK.
8. Backend saves the assistant response and source metadata.
9. UI updates reactively.

Acceptance criteria:

- Empty questions are blocked.
- Chat generation requires a ready project.
- The full repository is never sent to the LLM.
- Unlimited chat history is never sent to the LLM.
- Answers show source file paths and line ranges when retrieval succeeds.
- MVP line ranges can be chunk-level approximate ranges.
- If retrieval is empty or too weak, the assistant says it does not have enough indexed context.
- Provider failures are retried up to 3 total attempts, then produce a visible error state.
- Retrieval and indexing failures produce visible error states.

### 5.5 Navigate Chats

1. User creates a chat.
2. User sends messages.
3. User creates another chat.
4. User returns to the previous chat.
5. Previous messages and sources are preserved.

Acceptance criteria:

- Chats belong to a project.
- Each chat is scoped to exactly one project.
- A project can have multiple chats.
- Recent chats update after new messages.
- User cannot access another user's chats.

### 5.6 Delete Project

1. User chooses to delete a project.
2. UI shows a confirmation warning that deleting the project also deletes related chats and messages.
3. User confirms deletion.
4. Backend queries all data related to the project and deletes related chats, messages, files, chunks, and the project record.
5. UI returns to the no-project or remaining-project state.

Acceptance criteria:

- Project deletion is required in MVP for storage and cost control.
- Deletion requires explicit confirmation.
- Confirmation warns that related chats and messages will also be deleted.
- Deletion is scoped to the authenticated owner.
- Related project chats and messages are deleted with the project.
- Related files and chunks are deleted with the project.

## 6. Data Model

### `projects`

- `userId`
- `name`
- `sourceType`: `local | github`
- `sourceUrl`
- `status`: `pending | indexing | ready | ready_with_warnings | error`
- `errorMessage`
- `warnings`
- `failedFiles`
- `sourceFingerprint`
- `progress`
- `createdAt`
- `updatedAt`

### `files`

- `projectId`
- `path`
- `extension`
- `size`
- `createdAt`

### `chunks`

- `projectId`
- `fileId`
- `path`
- `content`
- `startLine`
- `endLine`
- `embedding`
- `createdAt`

### `chats`

- `userId`
- `projectId`
- `title`
- `createdAt`
- `updatedAt`

### `messages`

- `chatId`
- `role`: `user | assistant | system`
- `content`
- `sources`
- `error`
- `createdAt`

## 7. Functional Requirements

### Authentication

- The app must support authenticated sessions through Better Auth and Convex.
- The app must support email/password, Google, and GitHub sign-in.
- All Convex queries and mutations must enforce user ownership.
- Email verification is not required for demo email/password accounts.
- A user can own multiple projects.

### Project Import

- The app must support local folder import.
- Local folder import must use the real browser folder picker.
- Local folder import must package accepted files into a temporary ZIP before ingestion handoff.
- The app must support public GitHub URL import.
- Both import paths must converge on one ingestion pipeline after archive/file acquisition.
- The backend must enforce file limits, supported extensions, ignored directories, and binary/generated-file detection.
- Backend ingestion limits must be centralized in project configuration and overridable through environment variables for development/deployment tuning.
- Supported file extensions must be centralized in project configuration and overridable through environment variables.
- Retrieval limits must be centralized in project configuration and overridable through environment variables.
- Chat and embedding model IDs must be centralized in project configuration and overridable through environment variables.
- Project status must be visible in the UI.
- Indexing progress must be visible in the UI, including files processed and chunks embedded when available.
- Duplicate imports must prompt the user to create a duplicate project or replace/re-index the existing project.
- Replacing a project must remove the previous files and chunks before storing the new index.
- Partial indexing failures must produce `ready_with_warnings` when at least one file and one chunk were indexed.
- `ready_with_warnings` must show a generic warning message, failed file list, and choices to delete the project or proceed with warnings.

### Ingestion

- The ingestion pipeline must normalize paths.
- The ingestion pipeline must chunk useful text/source files deterministically.
- Each chunk must retain file path and line range metadata.
- Chunk-level approximate line ranges are acceptable for MVP citations.
- Embeddings must be generated once during ingestion and stored in Convex.
- Temporary archives must be deleted after ingestion succeeds or fails.

### Retrieval and Chat

- Sending a message must persist the user message before answer generation.
- Each chat must belong to exactly one project.
- Each project can have multiple chats.
- Answer generation must run in a Convex internal action.
- Retrieval must use a question embedding and Convex vector search.
- Prompt construction must enforce top-K and context-size limits.
- Prompt construction must include only a bounded set of recent chat messages for MVP.
- Assistant responses must persist source metadata.
- The chat UI must show pending, success, and failure states.
- Assistant responses are non-streaming in MVP.
- AI provider calls must retry up to 3 total attempts before failing the assistant response.
- The default model choices should optimize for low-cost coding help during development while allowing easy upgrades.

### Source Citations

- Assistant answers must show retrieved source files.
- Source metadata must include path, start line, and end line.
- If retrieval fails or no relevant chunks are found, the assistant should say it lacks enough indexed context.
- Weak retrieval results must not produce speculative answers.

## 8. Non-Functional Requirements

- Keep implementation small and assignment-focused.
- Prefer Convex queries/mutations for normal app data access.
- Use Convex internal actions for GitHub, embeddings, LLM calls, and orchestration.
- Keep AI provider credentials server-side.
- Use Vercel AI Gateway model IDs through configuration so chat and embedding models can be changed without code changes.
- Use deterministic logic for filtering, validation, chunking, and prompt construction.
- Use mocks or test doubles for GitHub, embedding, OAuth, and LLM boundaries in normal tests.
- Use TypeScript, functions/modules over classes, and project formatting/linting conventions.

## 9. Requirement Grilling

These are the questions that should force MVP decisions before implementation drifts:

1. What is the smallest repository size we promise to support without the demo failing?
2. What exact max file count, max individual file size, and max total extracted size will the backend enforce?
3. Which source extensions are truly supported in MVP, and which are silently ignored?
4. Should unsupported files be reported to users, or only skipped internally?
5. What happens if a project partially indexes: fail the whole project or mark ready with warnings?
6. Do we need project deletion in MVP to control storage and cost?
7. Can a user import multiple projects, or is the first app version limited to one active project per user?
8. What is the expected answer when retrieval returns weak or irrelevant chunks?
9. How many chunks are retrieved, and what is the maximum prompt context size?
10. Which embedding model and chat model are used, and what are the demo cost limits?
11. How do we prevent duplicate ingestion if the user imports the same GitHub URL or local folder twice?
12. Are OAuth providers required for the assignment, or is email/password enough for the first pass?
13. What does "local folder import" mean in browser reality: folder picker plus client ZIP, or a simpler fixture-backed path for demo?
14. Is the app expected to stream assistant responses, or is save-then-render acceptable for MVP?
15. Does every answer require citations, or only answers based on retrieved code?
16. What is the fallback if the AI provider is unavailable during the demo?
17. How much chat history is included in prompts, and how is it trimmed?
18. Are source line ranges derived before or after chunk overlap, and how are overlaps displayed?
19. What exact states does the UI show during `pending`, `indexing`, `ready`, and `error`?
20. What single E2E path must never break before the project is considered shippable?

MVP decisions:

- The MVP scope is everything described in `docs/architecture.md`, including local folder import, public GitHub import, authenticated ownership, ingestion, embeddings, vector retrieval, chat, and cited answers.
- Local folder import must include the real browser folder picker, client-side filtering, temporary ZIP packaging, upload, and server-side validation described in `docs/architecture.md`.
- Ingestion limits are project configuration with environment-variable overrides, not scattered hardcoded values.
- Supported file extensions are project configuration with environment-variable overrides.
- Retrieval limits are project configuration with environment-variable overrides.
- Chat and embedding models are project configuration with environment-variable overrides.
- Default supported extensions include web/source docs plus popular Python project files: `.ts`, `.tsx`, `.js`, `.jsx`, `.json`, `.md`, `.mdx`, `.css`, `.html`, `.yml`, `.yaml`, `.py`, `.pyi`, `.toml`, `.ini`, `.cfg`, `.txt`, `.rst`.
- Default development limits should be conservative for Convex Free/Starter: 500 accepted files per project, 512 KiB max per accepted file, 20 MiB max total accepted text, and 1000 chunks per project.
- Default retrieval limits should be top 8 chunks, 24,000 max retrieved-context characters, 50 recent chat messages, and a 0.35 minimum relevance score when the provider/vector API exposes a comparable score.
- Default chat model should be `alibaba/qwen3.7-flash` for cheap development, with `minimax/minimax-m3` and `moonshotai/kimi-k2.5` documented as configurable coding-oriented alternatives.
- Default embedding model should be `openai/text-embedding-3-small` with 1536-dimensional vectors for a practical cost/quality/storage balance.
- Unsupported and skipped files are ignored silently in the UI; only project-level blocking failures are shown.
- Support multiple projects per user and multiple chats per project.
- One chat is always about exactly one project.
- Require project deletion in MVP for storage and cost control.
- Project deletion must warn that related chats and messages will also be deleted, then query and delete related chats, messages, files, and chunks.
- Duplicate imports ask whether to create a duplicate project or replace/re-index the existing project.
- Replacing/re-indexing keeps the project record but replaces its files, chunks, embeddings, status, warnings, and failed file list.
- Indexing UI shows progress, including files processed and chunks embedded when available.
- Treat partial ingestion as `ready_with_warnings` if at least one file and one chunk were indexed; otherwise mark `error`.
- For `ready_with_warnings`, show a popup with a generic warning, the failed file list, and actions to delete the project or proceed with warnings.
- If retrieval is empty or below the relevance threshold, the assistant responds with "I don't have enough indexed context" rather than guessing.
- AI provider calls retry up to 3 total attempts, then stop and show a visible assistant error.
- For MVP prompt context, query a reasonable bounded set of recent chat messages from Convex, defaulting to 50 recent messages.
- Chunk-level approximate line ranges are acceptable for MVP.
- Convex paginated queries and TanStack infinite scroll for full chat history are future implementation work.
- The required shippable E2E path logs in with a configurable user, uploads a small predefined project, asks a couple of questions, and verifies answers are returned.
- Add a separate README GIF generator script, outside the E2E test suite, that captures four screenshots: login screen, then three authenticated project screenshots using another predefined user and predefined projects. It creates `readme.gif` in the project root, exits, and clears temporary PNG screenshots from `.temp`.
- Use non-streaming assistant responses for MVP.
- Token-by-token response streaming is a future implementation.
- Always show citations when retrieved chunks are used.
- For MVP, citations are required only for responses based on retrieved code.
- Broader citation behavior for non-retrieval responses is a future feature.
- Google and GitHub OAuth are required for MVP because they are part of `docs/architecture.md`.

## 10. Testing Requirements

### Unit Tests

- File filtering rules.
- Supported extension detection.
- Ignored directory detection.
- File validation limits.
- Path normalization.
- Chunking behavior.
- Chunk metadata and line ranges.
- GitHub URL parsing.
- Project input validation.
- Prompt/context construction.
- Source metadata formatting.

### Integration Tests

- Authenticated and unauthenticated UI states.
- Local ingestion boundary with fixtures.
- GitHub ingestion boundary with mocked download.
- Chat creation and message persistence.
- Retrieval flow with fake embeddings and fake vector results.
- Assistant response persistence with fake LLM output.

### E2E Tests

- Sign up or sign in and reach the authenticated app.
- Import a controlled local fixture project, wait for ready, ask a question, see an answer with sources.
- Import a controlled public GitHub test repository or mocked boundary, ask a question, see an answer.
- Create two chats and verify previous messages are preserved.
- Shippable happy path: log in with a configurable test user, upload a small predefined project, ask a couple of questions, and receive answers.

### README GIF Script

- Provide a standalone script outside the E2E test suite.
- Capture four screenshots from the app flow.
- First screenshot is the login screen.
- Script logs in with a predefined GIF user.
- Script selects predefined projects and captures three authenticated project screenshots.
- Script builds `readme.gif` in the project root.
- Script removes temporary screenshot PNGs from `.temp` before exiting.

## 11. Implementation Plan

### Phase 1: Foundation

- [x] Add project configuration for ingestion and retrieval limits with environment-variable overrides.
- [x] Set default ingestion limits to 500 accepted files, 512 KiB per accepted file, 20 MiB total accepted text, and 1000 chunks per project.
- [x] Add project configuration for supported file extensions with environment-variable overrides.
- [x] Set default supported extensions to `.ts`, `.tsx`, `.js`, `.jsx`, `.json`, `.md`, `.mdx`, `.css`, `.html`, `.yml`, `.yaml`, `.py`, `.pyi`, `.toml`, `.ini`, `.cfg`, `.txt`, `.rst`.
- [x] Set default retrieval limits to top 8 chunks, 24,000 max retrieved-context characters, 50 recent chat messages, and 0.35 minimum relevance score where available.
- [x] Add project configuration for `AI_GATEWAY_CHAT_MODEL`, `AI_GATEWAY_EMBEDDING_MODEL`, optional fallback chat models, and embedding dimensions.
- [x] Set default chat model to `alibaba/qwen3.7-flash`.
- [x] Document `minimax/minimax-m3` and `moonshotai/kimi-k2.5` as configurable alternatives for better coding quality.
- [x] Set default embedding model to `openai/text-embedding-3-small` with 1536 dimensions.
- [x] Configure required auth providers: email/password, Google, and GitHub.
- [x] Configure Convex, TanStack Start, Tailwind, shadcn/ui, Better Auth, and Vercel AI SDK environment variables.
- [x] Define shared constants for supported extensions, ignored directories, file limits, and retrieval limits.
- [x] Add small test fixtures for simple, ignored, generated, and unsupported project files.

### Phase 2: Data and Auth

- [x] Define Convex schema for projects, files, chunks, chats, and messages.
- [x] Add Convex indexes for user projects, project files, project chunks, project chats, and chat messages.
- [x] Add Convex vector index for chunk embeddings.
- [x] Implement authenticated user helpers for Convex queries and mutations.
- [x] Implement project ownership checks.
- [x] Enforce one-project-per-chat and many-chats-per-project relationships.
- [x] Implement auth UI for email/password, Google, GitHub, and sign out.
- [x] Add tests for authenticated vs unauthenticated states and ownership checks.

### Phase 3: Ingestion Core

- [x] Implement GitHub URL parsing and validation.
- [x] Implement path normalization.
- [x] Implement supported file and ignored directory filtering.
- [x] Implement file size, file count, and total size validation.
- [x] Implement binary/generated-file detection.
- [x] Implement deterministic chunking with start and end lines.
- [x] Implement chunk metadata construction.
- [x] Add unit tests for all ingestion utilities.

### Phase 4: Project Import

- [x] Implement create project mutation with initial status.
- [x] Implement duplicate project detection for GitHub URLs and best-effort local project fingerprints.
- [x] Add duplicate import prompt with create duplicate and replace/re-index actions.
- [x] Implement replace/re-index flow that clears prior files, chunks, embeddings, warnings, and failed file list before storing the new index.
- [x] Implement local folder picker and client-side filtering.
- [x] Implement client-side temporary archive creation for accepted local files.
- [x] Implement local archive upload/ingestion handoff.
- [x] Implement GitHub import form.
- [x] Implement internal action to download public GitHub repository ZIP.
- [x] Implement shared server-side extraction and ingestion action.
- [x] Implement internal mutations to persist files, chunks, embeddings, and project status.
- [x] Persist indexing progress updates for files processed and chunks embedded.
- [x] Ensure temporary archives are cleaned up after success and failure.
- [x] Add project status UI for pending, indexing, ready, ready with warnings, and error.
- [x] Add indexing progress UI for files processed and chunks embedded.
- [x] Add warning popup with generic message, failed file list, delete project action, and proceed with warnings action.
- [x] Implement delete project mutation scoped to the authenticated owner.
- [x] Query and delete related project chats, messages, files, and chunks when deleting a project.
- [x] Add integration tests for local and GitHub ingestion boundaries.

### Phase 5: Embeddings and Retrieval

- [x] Add embedding provider wrapper behind a small module interface.
- [x] Generate and store embeddings for chunks during ingestion.
- [x] Implement question embedding generation.
- [x] Implement Convex vector search for top relevant chunks.
- [x] Define a retrieval relevance threshold for deciding when context is too weak.
- [x] Enforce top-K and context-size limits.
- [x] Return an "I don't have enough indexed context" response when retrieval is empty or below threshold.
- [x] Add deterministic fake embedding/retrieval utilities for tests.
- [x] Add tests for retrieval input construction and context limiting.

### Phase 6: Chat

- [ ] Implement chat creation mutation.
- [ ] Require a project when creating a chat.
- [ ] Implement recent chats query.
- [ ] Implement chat messages query.
- [ ] Implement bounded recent chat context query for answer generation, defaulting to 50 recent messages.
- [ ] Implement save user message mutation.
- [ ] Implement internal answer generation action.
- [ ] Implement prompt construction with retrieved code context and bounded conversation context.
- [ ] Call the LLM through Vercel AI SDK.
- [ ] Add AI provider retry handling with up to 3 total attempts.
- [ ] Return assistant responses after completion; do not implement token-by-token streaming in MVP.
- [ ] Persist assistant messages with sources.
- [ ] Persist assistant error messages or error state on failure.
- [ ] Implement ChatGPT-style layout with sidebar, message list, source citations, input, send button, and loading state.
- [ ] Add integration tests for chat creation, persistence, answer saving, and source display.

### Phase 7: UX Completion

- [ ] Add empty state for no projects.
- [ ] Add project selector or project context display.
- [ ] Add disabled chat input for projects that are not ready.
- [ ] Add import error and warning messages that are useful but not overly technical.
- [ ] Add delete project UI with confirmation warning that related chats and messages will also be deleted.
- [ ] Add delete chat if included in MVP controls.
- [ ] Verify responsive layout for desktop and mobile.

### Phase 8: E2E and Quality Gates

- [ ] Add Playwright setup.
- [ ] Add E2E test for authentication.
- [ ] Add shippable happy-path E2E test using a configurable user, small predefined project upload, multiple questions, and returned answers.
- [ ] Add E2E test for GitHub import or mocked GitHub boundary.
- [ ] Add E2E test for chat navigation persistence.
- [ ] Add predefined E2E users for normal happy-path testing.
- [ ] Add predefined projects for deterministic E2E import.
- [ ] Add CI script for type check, lint, format check, unit/integration tests, and E2E tests.
- [ ] Run `pnpm check`.
- [ ] Run unit and integration tests.
- [ ] Run Playwright tests.
- [ ] Document deferred cases and known limitations in the README.

### Phase 9: README Media Script

- [ ] Add standalone README GIF generator script outside the E2E test suite.
- [ ] Add predefined GIF user for README media generation.
- [ ] Add predefined projects for README GIF screenshots.
- [ ] Capture the login screen screenshot.
- [ ] Log in with the predefined GIF user.
- [ ] Select predefined projects and capture three authenticated project screenshots.
- [ ] Generate `readme.gif` in the project root from the four captured screenshots.
- [ ] Clean temporary screenshot PNGs from `.temp` after `readme.gif` generation.

## 12. Definition of Done

- A new user can sign in with email/password, Google, or GitHub.
- A user can import a local fixture project.
- A user can import a public GitHub repository.
- Imported files are filtered, chunked, embedded, and stored.
- Project status reaches `ready`, `ready_with_warnings`, or useful `error`.
- A user can ask a question against a ready project.
- The assistant answers using retrieved chunks, not the whole repository.
- Answers show source citations with paths and line ranges.
- Chats persist and can be revisited.
- Projects can be deleted with confirmed cleanup of related chats, messages, files, and chunks.
- Data access is scoped to the authenticated owner.
- Core deterministic logic has unit tests.
- Critical workflows have integration or E2E coverage.
- The shippable happy-path E2E test passes.
- The standalone README GIF generator can create root-level `readme.gif` and clean temporary PNGs.
- Temporary archives are not permanently stored.
- README documents non-goals and limitations.
