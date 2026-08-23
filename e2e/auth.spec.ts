import { expect, test } from '@playwright/test'
import { e2eUser } from './config'

test.use({ storageState: { cookies: [], origins: [] } })

test('signs in with the predefined E2E user', async ({ page }) => {
  await page.goto('/app')
  await expect(page).toHaveURL(/\/sign-in$/)

  await page.getByLabel('Email').fill(e2eUser.email)
  await page.getByLabel('Password').fill(e2eUser.password)
  await page
    .getByRole('button', { name: 'Sign in', exact: true })
    .last()
    .click()

  await expect(page).toHaveURL(/\/app(?:\/|$)/)
  await expect(
    page.getByRole('heading', { name: 'Your projects' }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeHidden()
  await expect(page.getByText(e2eUser.email, { exact: true })).toBeHidden()
  await expect(page).toHaveURL(/\/sign-in$/)
})
