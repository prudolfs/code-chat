import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
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
    })
  },
})
