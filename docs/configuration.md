# Configuration

The app keeps MVP tuning values in configuration so development and deployment can adjust limits without code changes.

## Required Environment

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

Better Auth runs in Convex but is exposed through the TanStack Start
`/api/auth/*` proxy. Set `BETTER_AUTH_URL` in the Convex deployment to the
public frontend origin. For local development this is
`http://localhost:8080`; it is not the `.convex.site` URL.

Configure the OAuth applications with these local development values:

- Authorized origin: `http://localhost:8080`
- Google redirect URI: `http://localhost:8080/api/auth/callback/google`
- GitHub callback URL: `http://localhost:8080/api/auth/callback/github`

Production OAuth applications must use the same paths on the deployed
frontend origin.

Backend variables such as `BETTER_AUTH_SECRET`, OAuth client credentials, AI
Gateway credentials, and model/limit overrides must be configured in the
Convex deployment through Dashboard Settings or `convex env set`. Local
dotenv files do not populate the environment of hosted Convex functions.

## AI Gateway Defaults

- `AI_GATEWAY_CHAT_MODEL`: `alibaba/qwen3.7-flash`
- `AI_GATEWAY_FALLBACK_CHAT_MODELS`: `minimax/minimax-m3,moonshotai/kimi-k2.5`
- `AI_GATEWAY_EMBEDDING_MODEL`: `openai/text-embedding-3-small`
- `AI_GATEWAY_EMBEDDING_DIMENSIONS`: `1536`

The chat model is intentionally cheap for development. `minimax/minimax-m3` and `moonshotai/kimi-k2.5` are documented alternatives for coding quality experiments.

## Ingestion Defaults

- `PROJECT_MAX_ACCEPTED_FILES`: `500`
- `PROJECT_MAX_ACCEPTED_FILE_BYTES`: `524288`
- `PROJECT_MAX_TOTAL_ACCEPTED_TEXT_BYTES`: `20971520`
- `PROJECT_MAX_CHUNKS_PER_PROJECT`: `1000`
- `PROJECT_SUPPORTED_EXTENSIONS`: `.ts,.tsx,.js,.jsx,.json,.md,.mdx,.css,.html,.yml,.yaml,.py,.pyi,.toml,.ini,.cfg,.txt,.rst`
- `PROJECT_IGNORED_DIRECTORIES`: `.git,.hg,.svn,.next,.nuxt,.turbo,.vercel,.cache,.pytest_cache,.mypy_cache,.ruff_cache,__pycache__,node_modules,dist,build,coverage,out,target,vendor`
- `PROJECT_IGNORED_FILENAMES`: `pnpm-lock.yaml,package-lock.json,yarn.lock,bun.lock,bun.lockb,Cargo.lock,composer.lock,Gemfile.lock,poetry.lock,uv.lock,Pipfile.lock,go.sum`

## Retrieval Defaults

- `RETRIEVAL_TOP_K`: `8`
- `RETRIEVAL_MAX_CONTEXT_CHARS`: `24000`
- `RETRIEVAL_RECENT_MESSAGE_LIMIT`: `50`
- `RETRIEVAL_MIN_RELEVANCE_SCORE`: `0.25`

## E2E Environment

Copy `.env.e2e.example` values into the test process when overrides are
needed. The committed defaults define a non-production email/password user,
local fixture project name, and local app URL.

`pnpm test:e2e` temporarily sets `E2E_TEST_MODE=true` in the selected Convex
deployment. In that mode only, external GitHub, embedding, vector scoring, and
LLM boundaries are deterministic. The runner restores the previous deployment
value in `finally`. Always use a development or dedicated E2E deployment.
