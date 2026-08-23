export {
  buildProjectConfig,
  defaultCodingChatAlternatives,
  defaultCodingChatModel,
  defaultEmbeddingModel,
  defaultIgnoredDirectories,
  defaultSupportedExtensions,
  projectConfig,
} from '../../shared/project-config'

export type { ProjectConfig } from '../../shared/project-config'

import { buildProjectConfig } from '../../shared/project-config'

export const clientProjectConfig = buildProjectConfig(
  (import.meta as ImportMeta & { env?: Record<string, string | undefined> })
    .env,
)
