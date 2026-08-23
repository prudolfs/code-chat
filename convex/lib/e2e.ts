import { env } from '../_generated/server'

export const e2eTestMode = env.E2E_TEST_MODE === 'true'

export const e2eGitHubRepositoryUrl = 'https://github.com/code-chat/e2e-fixture'
