import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { e2eProjects, e2eQuestions } from './config'

test.describe.configure({ mode: 'serial' })
let firstChatUrl = ''

test('imports a local fixture and returns cited answers to multiple questions', async ({
  page,
}) => {
  await openSettledWorkspace(page)
  await openImportPanel(page)
  await page.getByLabel('Project name').fill(e2eProjects.local.name)
  await page
    .getByLabel('Project folder')
    .setInputFiles(path.resolve(e2eProjects.local.directory))
  await expect(page.getByText(/files selected/)).toBeVisible()
  await page.getByRole('button', { name: 'Import project' }).click()
  await confirmImport(page)
  await openReadyProject(page, e2eProjects.local.name, 'local')

  await startChat(page)
  await askAndExpectCitedAnswer(page, e2eQuestions.first)
  firstChatUrl = page.url()
  await askAndExpectCitedAnswer(page, e2eQuestions.second)
})

test('preserves messages while navigating between chats', async ({ page }) => {
  expect(firstChatUrl).not.toBe('')
  await page.goto(firstChatUrl)

  const firstChat = page.getByRole('button', {
    name: e2eQuestions.first,
    exact: true,
  })
  await expect(
    page.getByRole('article').getByText(e2eQuestions.second, { exact: true }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'New', exact: true }).click()
  await expect(page).not.toHaveURL(firstChatUrl)
  await expect(page.getByPlaceholder('Ask about this codebase')).toBeEnabled()
  await askAndExpectCitedAnswer(page, e2eQuestions.otherChat)
  await firstChat.click()

  await expect(
    page.getByRole('article').getByText(e2eQuestions.first, { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('article').getByText(e2eQuestions.second, { exact: true }),
  ).toBeVisible()
})

test('imports the mocked GitHub fixture and answers from it', async ({
  page,
}) => {
  await openSettledWorkspace(page)
  await openImportPanel(page)
  await page.getByRole('button', { name: 'GitHub URL' }).click()
  await page
    .getByLabel('Public GitHub repository URL')
    .fill(e2eProjects.github.url)
  await page.getByRole('button', { name: 'Import project' }).click()
  await confirmImport(page)
  await openReadyProject(page, e2eProjects.github.name, 'github')

  await startChat(page)
  await askAndExpectCitedAnswer(page, e2eQuestions.github)
  await expect(page.getByText(/e2e-fixture\/README\.md:\d+-\d+/)).toBeVisible()
})

async function confirmImport(page: Page) {
  const duplicate = page.getByRole('heading', {
    name: 'Project already exists',
  })
  const ready = page.getByRole('heading', { name: 'Ready to import' })
  await expect(duplicate.or(ready)).toBeVisible()

  if (await duplicate.isVisible()) {
    await page.getByRole('button', { name: 'Create duplicate' }).click()
  } else {
    await page.getByRole('button', { name: 'Start indexing' }).click()
  }
}

async function openReadyProject(
  page: Page,
  name: string,
  sourceType: 'local' | 'github',
) {
  const project = page
    .getByRole('button', { name: new RegExp(`^${escapeRegex(name)}`) })
    .first()
  await expect(project).toBeVisible()
  await expect(
    project.getByText(`${sourceType} · ready`, { exact: true }),
  ).toBeVisible({
    timeout: 30_000,
  })
  await project.click()
  await expect(
    page.getByText(`${sourceType} project · Ready`, { exact: true }),
  ).toBeVisible()
}

async function startChat(page: Page) {
  const start = page.getByRole('button', { name: 'Start a chat' })
  if (await start.isVisible()) {
    await start.click()
    await expect(page).toHaveURL(/\/chats\//)
  } else {
    const previousUrl = page.url()
    await page.getByRole('button', { name: 'New', exact: true }).click()
    await expect(page).not.toHaveURL(previousUrl)
  }
  await expect(page.getByPlaceholder('Ask about this codebase')).toBeEnabled()
}

async function askAndExpectCitedAnswer(page: Page, question: string) {
  await page.getByPlaceholder('Ask about this codebase').fill(question)
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(
    page.getByRole('article').getByText(question, { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText(
      `Deterministic answer grounded in indexed code for: ${question}`,
    ),
  ).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(/:\d+-\d+$/).last()).toBeVisible()
}

function escapeRegex(value: string) {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function openSettledWorkspace(page: Page) {
  await page.goto('/app')
  const projects = page.getByRole('heading', { name: 'Projects' })
  const empty = page.getByRole('heading', { name: 'Import a project' })
  await expect(projects.or(empty)).toBeVisible()
  if (await projects.isVisible()) {
    await expect(page).toHaveURL(/\/app\/projects\//)
    await waitForStableUrl(page)
  }
}

async function openImportPanel(page: Page) {
  const projectName = page.getByLabel('Project name')
  if (await projectName.isVisible()) return
  await page.getByRole('button', { name: 'Add project' }).click()
  await expect(projectName).toBeVisible()
}

async function waitForStableUrl(page: Page) {
  let lastUrl = page.url()
  let stableSince = Date.now()

  await expect
    .poll(
      () => {
        const currentUrl = page.url()
        if (currentUrl !== lastUrl) {
          lastUrl = currentUrl
          stableSince = Date.now()
        }
        return Date.now() - stableSince
      },
      { timeout: 10_000 },
    )
    .toBeGreaterThanOrEqual(750)
}
