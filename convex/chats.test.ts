/// <reference types="vite/client" />
// @vitest-environment edge-runtime

import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'
import { api, internal } from './_generated/api'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')
const identity = {
  tokenIdentifier: 'test|phase-6-user',
  subject: 'phase-6-user',
  issuer: 'test',
}

test('creates a project-scoped chat and persists a user message', async () => {
  const t = convexTest(schema, modules)
  const authed = t.withIdentity(identity)
  const projectId = await authed.mutation(api.projects.create, {
    name: 'Phase 6 project',
    sourceType: 'local',
    fingerprint: 'phase-6-project',
  })
  await t.run(async (ctx) => {
    await ctx.db.patch(projectId, { status: 'ready' })
  })

  const chatId = await authed.mutation(api.chats.create, { projectId })
  await authed.mutation(api.chats.send, {
    chatId,
    content: '  How does routing work?  ',
  })

  const chats = await authed.query(api.chats.list, { projectId })
  const messages = await authed.query(api.chats.messages, { chatId })

  expect(chats).toHaveLength(1)
  expect(chats[0].projectId).toBe(projectId)
  expect(chats[0].title).toBe('How does routing work?')
  expect(messages).toMatchObject([
    {
      chatId,
      projectId,
      role: 'user',
      content: 'How does routing work?',
    },
  ])
})

test('persists assistant messages with citations and error state', async () => {
  const t = convexTest(schema, modules)
  const authed = t.withIdentity(identity)
  const projectId = await authed.mutation(api.projects.create, {
    name: 'Source project',
    sourceType: 'local',
    fingerprint: 'source-project',
  })
  const chatId = await authed.mutation(api.chats.create, { projectId })
  const chunkId = await t.run(async (ctx) => {
    const fileId = await ctx.db.insert('files', {
      projectId,
      path: 'src/routes/index.tsx',
      extension: '.tsx',
      content: 'export const Route = true',
      sizeBytes: 25,
    })
    return await ctx.db.insert('chunks', {
      projectId,
      fileId,
      content: 'export const Route = true',
      startLine: 1,
      endLine: 1,
      chunkIndex: 0,
      embedding: Array.from({ length: 1536 }, () => 0),
    })
  })

  await t.mutation(internal.chats.saveAssistantMessage, {
    chatId,
    projectId,
    content: 'Routing is declared in the root route.',
    sources: [
      {
        chunkId,
        path: 'src/routes/index.tsx',
        startLine: 1,
        endLine: 1,
      },
    ],
  })
  await t.mutation(internal.chats.saveAssistantMessage, {
    chatId,
    projectId,
    content: 'Assistant response failed. Please try again.',
    sources: [],
    error: 'Assistant response failed. Please try again.',
  })

  const messages = await authed.query(api.chats.messages, { chatId })

  expect(messages[0].sources).toEqual([
    {
      chunkId,
      path: 'src/routes/index.tsx',
      startLine: 1,
      endLine: 1,
    },
  ])
  expect(messages[0].sourceChunkIds).toEqual([chunkId])
  expect(messages[1].error).toBe('Assistant response failed. Please try again.')
})
