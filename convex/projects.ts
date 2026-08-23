/* oxlint-disable no-underscore-dangle */

import { v } from 'convex/values'
import { internal } from './_generated/api'
import { mutation, query } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { requireIdentity, requireOwnedProject } from './lib/auth'

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx)
    return await ctx.db
      .query('projects')
      .withIndex('by_ownerTokenIdentifier', (q) =>
        q.eq('ownerTokenIdentifier', identity.tokenIdentifier),
      )
      .order('desc')
      .collect()
  },
})

export const get = query({
  args: { projectId: v.id('projects') },
  handler: async (ctx, args) => await requireOwnedProject(ctx, args.projectId),
})

export const create = mutation({
  args: {
    name: v.string(),
    sourceType: v.union(v.literal('local'), v.literal('github')),
    sourceUrl: v.optional(v.string()),
    fingerprint: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)

    return await ctx.db.insert('projects', {
      ...args,
      ownerTokenIdentifier: identity.tokenIdentifier,
      status: 'pending',
      warnings: [],
      failedFiles: [],
      filesProcessed: 0,
      totalFiles: 0,
      chunksEmbedded: 0,
      totalChunks: 0,
    })
  },
})

export const findDuplicate = query({
  args: {
    sourceType: v.union(v.literal('local'), v.literal('github')),
    sourceUrl: v.optional(v.string()),
    fingerprint: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const projects = await ctx.db
      .query('projects')
      .withIndex('by_ownerTokenIdentifier', (q) =>
        q.eq('ownerTokenIdentifier', identity.tokenIdentifier),
      )
      .collect()

    return (
      projects.find(
        (project) =>
          project.sourceType === args.sourceType &&
          ((args.sourceUrl && project.sourceUrl === args.sourceUrl) ||
            (args.fingerprint && project.fingerprint === args.fingerprint)),
      ) ?? null
    )
  },
})

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireIdentity(ctx)
    return await ctx.storage.generateUploadUrl()
  },
})

export const startImport = mutation({
  args: {
    projectId: v.id('projects'),
    archiveStorageId: v.optional(v.id('_storage')),
  },
  handler: async (ctx, args) => {
    const project = await requireOwnedProject(ctx, args.projectId)

    if (project.sourceType === 'local' && !args.archiveStorageId) {
      throw new Error('Local imports require an archive')
    }
    if (project.sourceType === 'github' && !project.sourceUrl) {
      throw new Error('GitHub imports require a repository URL')
    }

    await ctx.db.patch(args.projectId, {
      status: 'indexing',
      archiveStorageId: args.archiveStorageId,
      errorMessage: undefined,
    })
    await ctx.scheduler.runAfter(0, internal.ingestion.run, {
      projectId: args.projectId,
      archiveStorageId: args.archiveStorageId,
    })

    return args.projectId
  },
})

export const replace = mutation({
  args: {
    projectId: v.id('projects'),
    archiveStorageId: v.optional(v.id('_storage')),
  },
  handler: async (ctx, args) => {
    const project = await requireOwnedProject(ctx, args.projectId)
    if (project.sourceType === 'local' && !args.archiveStorageId) {
      throw new Error('Local replacements require an archive')
    }
    await clearProjectData(ctx, args.projectId)

    await ctx.db.patch(args.projectId, {
      status: 'indexing',
      warnings: [],
      failedFiles: [],
      filesProcessed: 0,
      totalFiles: 0,
      chunksEmbedded: 0,
      totalChunks: 0,
      errorMessage: undefined,
      archiveStorageId: args.archiveStorageId,
    })
    await ctx.scheduler.runAfter(0, internal.ingestion.run, {
      projectId: args.projectId,
      archiveStorageId: args.archiveStorageId,
    })

    return project._id
  },
})

export const remove = mutation({
  args: { projectId: v.id('projects') },
  handler: async (ctx, args) => {
    const project = await requireOwnedProject(ctx, args.projectId)
    await clearProjectData(ctx, args.projectId)
    if (project.archiveStorageId) {
      await ctx.storage.delete(project.archiveStorageId)
    }
    await ctx.db.delete(args.projectId)
    return null
  },
})

async function clearProjectData(ctx: MutationCtx, projectId: Id<'projects'>) {
  const files = await ctx.db
    .query('files')
    .withIndex('by_projectId', (q) => q.eq('projectId', projectId))
    .collect()
  const chunks = await ctx.db
    .query('chunks')
    .withIndex('by_projectId', (q) => q.eq('projectId', projectId))
    .collect()
  const chats = await ctx.db
    .query('chats')
    .withIndex('by_projectId', (q) => q.eq('projectId', projectId))
    .collect()

  for (const chunk of chunks) await ctx.db.delete(chunk._id)
  for (const file of files) await ctx.db.delete(file._id)
  for (const chat of chats) {
    const messages = await ctx.db
      .query('messages')
      .withIndex('by_chatId', (q) => q.eq('chatId', chat._id))
      .collect()
    for (const message of messages) await ctx.db.delete(message._id)
    await ctx.db.delete(chat._id)
  }
}
