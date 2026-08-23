export const defaultSupportedExtensions = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.md',
  '.mdx',
  '.css',
  '.html',
  '.yml',
  '.yaml',
  '.py',
  '.pyi',
  '.toml',
  '.ini',
  '.cfg',
  '.txt',
  '.rst',
] as const

export const defaultIgnoredDirectories = [
  '.git',
  '.hg',
  '.svn',
  '.next',
  '.nuxt',
  '.turbo',
  '.vercel',
  '.cache',
  '.pytest_cache',
  '.mypy_cache',
  '.ruff_cache',
  '__pycache__',
  'node_modules',
  'dist',
  'build',
  'coverage',
  'out',
  'target',
  'vendor',
] as const

export const defaultCodingChatModel = 'alibaba/qwen3.7-flash'

export const defaultCodingChatAlternatives = [
  'minimax/minimax-m3',
  'moonshotai/kimi-k2.5',
] as const

export const defaultEmbeddingModel = 'openai/text-embedding-3-small'

type EnvSource = Record<string, string | undefined>

type IngestionConfig = {
  maxAcceptedFiles: number
  maxAcceptedFileBytes: number
  maxTotalAcceptedTextBytes: number
  maxChunksPerProject: number
  supportedExtensions: readonly string[]
  ignoredDirectories: readonly string[]
}

type RetrievalConfig = {
  topK: number
  maxContextChars: number
  recentMessageLimit: number
  minRelevanceScore: number
}

type AiConfig = {
  gatewayApiKeyEnvVar: 'AI_GATEWAY_API_KEY'
  chatModel: string
  fallbackChatModels: readonly string[]
  embeddingModel: string
  embeddingDimensions: number
}

type AuthConfig = {
  requiredProviders: readonly ['email-password', 'google', 'github']
  envVars: {
    betterAuthSecret: 'BETTER_AUTH_SECRET'
    betterAuthUrl: 'BETTER_AUTH_URL'
    googleClientId: 'GOOGLE_CLIENT_ID'
    googleClientSecret: 'GOOGLE_CLIENT_SECRET'
    githubClientId: 'GITHUB_CLIENT_ID'
    githubClientSecret: 'GITHUB_CLIENT_SECRET'
  }
}

export type ProjectConfig = {
  ingestion: IngestionConfig
  retrieval: RetrievalConfig
  ai: AiConfig
  auth: AuthConfig
}

export const projectConfig = buildProjectConfig()

export function buildProjectConfig(env = readRuntimeEnv()): ProjectConfig {
  return {
    ingestion: {
      maxAcceptedFiles: readPositiveInteger(env, 'PROJECT_MAX_ACCEPTED_FILES', 500),
      maxAcceptedFileBytes: readPositiveInteger(
        env,
        'PROJECT_MAX_ACCEPTED_FILE_BYTES',
        512 * 1024,
      ),
      maxTotalAcceptedTextBytes: readPositiveInteger(
        env,
        'PROJECT_MAX_TOTAL_ACCEPTED_TEXT_BYTES',
        20 * 1024 * 1024,
      ),
      maxChunksPerProject: readPositiveInteger(
        env,
        'PROJECT_MAX_CHUNKS_PER_PROJECT',
        1000,
      ),
      supportedExtensions: readCsvList(
        env,
        'PROJECT_SUPPORTED_EXTENSIONS',
        defaultSupportedExtensions,
      ),
      ignoredDirectories: readCsvList(
        env,
        'PROJECT_IGNORED_DIRECTORIES',
        defaultIgnoredDirectories,
      ),
    },
    retrieval: {
      topK: readPositiveInteger(env, 'RETRIEVAL_TOP_K', 8),
      maxContextChars: readPositiveInteger(
        env,
        'RETRIEVAL_MAX_CONTEXT_CHARS',
        24000,
      ),
      recentMessageLimit: readPositiveInteger(
        env,
        'RETRIEVAL_RECENT_MESSAGE_LIMIT',
        50,
      ),
      minRelevanceScore: readNumberInRange(
        env,
        'RETRIEVAL_MIN_RELEVANCE_SCORE',
        0.35,
        0,
        1,
      ),
    },
    ai: {
      gatewayApiKeyEnvVar: 'AI_GATEWAY_API_KEY',
      chatModel: readOptionalString(env, 'AI_GATEWAY_CHAT_MODEL')
        ?? defaultCodingChatModel,
      fallbackChatModels: readCsvList(
        env,
        'AI_GATEWAY_FALLBACK_CHAT_MODELS',
        defaultCodingChatAlternatives,
      ),
      embeddingModel: readOptionalString(env, 'AI_GATEWAY_EMBEDDING_MODEL')
        ?? defaultEmbeddingModel,
      embeddingDimensions: readPositiveInteger(
        env,
        'AI_GATEWAY_EMBEDDING_DIMENSIONS',
        1536,
      ),
    },
    auth: {
      requiredProviders: ['email-password', 'google', 'github'],
      envVars: {
        betterAuthSecret: 'BETTER_AUTH_SECRET',
        betterAuthUrl: 'BETTER_AUTH_URL',
        googleClientId: 'GOOGLE_CLIENT_ID',
        googleClientSecret: 'GOOGLE_CLIENT_SECRET',
        githubClientId: 'GITHUB_CLIENT_ID',
        githubClientSecret: 'GITHUB_CLIENT_SECRET',
      },
    },
  }
}

function readRuntimeEnv(): EnvSource {
  const viteEnv = (import.meta as ImportMeta & { env?: EnvSource }).env ?? {}
  const nodeEnv =
    typeof process === 'undefined' ? {} : (process.env as EnvSource)

  return {
    ...nodeEnv,
    ...viteEnv,
  }
}

function readOptionalString(env: EnvSource, key: string) {
  const value = env[key]?.trim()
  return value === '' ? undefined : value
}

function readPositiveInteger(env: EnvSource, key: string, fallback: number) {
  const value = readOptionalString(env, key)

  if (!value) {
    return fallback
  }

  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function readNumberInRange(
  env: EnvSource,
  key: string,
  fallback: number,
  min: number,
  max: number,
) {
  const value = readOptionalString(env, key)

  if (!value) {
    return fallback
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= min && parsed <= max
    ? parsed
    : fallback
}

function readCsvList(
  env: EnvSource,
  key: string,
  fallback: readonly string[],
) {
  const value = readOptionalString(env, key)

  if (!value) {
    return fallback
  }

  const values = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

  return values.length > 0 ? values : fallback
}
