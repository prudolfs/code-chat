import { env } from '../_generated/server'
import { buildProjectConfig } from '../../shared/project-config'

export const convexProjectConfig = buildProjectConfig(
  env as Record<string, string | undefined>,
)
