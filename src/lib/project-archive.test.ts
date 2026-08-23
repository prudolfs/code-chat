import { unzipSync } from 'fflate'
import { expect, test } from 'vitest'
import { prepareProjectArchive } from './project-archive'

test('prepares a filtered local archive and reports skipped files', async () => {
  const files = [
    new File(['export const app = true'], 'src/app.ts'),
    new File(['ignored dependency'], 'node_modules/pkg/index.js'),
    new File(['<svg />'], 'assets/logo.svg'),
  ]

  const prepared = await prepareProjectArchive(files)
  const entries = unzipSync(prepared.archive)

  expect(Object.keys(entries)).toEqual(['src/app.ts'])
  expect(prepared.acceptedFileCount).toBe(1)
  expect(prepared.warnings).toEqual([
    { path: 'node_modules/pkg/index.js', reason: 'ignored-directory' },
    { path: 'assets/logo.svg', reason: 'unsupported-extension' },
  ])
  expect(prepared.fingerprint).toMatch(/^[0-9a-f]{64}$/)
})
