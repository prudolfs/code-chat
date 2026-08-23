/* oxlint-disable no-underscore-dangle */

import { createGateway } from '@ai-sdk/gateway'
import { generateText } from 'ai'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import type { Doc, Id } from './_generated/dataModel'
import type { ActionCtx } from './_generated/server'
import { env } from './_generated/server'
import {
  requireIdentity,
  requireOwnedChat,
  requireOwnedProject,
} from './lib/auth'
import { createGatewayEmbeddingProvider } from './lib/embeddings'
import { convexProjectConfig } from './lib/project_config'
import { e2eTestMode } from './lib/e2e'
import {
  buildRetrievalContext,
  notEnoughIndexedContextMessage,
} from '../shared/retrieval'
import { buildChatPrompt, buildSourceCitations } from '../shared/chat'

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
      .take(50)
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

export const send = mutation({
  args: { chatId: v.id('chats'), content: v.string() },
  handler: async (ctx, args) => {
    const chat = await requireOwnedChat(ctx, args.chatId)
    const project = await requireOwnedProject(ctx, chat.projectId)
    const content = args.content.trim()

    if (!content) {
      throw new Error('Question cannot be empty')
    }
    if (
      project.status !== 'ready' &&
      project.status !== 'ready_with_warnings'
    ) {
      throw new Error('Project is not ready for chat yet')
    }

    const messageId = await ctx.db.insert('messages', {
      chatId: chat._id,
      projectId: chat.projectId,
      role: 'user',
      content,
    })
    await ctx.db.patch(chat._id, {
      title: chat.title === 'New chat' ? makeChatTitle(content) : chat.title,
      updatedAt: Date.now(),
    })
    await ctx.scheduler.runAfter(0, internal.chats.generateAnswer, {
      chatId: chat._id,
      userMessageId: messageId,
      question: content,
    })

    return messageId
  },
})

export const remove = mutation({
  args: { chatId: v.id('chats') },
  handler: async (ctx, args) => {
    const chat = await requireOwnedChat(ctx, args.chatId)
    const messages = await ctx.db
      .query('messages')
      .withIndex('by_chatId', (q) => q.eq('chatId', chat._id))
      .take(200)

    for (const message of messages) await ctx.db.delete(message._id)
    await ctx.db.delete(chat._id)
    return null
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
      .take(200)
  },
})

export const recentContext = internalQuery({
  args: { chatId: v.id('chats'), limit: v.number() },
  handler: async (ctx, args) => {
    const recentMessages = await ctx.db
      .query('messages')
      .withIndex('by_chatId', (q) => q.eq('chatId', args.chatId))
      .order('desc')
      .take(args.limit)

    return recentMessages.toReversed().map((message) => ({
      role: message.role,
      content: message.content,
    }))
  },
})

export const getChatForGeneration = internalQuery({
  args: { chatId: v.id('chats') },
  handler: async (ctx, args) => {
    const chat = await ctx.db.get(args.chatId)
    if (!chat) return null
    const project = await ctx.db.get(chat.projectId)
    if (!project) return null
    return { chat, project }
  },
})

export const saveAssistantMessage = internalMutation({
  args: {
    chatId: v.id('chats'),
    projectId: v.id('projects'),
    content: v.string(),
    sources: v.array(
      v.object({
        chunkId: v.id('chunks'),
        path: v.string(),
        startLine: v.number(),
        endLine: v.number(),
      }),
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const messageId = await ctx.db.insert('messages', {
      chatId: args.chatId,
      projectId: args.projectId,
      role: 'assistant',
      content: args.content,
      sources: args.sources,
      sourceChunkIds: args.sources.map((source) => source.chunkId),
      error: args.error,
    })
    await ctx.db.patch(args.chatId, { updatedAt: Date.now() })
    return messageId
  },
})

export const generateAnswer = internalAction({
  args: {
    chatId: v.id('chats'),
    userMessageId: v.id('messages'),
    question: v.string(),
  },
  handler: async (ctx, args) => {
    const record: GenerationRecord | null = await ctx.runQuery(
      internal.chats.getChatForGeneration,
      { chatId: args.chatId },
    )
    if (!record) return null
    void args.userMessageId

    const { chat, project } = record
    if (
      project.status !== 'ready' &&
      project.status !== 'ready_with_warnings'
    ) {
      await saveAssistantError(
        ctx,
        chat._id,
        project._id,
        'Project is not ready for chat yet',
      )
      return null
    }

    try {
      const embedding = await createGatewayEmbeddingProvider().embedText(
        args.question,
      )
      const chunks = await ctx.runAction(internal.vector_search.searchChunks, {
        projectId: project._id,
        embedding,
        limit: convexProjectConfig.retrieval.topK,
      })
      const retrieval = buildRetrievalContext(
        chunks,
        convexProjectConfig.retrieval,
      )

      if (!retrieval.hasEnoughContext) {
        await ctx.runMutation(internal.chats.saveAssistantMessage, {
          chatId: chat._id,
          projectId: project._id,
          content: notEnoughIndexedContextMessage,
          sources: [],
        })
        return null
      }

      const conversation = await ctx.runQuery(internal.chats.recentContext, {
        chatId: chat._id,
        limit: convexProjectConfig.retrieval.recentMessageLimit,
      })
      const prompt = buildChatPrompt({
        question: args.question,
        retrievedContext: retrieval.context,
        conversation,
      })
      const answer = e2eTestMode
        ? `Deterministic answer grounded in indexed code for: ${args.question}`
        : (
            await generateText({
              model: createGateway({
                apiKey: env.AI_GATEWAY_API_KEY,
              }).languageModel(convexProjectConfig.ai.chatModel),
              prompt,
              maxRetries: 2,
            })
          ).text
      const sources = buildSourceCitations(retrieval.chunks).map((source) => ({
        ...source,
        chunkId: source.chunkId as Id<'chunks'>,
      }))

      await ctx.runMutation(internal.chats.saveAssistantMessage, {
        chatId: chat._id,
        projectId: project._id,
        content: answer.trim() || notEnoughIndexedContextMessage,
        sources,
      })
    } catch {
      await saveAssistantError(
        ctx,
        chat._id,
        project._id,
        'Assistant response failed. Please try again.',
      )
    }

    return null
  },
})

type GenerationRecord = {
  chat: Doc<'chats'>
  project: Doc<'projects'>
}

function makeChatTitle(content: string) {
  return content.length > 48 ? `${content.slice(0, 45)}...` : content
}

async function saveAssistantError(
  ctx: ActionCtx,
  chatId: Id<'chats'>,
  projectId: Id<'projects'>,
  error: string,
) {
  await ctx.runMutation(internal.chats.saveAssistantMessage, {
    chatId,
    projectId,
    content: error,
    sources: [],
    error,
  })
}
