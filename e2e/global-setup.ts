import { mkdir } from 'node:fs/promises'
import { request, type FullConfig } from '@playwright/test'
import { e2eUser } from './config'

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL
  if (typeof baseURL !== 'string') {
    throw new TypeError('Playwright baseURL is required')
  }

  await mkdir('.temp', { recursive: true })
  const authRequest = await request.newContext({
    baseURL,
    extraHTTPHeaders: { Origin: baseURL },
  })
  const signUp = await authRequest.post('/api/auth/sign-up/email', {
    data: { ...e2eUser, callbackURL: '/app' },
  })
  if (!signUp.ok() && signUp.status() >= 500) {
    throw new Error(`E2E user setup failed: ${await signUp.text()}`)
  }

  const signIn = await authRequest.post('/api/auth/sign-in/email', {
    data: {
      email: e2eUser.email,
      password: e2eUser.password,
      callbackURL: '/app',
    },
  })
  if (!signIn.ok()) {
    throw new Error(`E2E sign-in setup failed: ${await signIn.text()}`)
  }

  await authRequest.storageState({ path: '.temp/e2e-auth.json' })
  await authRequest.dispose()
}
