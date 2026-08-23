import { defineApp } from 'convex/server'
import { v } from 'convex/values'
import betterAuth from '@convex-dev/better-auth/convex.config'

const app = defineApp({
  env: {
    BETTER_AUTH_SECRET: v.string(),
    BETTER_AUTH_URL: v.string(),
    GOOGLE_CLIENT_ID: v.string(),
    GOOGLE_CLIENT_SECRET: v.string(),
    GITHUB_CLIENT_ID: v.string(),
    GITHUB_CLIENT_SECRET: v.string(),
    AI_GATEWAY_API_KEY: v.optional(v.string()),
    AI_GATEWAY_CHAT_MODEL: v.optional(v.string()),
    AI_GATEWAY_FALLBACK_CHAT_MODELS: v.optional(v.string()),
    AI_GATEWAY_EMBEDDING_MODEL: v.optional(v.string()),
    AI_GATEWAY_EMBEDDING_DIMENSIONS: v.optional(v.string()),
    PROJECT_MAX_ACCEPTED_FILES: v.optional(v.string()),
    PROJECT_MAX_ACCEPTED_FILE_BYTES: v.optional(v.string()),
    PROJECT_MAX_TOTAL_ACCEPTED_TEXT_BYTES: v.optional(v.string()),
    PROJECT_MAX_CHUNKS_PER_PROJECT: v.optional(v.string()),
    PROJECT_SUPPORTED_EXTENSIONS: v.optional(v.string()),
    PROJECT_IGNORED_DIRECTORIES: v.optional(v.string()),
    RETRIEVAL_TOP_K: v.optional(v.string()),
    RETRIEVAL_MAX_CONTEXT_CHARS: v.optional(v.string()),
    RETRIEVAL_RECENT_MESSAGE_LIMIT: v.optional(v.string()),
    RETRIEVAL_MIN_RELEVANCE_SCORE: v.optional(v.string()),
  },
})
app.use(betterAuth)

export default app
