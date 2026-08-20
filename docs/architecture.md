# Architecture

## Overview

The application is a full-stack Code Documentation Assistant that lets an authenticated user import a codebase from either a local project folder or a public GitHub repository, index the useful source/documentation files with embeddings, and ask questions about the code through a ChatGPT-style interface.

The implementation intentionally stays simple and focused on the assignment requirements. There is no separate REST API, no public API for third-party consumers, and no permanent storage of uploaded repository archives.

## Technology Stack

- **Frontend:** React
- **Application framework:** TanStack Start
- **Styling:** Tailwind CSS
- **UI components:** shadcn/ui
- **Application backend:** Convex
- **Authentication:** Better Auth with Convex integration
- **Authentication methods:** Email/password, Google, GitHub
- **AI integration:** Vercel AI SDK
- **Database:** Convex
- **Vector search:** Convex vector index
- **Hosting:** Vercel for the TanStack Start application, Convex for backend/database

## High-Level Architecture

```text
                         ┌──────────────────────────────┐
                         │            Browser           │
                         │                              │
                         │ React + TanStack Start       │
                         │ Tailwind + shadcn/ui         │
                         └──────────────┬───────────────┘
                                        │
                              Convex client calls
                         useQuery / useMutation
                                        │
                                        ▼
                         ┌──────────────────────────────┐
                         │            Convex             │
                         │                              │
                         │ Queries                      │
                         │ Mutations                    │
                         │ Internal Actions             │
                         │ Database                     │
                         │ Vector Search                │
                         │ Better Auth integration      │
                         └──────────────┬───────────────┘
                                        │
                         external network calls from
                              Convex internal actions
                           ┌────────────┴────────────┐
                           │                         │
                           ▼                         ▼
                    ┌─────────────┐         ┌─────────────┐
                    │   GitHub    │         │  AI Provider│
                    │ public repo │         │ embeddings  │
                    │   ZIP       │         │ + LLM       │
                    └─────────────┘         └─────────────┘
```

## Application Responsibilities

### TanStack Start / React

The Vercel-hosted application is primarily responsible for:

- Routing and page rendering
- Authentication UI
- Project import UI
- Chat UI
- Recent chats sidebar
- Project/indexing status UI
- Sending user actions to Convex
- Reactively displaying Convex query results

The application does not expose a separate API for external consumers.

### Convex

Convex is the main application backend and owns:

- Application data
- Authentication integration
- Reactive queries
- Database mutations
- Background/external workflows through internal actions
- Vector search
- Persisting indexed code chunks and chat data

### Convex Actions

HTTP actions are not required.

Normal Convex internal actions are used where the backend must perform external or non-deterministic work, such as:

- Downloading a public GitHub repository archive
- Calling an embedding provider
- Calling the LLM provider through the Vercel AI SDK
- Orchestrating indexing/retrieval work

Queries and mutations remain the primary interface for normal application data access.

A typical workflow is:

```text
Client
  │
  ├── useMutation(createProject)
  │
  ▼
Convex mutation
  │
  ├── create/update project state
  └── schedule internal action
             │
             ▼
      Convex internal action
             │
             ├── external work
             └── run internal mutations to persist results
```

## Authentication

Authentication is handled by Better Auth with the Convex integration.

Supported sign-in/sign-up methods:

- Email/password
- Google
- GitHub

Email verification is not required for newly created email/password accounts in the demo.

The authenticated user owns their projects, chats, and related data.

## Main User Experience

After signing in, the user sees a simplified ChatGPT-style interface.

```text
┌──────────────────────┬─────────────────────────────────────┐
│ Code Assistant       │                                     │
│                      │            Chat / Empty State       │
│ + New chat           │                                     │
│                      │                                     │
│ Recent chats         │                                     │
│                      │                                     │
│ • Authentication     │                                     │
│ • API structure      │                                     │
│ • Project structure  │                                     │
│                      │                                     │
│                      │                                     │
│──────────────────────│                                     │
│ User / Sign out      │                                     │
│                      │                                     │
│                      │  Ask about your code...        Send │
└──────────────────────┴─────────────────────────────────────┘
```

The first version intentionally avoids extra ChatGPT features such as folders, conversation search, sharing, or other advanced workspace functionality.

## Project Import

The application supports two project sources:

1. A local project folder
2. A public GitHub repository URL

ZIP upload is not a separate user-facing import option.

A ZIP archive is used internally as a transport mechanism for GitHub repositories and, after local-folder filtering, for local folder uploads.

### Local Folder Import

The browser allows the user to select a project folder.

The client performs an initial lightweight filter to avoid unnecessarily transferring obviously irrelevant files and directories.

Typical exclusions include:

```text
node_modules/
.git/
.next/
dist/
build/
coverage/
other generated/build directories
binary/media files
```

The client keeps source and documentation files such as:

```text
.ts
.tsx
.js
.jsx
.json
.md
.mdx
.css
.html
.yml
.yaml
```

Additional common source-code extensions can be supported where useful.

After filtering, the client packages the remaining files into one temporary ZIP archive and uploads that archive for ingestion.

The browser-side filter is an optimization, not the security boundary. The server-side ingestion pipeline validates and filters the archive again.

### Public GitHub Import

The user provides a public GitHub repository URL.

The backend downloads the repository as a ZIP archive from GitHub. No GitHub OAuth access to private repositories is required for the initial version.

The archive is only a temporary ingestion artifact.

Flow:

```text
GitHub URL
   │
   ▼
Download repository ZIP
   │
   ▼
Extract
   │
   ▼
Server-side filtering
   │
   ▼
Chunk + embed useful files
```

We do not permanently store the GitHub ZIP.

## Shared Ingestion Pipeline

Both import sources converge on the same ingestion pipeline after archive extraction.

```text
                Local folder
                     │
             client-side filter
                     │
                 temporary ZIP
                     │
                     ├──────────────┐
                     │              │
                     ▼              │
                 Extraction         │
                     ▲              │
                     │              │
               GitHub ZIP           │
                     │              │
                     └──────┬───────┘
                            ▼
                  Server-side filter
                            │
                            ▼
                      File normalization
                            │
                            ▼
                         Chunking
                            │
                            ▼
                    Generate embeddings
                            │
                            ▼
                 Convex chunks + vectors
```

### Why filter twice?

Client-side filtering reduces upload size and unnecessary work.

Server-side filtering remains the source of truth because client code and requests cannot be trusted to enforce ingestion limits.

Server-side validation should enforce limits such as:

- Supported file extensions
- Maximum individual file size
- Maximum total extracted size
- Maximum number of files
- Binary/generated-file detection where applicable
- Excluded directories

## Code Chunking

Only useful text/source files are chunked.

Chunks should retain enough metadata to connect an answer back to the original code, including:

- Project ID
- File ID/path
- Chunk content
- Start line
- End line

The initial implementation should use deterministic code-oriented chunking rather than an LLM-based chunking step.

The goal is to keep ingestion predictable, cheap, and easy to reason about.

## Embeddings and Vector Search

Embeddings are generated once during project ingestion and stored with the code chunks.

For a user question:

```text
User question
      │
      ▼
Generate question embedding
      │
      ▼
Convex vector search
      │
      ▼
Top relevant chunks
```

Only the retrieved chunks are sent to the LLM. The complete repository is never placed into the prompt for every question.

This keeps token usage low and improves retrieval quality.

A small number of top results should be retrieved and a context-size limit should be enforced.

## Chat Flow

The chat flow is designed around Convex reactivity.

```text
User sends message
       │
       ▼
useMutation(saveUserMessage)
       │
       ▼
Schedule internal answer action
       │
       ▼
Generate question embedding
       │
       ▼
Vector search in Convex
       │
       ▼
Retrieve relevant chunks
       │
       ▼
Call LLM through Vercel AI SDK
       │
       ▼
Save assistant response + sources
       │
       ▼
Convex realtime update
       │
       ▼
Chat UI updates via useQuery
```

The prompt should contain only the user question plus the retrieved code context and the relevant conversation context.

The application should not send the entire project or unlimited chat history on every request.

## Source Citations

Answers should expose the source files used to construct the answer.

Example:

```text
Authentication is handled through the session layer...

Sources
────────────────────────────
📄 src/lib/auth.ts        lines 12–65
📄 src/middleware/auth.ts lines 20–47
```

This makes the RAG behavior visible to the user and provides a simple quality/grounding mechanism.

## Data Model

A minimal schema can contain the following logical entities.

### Projects

```text
projects
- id
- userId
- name
- sourceType            // local | github
- sourceUrl             // optional GitHub URL
- status                // indexing | ready | error
- createdAt
- updatedAt
```

### Files

```text
files
- id
- projectId
- path
- extension
- size
```

Only metadata is required here if the chunk records contain the indexed content.

### Chunks

```text
chunks
- id
- projectId
- fileId
- content
- startLine
- endLine
- embedding
```

A Convex vector index is maintained over the embedding field.

### Chats

```text
chats
- id
- userId
- projectId
- title
- createdAt
- updatedAt
```

A chat belongs to a project so that each conversation has a clear codebase context.

### Messages

```text
messages
- id
- chatId
- role
- content
- sources                // optional source metadata
- createdAt
```

## Convex Client Usage

Most normal application operations should use Convex queries and mutations directly from React.

Examples:

```text
useQuery
├── current user
├── user's projects
├── recent chats
├── chat messages
└── project/indexing status

useMutation
├── create project
├── create chat
├── save user message
├── rename chat
└── delete chat
```

Convex actions are reserved for workflows that need external services or non-deterministic work.

## Temporary Archive Handling

Repository archives are temporary transport artifacts only.

They should not become permanent application data.

```text
Archive received
      │
      ▼
Extract
      │
      ▼
Filter / normalize
      │
      ▼
Chunk / embed
      │
      ▼
Persist useful metadata + chunks + vectors
      │
      ▼
Delete temporary archive
```

This minimizes Convex file storage usage and keeps the permanent data model focused on what the assistant actually needs.

## Token and Cost Control

The application should minimize unnecessary model usage.

### Ingestion

- Filter files before embedding
- Exclude dependencies and generated output
- Chunk deterministically
- Generate embeddings once per stored chunk

### Chat

- Embed only the question for retrieval
- Retrieve a small top-K set of chunks
- Send only relevant chunks to the LLM
- Limit retrieved context size
- Do not send unlimited conversation history
- Use a cost-efficient capable model for the demo

Vercel AI SDK is an integration layer; the main variable cost comes from the selected embedding and LLM providers rather than from the SDK itself.

## Error and Status Handling

Project ingestion should have explicit states:

```text
pending
   ↓
indexing
   ├──→ ready
   └──→ error
```

The UI should show clear progress/status while the project is being indexed.

Chat generation should also handle at least:

- Empty questions
- Temporary provider failures
- Retrieval failures
- Missing/invalid project context
- Failed indexing

The assignment does not require handling every edge case; unsupported or deferred cases should be documented in the README.

## Security and Boundaries

The application is intentionally a demo, but several boundaries should still be enforced:

- Only authenticated users can access their projects and chats.
- Project and chat queries must be scoped to the authenticated user.
- External AI provider credentials must remain server-side.
- GitHub import is limited to public repositories in the initial version.
- Server-side archive/file limits protect ingestion resources.
- Client-side filtering must never be treated as the security boundary.

## Deliberate Non-Goals

The first version does not include:

- Private GitHub repository support
- GitHub webhook/synchronization
- Continuous repository re-indexing
- A public API for third-party consumers
- Advanced autonomous coding agents
- Tool-calling agents that inspect files repeatedly
- Permanent original ZIP storage
- Multiple external API layers
- Chat folders, chat search, sharing, or collaborative workspaces

These can be documented as future improvements if needed.

## Deployment

```text
Vercel
└── TanStack Start application

Convex
├── Database
├── Better Auth integration
├── Queries / mutations
├── Internal actions
└── Vector search

External services
├── GitHub public repository archives
└── AI provider(s)
```

The deployment architecture keeps the web application and backend responsibilities clearly separated without introducing a custom REST/API layer that is unnecessary for this single-consumer application.

## Architectural Rationale

The main design principles are:

1. **Keep the implementation small.** The assignment explicitly values a solid, well-engineered basic solution over an over-engineered one.
2. **Use Convex as the application backend.** The application has one consumer—the React client—so a separate REST API is unnecessary.
3. **Use Convex actions only where they add value.** External GitHub/AI calls and other non-deterministic work belong in actions; normal CRUD remains queries/mutations.
4. **Use one ingestion pipeline.** Local and GitHub sources become archives/files and then follow the same filtering, chunking, embedding, and persistence path.
5. **Filter aggressively.** Dependencies, build output, generated files, and binary content add cost and retrieval noise without helping the assistant.
6. **Retrieve before generating.** The LLM should see only the most relevant code rather than the whole repository.
7. **Keep temporary data temporary.** Repository ZIP archives are transport artifacts, not permanent application data.
8. **Expose sources.** Showing file paths and line ranges makes answers easier to trust and demonstrates the retrieval pipeline.
