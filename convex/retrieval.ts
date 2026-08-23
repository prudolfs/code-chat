import { v } from 'convex/values'
import { internal } from './_generated/api'
import { action } from './_generated/server'
import { createGatewayEmbeddingProvider } from './lib/embeddings'
import { requireIdentity } from './lib/auth'
import { projectConfig } from '../shared/project-config'
import {
  buildRetrievalContext,
  notEnoughIndexedContextMessage,
} from '../shared/retrieval'

export const retrieve = action({
  args: {
    projectId: v.id('projects'),
    question: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    const project = await ctx.runQuery(internal.ingestion.getProject, {
      projectId: args.projectId,
    })
    if (!project || project.ownerTokenIdentifier !== identity.tokenIdentifier) {
      throw new Error('Project not found')
    }

    const embedding = await createGatewayEmbeddingProvider().embedText(
      args.question,
    )
    const chunks = await ctx.runAction(internal.vector_search.searchChunks, {
      projectId: args.projectId,
      embedding,
      limit: projectConfig.retrieval.topK,
    })
    const context = buildRetrievalContext(chunks, projectConfig.retrieval)

    return {
      ...context,
      fallbackMessage: context.hasEnoughContext
        ? null
        : notEnoughIndexedContextMessage,
    }
  },
})
