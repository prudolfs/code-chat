/* oxlint-disable no-underscore-dangle */

import { v } from 'convex/values'
import { internalQuery } from './_generated/server'

export const loadChunks = internalQuery({
  args: { chunkIds: v.array(v.id('chunks')) },
  handler: async (ctx, args) => {
    const chunks = await Promise.all(
      args.chunkIds.map(async (chunkId) => {
        const chunk = await ctx.db.get(chunkId)
        if (!chunk) return null
        const file = await ctx.db.get(chunk.fileId)
        if (!file) return null
        return {
          id: String(chunk._id),
          path: file.path,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          content: chunk.content,
        }
      }),
    )

    return chunks.filter(
      (chunk): chunk is NonNullable<typeof chunk> => chunk !== null,
    )
  },
})

export const loadProjectChunks = internalQuery({
  args: { projectId: v.id('projects'), limit: v.number() },
  handler: async (ctx, args) => {
    const chunks = await ctx.db
      .query('chunks')
      .withIndex('by_projectId', (q) => q.eq('projectId', args.projectId))
      .take(args.limit)
    const files = new Map(
      (
        await Promise.all(
          chunks.map(async (chunk) => await ctx.db.get(chunk.fileId)),
        )
      )
        .filter((file): file is NonNullable<typeof file> => file !== null)
        .map((file) => [file._id, file]),
    )

    return chunks.flatMap((chunk) => {
      const file = files.get(chunk.fileId)
      return file
        ? [
            {
              id: String(chunk._id),
              path: file.path,
              startLine: chunk.startLine,
              endLine: chunk.endLine,
              content: chunk.content,
            },
          ]
        : []
    })
  },
})
