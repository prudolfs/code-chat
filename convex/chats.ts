import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  requireIdentity,
  requireOwnedChat,
  requireOwnedProject,
} from './lib/auth'

export const list = query({
  args: { projectId: v.id('projects') },
  handler: async (ctx, args) => {
    await requireOwnedProject(ctx, args.projectId)
    return await ctx.db
      .query('chats')
      .withIndex('by_projectId_and_updatedAt', (q) =>
        q.eq('projectId', args.projectId),
      )
      .order('desc')
      .collect()
  },
})

export const create = mutation({
  args: { projectId: v.id('projects'), title: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx)
    await requireOwnedProject(ctx, args.projectId)

    return await ctx.db.insert('chats', {
      projectId: args.projectId,
      ownerTokenIdentifier: identity.tokenIdentifier,
      title: args.title?.trim() || 'New chat',
      updatedAt: Date.now(),
    })
  },
})

export const messages = query({
  args: { chatId: v.id('chats') },
  handler: async (ctx, args) => {
    await requireOwnedChat(ctx, args.chatId)
    return await ctx.db
      .query('messages')
      .withIndex('by_chatId', (q) => q.eq('chatId', args.chatId))
      .order('asc')
      .collect()
  },
})
