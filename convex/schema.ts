import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

const projectStatus = v.union(
  v.literal('pending'),
  v.literal('indexing'),
  v.literal('ready'),
  v.literal('ready_with_warnings'),
  v.literal('error'),
)

export default defineSchema({
  projects: defineTable({
    ownerTokenIdentifier: v.string(),
    name: v.string(),
    sourceType: v.union(v.literal('local'), v.literal('github')),
    sourceUrl: v.optional(v.string()),
    fingerprint: v.optional(v.string()),
    status: projectStatus,
    warnings: v.array(v.object({ path: v.string(), reason: v.string() })),
    failedFiles: v.array(v.object({ path: v.string(), reason: v.string() })),
    filesProcessed: v.number(),
    totalFiles: v.number(),
    chunksEmbedded: v.number(),
    totalChunks: v.number(),
    errorMessage: v.optional(v.string()),
    archiveStorageId: v.optional(v.id('_storage')),
  })
    .index('by_ownerTokenIdentifier', ['ownerTokenIdentifier'])
    .index('by_ownerTokenIdentifier_and_sourceUrl', [
      'ownerTokenIdentifier',
      'sourceUrl',
    ]),

  files: defineTable({
    projectId: v.id('projects'),
    path: v.string(),
    extension: v.string(),
    content: v.string(),
    sizeBytes: v.number(),
  })
    .index('by_projectId', ['projectId'])
    .index('by_projectId_and_path', ['projectId', 'path']),

  chunks: defineTable({
    projectId: v.id('projects'),
    fileId: v.id('files'),
    content: v.string(),
    startLine: v.number(),
    endLine: v.number(),
    chunkIndex: v.number(),
    embedding: v.optional(v.array(v.number())),
  })
    .index('by_projectId', ['projectId'])
    .index('by_fileId', ['fileId'])
    .index('by_projectId_and_fileId', ['projectId', 'fileId'])
    .vectorIndex('by_embedding', {
      vectorField: 'embedding',
      dimensions: 1536,
      filterFields: ['projectId'],
    }),

  chats: defineTable({
    projectId: v.id('projects'),
    ownerTokenIdentifier: v.string(),
    title: v.string(),
    updatedAt: v.number(),
  })
    .index('by_ownerTokenIdentifier', ['ownerTokenIdentifier'])
    .index('by_projectId', ['projectId'])
    .index('by_projectId_and_updatedAt', ['projectId', 'updatedAt']),

  messages: defineTable({
    chatId: v.id('chats'),
    projectId: v.id('projects'),
    role: v.union(v.literal('user'), v.literal('assistant')),
    content: v.string(),
    sources: v.optional(
      v.array(
        v.object({
          chunkId: v.id('chunks'),
          path: v.string(),
          startLine: v.number(),
          endLine: v.number(),
        }),
      ),
    ),
    error: v.optional(v.string()),
    sourceChunkIds: v.optional(v.array(v.id('chunks'))),
  })
    .index('by_chatId', ['chatId'])
    .index('by_projectId', ['projectId']),
})
