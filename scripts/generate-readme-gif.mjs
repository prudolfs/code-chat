import { spawn, spawnSync } from 'node:child_process'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { chromium, request } from '@playwright/test'
import gifenc from 'gifenc'
import { PNG } from 'pngjs'
import { readmeGifProjects, readmeGifUser } from './readme-media.config.mjs'

const { GIFEncoder, applyPalette, quantize } = gifenc
const root = process.cwd()
const baseURL = process.env.README_GIF_BASE_URL ?? 'http://localhost:8080'
const temporaryDirectory = path.join(root, '.temp', 'readme-media')
const outputPath = path.join(root, 'readme.gif')
const convex = path.join(root, 'node_modules', '.bin', 'convex')
const vite = path.join(root, 'node_modules', '.bin', 'vite')

let server
let previousE2eMode
let shouldRestoreE2eMode = false

try {
  await mkdir(temporaryDirectory, { recursive: true })
  previousE2eMode = readConvexEnvironment('E2E_TEST_MODE')
  shouldRestoreE2eMode = true
  runConvex(['env', 'set', 'E2E_TEST_MODE', 'true'])

  if (!(await isServerReady())) {
    server = spawn(vite, ['dev'], {
      cwd: root,
      env: process.env,
      stdio: 'inherit',
    })
    await waitForServer()
  }

  await ensureGifUser()
  const screenshots = await captureScreenshots()
  await encodeGif(screenshots)
  console.log(`Generated ${path.relative(root, outputPath)}`)
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true })
  if (server) server.kill('SIGTERM')
  if (shouldRestoreE2eMode) {
    if (previousE2eMode === null) {
      runConvex(['env', 'remove', 'E2E_TEST_MODE'])
    } else {
      runConvex(['env', 'set', 'E2E_TEST_MODE', previousE2eMode])
    }
  }
}

async function ensureGifUser() {
  const api = await request.newContext({
    baseURL,
    extraHTTPHeaders: { Origin: baseURL },
  })
  try {
    const response = await api.post('/api/auth/sign-up/email', {
      data: { ...readmeGifUser, callbackURL: '/app' },
    })
    if (!response.ok() && response.status() >= 500) {
      throw new Error(`README GIF user setup failed: ${await response.text()}`)
    }
  } finally {
    await api.dispose()
  }
}

async function captureScreenshots() {
  const browser = await chromium.launch()
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()
  const screenshots = []

  try {
    await page.goto('/sign-in')
    await page
      .getByRole('heading', { name: 'Sign in to your workspace' })
      .waitFor()
    screenshots.push(await takeScreenshot(page, '01-login.png'))

    await page.getByLabel('Email').fill(readmeGifUser.email)
    await page.getByLabel('Password').fill(readmeGifUser.password)
    await page
      .getByRole('button', { name: 'Sign in', exact: true })
      .last()
      .click()
    await page.getByRole('heading', { name: 'Your projects' }).waitFor()

    for (const [index, project] of readmeGifProjects.entries()) {
      await importProject(page, project)
      screenshots.push(
        await takeScreenshot(
          page,
          `${String(index + 2).padStart(2, '0')}-${slugify(project.name)}.png`,
        ),
      )
    }
  } finally {
    await context.close()
    await browser.close()
  }

  return screenshots
}

async function importProject(page, project) {
  const projectName = page.getByLabel('Project name')
  if (!(await projectName.isVisible())) {
    await page.getByRole('button', { name: 'Add project' }).click()
    await projectName.waitFor()
  }
  await page.getByRole('button', { name: 'Local folder' }).click()
  await projectName.fill(project.name)
  await page
    .getByLabel('Project folder')
    .setInputFiles(path.resolve(root, project.directory))
  await page.getByRole('button', { name: 'Import project' }).click()

  const duplicate = page.getByRole('heading', {
    name: 'Project already exists',
  })
  const ready = page.getByRole('heading', { name: 'Ready to import' })
  await duplicate.or(ready).waitFor()
  if (await duplicate.isVisible()) {
    await page.getByRole('button', { name: 'Replace and re-index' }).click()
  } else {
    await page.getByRole('button', { name: 'Start indexing' }).click()
  }

  const projectButton = page
    .getByRole('button', { name: new RegExp(`^${escapeRegex(project.name)}`) })
    .first()
  await projectButton.waitFor()
  await projectButton.getByText('local · ready', { exact: true }).waitFor({
    timeout: 30_000,
  })
  await projectButton.click()
  await page
    .getByText('local project · Ready', { exact: true })
    .waitFor({ timeout: 10_000 })
}

async function takeScreenshot(page, filename) {
  const screenshotPath = path.join(temporaryDirectory, filename)
  await page.screenshot({ path: screenshotPath, animations: 'disabled' })
  return screenshotPath
}

async function encodeGif(screenshotPaths) {
  const frames = await Promise.all(
    screenshotPaths.map(async (screenshotPath) =>
      PNG.sync.read(await readFile(screenshotPath)),
    ),
  )
  const [{ width, height }] = frames
  if (
    frames.some((frame) => frame.width !== width || frame.height !== height)
  ) {
    throw new Error('README GIF screenshots must have matching dimensions')
  }

  const gif = GIFEncoder()
  frames.forEach((frame, index) => {
    const palette = quantize(frame.data, 256)
    gif.writeFrame(applyPalette(frame.data, palette), width, height, {
      palette,
      delay: index === 0 ? 1600 : 2000,
      repeat: 0,
    })
  })
  gif.finish()
  await writeFile(outputPath, gif.bytes())
}

function readConvexEnvironment(name) {
  const result = spawnSync(convex, ['env', 'get', name], {
    cwd: root,
    encoding: 'utf8',
  })
  const value = result.status === 0 ? result.stdout.trim() : ''
  return value || null
}

function runConvex(args) {
  const result = spawnSync(convex, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`Convex command failed: convex ${args.join(' ')}`)
  }
}

async function isServerReady() {
  try {
    const response = await fetch(baseURL)
    return response.ok
  } catch {
    return false
  }
}

async function waitForServer() {
  const deadline = Date.now() + 120_000
  while (Date.now() < deadline) {
    if (server?.exitCode !== null) {
      throw new Error(`Development server exited with code ${server.exitCode}`)
    }
    if (await isServerReady()) return
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`Development server did not become ready at ${baseURL}`)
}

function slugify(value) {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function escapeRegex(value) {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
