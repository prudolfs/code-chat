/* oxlint-disable no-underscore-dangle */

import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction } from './_generated/server'
import { e2eTestMode } from './lib/e2e'

type SearchChunk = {
  id: string
  path: string
  startLine: number
  endLine: number
  content: string
  score: number
}

export const searchChunks = internalAction({
  args: {
    projectId: v.id('projects'),
    embedding: v.array(v.number()),
    limit: v.number(),
  },
  handler: async (ctx, args): Promise<SearchChunk[]> => {
    if (e2eTestMode) {
      const chunks: Omit<SearchChunk, 'score'>[] = await ctx.runQuery(
        internal.chunk_queries.loadProjectChunks,
        { projectId: args.projectId, limit: args.limit },
      )
      return chunks.map((chunk) => ({ ...chunk, score: 1 }))
    }

    const matches = await ctx.vectorSearch('chunks', 'by_embedding', {
      vector: args.embedding,
      limit: args.limit,
      filter: (q) => q.eq('projectId', args.projectId),
    })

    const chunks: Omit<SearchChunk, 'score'>[] = await ctx.runQuery(
      internal.chunk_queries.loadChunks,
      { chunkIds: matches.map((match) => match._id) },
    )

    return chunks.map((chunk, index) => ({
      ...chunk,
      score: matches[index]?._score ?? 0,
    }))
  },
})
