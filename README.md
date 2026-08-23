# CodeChat

CodeChat is a full-stack code documentation assistant. An authenticated user can import a local project folder or public GitHub repository, index useful source and documentation files, and ask grounded questions in a ChatGPT-style interface with file and line citations.

The MVP is a focused RAG application, not an autonomous coding agent. It does not edit code or sync repositories continuously.

## Features

- Email/password, Google, and GitHub authentication through Better Auth and Convex.
- Local folder import with browser folder picker, client-side filtering, and temporary ZIP packaging.
- Public GitHub repository import.
- Shared Convex ingestion pipeline for filtering, validation, chunking, embedding, and persistence.
- Convex vector search over indexed chunks.
- Non-streaming assistant answers through Vercel AI SDK and AI Gateway.
- Project-scoped chats with recent chat navigation.
- Source citations with file paths and approximate chunk line ranges.
- Project indexing status, progress, warnings, and error states.
- Project deletion with cleanup of related chats, messages, files, and chunks.

## Stack

- React 19
- TanStack Start
- Tailwind CSS and shadcn/ui
- Convex
- Better Auth
- Vercel AI SDK with AI Gateway
- Vitest, convex-test, oxlint, oxfmt, TypeScript

## Requirements

- Node.js compatible with the project dependencies
- pnpm 11
- A Convex project
- Better Auth secrets and OAuth credentials for Google and GitHub
- A Vercel AI Gateway API key

## Setup

Install dependencies:

```sh
pnpm install
```

Create local environment files from the example:

```sh
cp .env.example .env.local
```

Fill in the required values:

- `CONVEX_DEPLOYMENT`
- `VITE_CONVEX_URL`
- `VITE_CONVEX_SITE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `AI_GATEWAY_API_KEY`

See [docs/configuration.md](docs/configuration.md) for all optional ingestion, retrieval, and model tuning values.

Generate Convex bindings after schema or function changes:

```sh
CI=1 ./node_modules/.bin/convex codegen --typecheck disable
```

Run the app:

```sh
pnpm dev
```

By default Vite serves the app on port `8080`.

## Scripts

```sh
pnpm dev      # Start the local app server
pnpm build    # Build the app
pnpm test     # Run Vitest tests
pnpm types    # Run TypeScript typecheck
pnpm check    # Typecheck, lint/fix, and format
```

## Project Flow

1. Sign in.
2. Import a local folder or public GitHub repository.
3. Wait for indexing to finish.
4. Create or open a chat for the project.
5. Ask questions and review cited source chunks.

If retrieval does not find strong enough context, the assistant returns that it does not have enough indexed context instead of guessing.

## Testing

Run the deterministic unit and Convex persistence tests:

```sh
pnpm test
```

Current coverage includes ingestion utilities, retrieval context construction, chat prompt/source helpers, auth helpers, archive packaging, and Convex chat persistence.

## Documentation

- [MVP PRD](docs/mvp-prd.md)
- [Architecture](docs/architecture.md)
- [Configuration](docs/configuration.md)
- [Testing notes](docs/tests.md)

## Current Limitations

- Private GitHub repositories are out of scope.
- Repository sync, webhooks, chat sharing, chat folders, and chat search are not implemented.
- Assistant responses are non-streaming.
- Citations are chunk-level approximate line ranges.
- E2E tests and README media generation are planned in later phases.
