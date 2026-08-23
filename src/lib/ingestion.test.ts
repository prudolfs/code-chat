import { expect, test } from 'vitest'
import {
  defaultSupportedExtensions,
  buildProjectConfig,
} from '../../shared/project-config'
import { chunkFile } from './chunking'
import { parseGitHubRepository } from './github'
import {
  filterProjectFile,
  filterProjectFiles,
  isBinaryContent,
  isGeneratedFile,
  validateProjectLimits,
} from './file-filter'
import { normalizeProjectPath } from './path'

const config = buildProjectConfig({})

test('parses and canonicalizes public GitHub repository URLs', () => {
  expect(
    parseGitHubRepository('https://github.com/acme/code-chat.git'),
  ).toEqual({
    owner: 'acme',
    repository: 'code-chat',
    canonicalUrl: 'https://github.com/acme/code-chat',
  })
  expect(
    parseGitHubRepository('https://github.com/acme/code-chat/tree/main'),
  ).toBeNull()
  expect(parseGitHubRepository('https://gitlab.com/acme/code-chat')).toBeNull()
  expect(parseGitHubRepository('https://github.com/acme/%invalid')).toBeNull()
})

test('normalizes safe paths and rejects traversal', () => {
  expect(normalizeProjectPath('./src\\lib\\auth.ts')).toBe('src/lib/auth.ts')
  expect(normalizeProjectPath('src/../secret.ts')).toBeNull()
  expect(normalizeProjectPath('///')).toBeNull()
})

test('filters supported files and ignored directories', () => {
  const accepted = filterProjectFile(
    { path: 'src/index.ts', content: 'export const ok = true' },
    config.ingestion,
  )
  const ignored = filterProjectFile(
    { path: 'node_modules/pkg/index.js', content: 'ignored' },
    config.ingestion,
  )
  const unsupported = filterProjectFile(
    { path: 'assets/logo.svg', content: '<svg />' },
    config.ingestion,
  )

  expect('file' in accepted).toBe(true)
  expect(ignored).toEqual({
    rejection: {
      path: 'node_modules/pkg/index.js',
      reason: 'ignored-directory',
    },
  })
  expect(unsupported).toEqual({
    rejection: { path: 'assets/logo.svg', reason: 'unsupported-extension' },
  })
  expect(config.ingestion.supportedExtensions).toContain('.py')
  expect(defaultSupportedExtensions).toContain('.tsx')
})

test('detects binary and generated files', () => {
  expect(isBinaryContent('text\0binary')).toBe(true)
  expect(isBinaryContent(new Uint8Array([1, 2, 3]))).toBe(false)
  expect(
    isGeneratedFile('src/routeTree.gen.ts', 'export const routeTree = {}'),
  ).toBe(true)
  expect(isGeneratedFile('src/client.ts', '// automatically generated\n')).toBe(
    true,
  )
  expect(isGeneratedFile('src/client.ts', 'export const client = true')).toBe(
    false,
  )
})

test('enforces individual, count, and total project limits', () => {
  const limitedConfig = buildProjectConfig({
    PROJECT_MAX_ACCEPTED_FILES: '1',
    PROJECT_MAX_ACCEPTED_FILE_BYTES: '4',
    PROJECT_MAX_TOTAL_ACCEPTED_TEXT_BYTES: '5',
  }).ingestion
  const result = filterProjectFiles(
    [
      { path: 'a.ts', content: '12345' },
      { path: 'b.ts', content: '12345' },
    ],
    limitedConfig,
  )

  expect(result.rejected).toEqual([
    { path: 'a.ts', reason: 'file-too-large' },
    { path: 'b.ts', reason: 'file-too-large' },
  ])
  expect(
    validateProjectLimits(
      {
        accepted: [
          {
            path: 'a.ts',
            normalizedPath: 'a.ts',
            extension: '.ts',
            content: '123',
            sizeBytes: 3,
          },
          {
            path: 'b.ts',
            normalizedPath: 'b.ts',
            extension: '.ts',
            content: '123',
            sizeBytes: 3,
          },
        ],
        rejected: [],
        totalAcceptedBytes: 6,
      },
      limitedConfig,
    ),
  ).toEqual([
    { path: '*', reason: 'file-count-limit' },
    { path: '*', reason: 'total-size-limit' },
  ])
})

test('chunks files deterministically with one-based line ranges and metadata', () => {
  const file = {
    normalizedPath: 'src/example.ts',
    extension: '.ts',
    content: 'one\ntwo\nthree\nfour',
  }
  const options = { maxLines: 2, maxCharacters: 100 }

  expect(
    chunkFile(file, { projectId: 'project-1', fileId: 'file-1' }, options),
  ).toEqual([
    {
      projectId: 'project-1',
      fileId: 'file-1',
      path: 'src/example.ts',
      extension: '.ts',
      content: 'one\ntwo',
      startLine: 1,
      endLine: 2,
      chunkIndex: 0,
    },
    {
      projectId: 'project-1',
      fileId: 'file-1',
      path: 'src/example.ts',
      extension: '.ts',
      content: 'three\nfour',
      startLine: 3,
      endLine: 4,
      chunkIndex: 1,
    },
  ])
})
