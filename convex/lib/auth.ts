import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

type AuthCtx = QueryCtx | MutationCtx

export async function requireIdentity(ctx: AuthCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new Error('Unauthenticated')
  }

  return identity
}

export async function requireOwnedProject(
  ctx: AuthCtx,
  projectId: Id<'projects'>,
): Promise<Doc<'projects'>> {
  const identity = await requireIdentity(ctx)
  const project = await ctx.db.get(projectId)

  if (!project || project.ownerTokenIdentifier !== identity.tokenIdentifier) {
    throw new Error('Project not found')
  }

  return project
}

export async function requireOwnedChat(
  ctx: AuthCtx,
  chatId: Id<'chats'>,
): Promise<Doc<'chats'>> {
  const identity = await requireIdentity(ctx)
  const chat = await ctx.db.get(chatId)

  if (!chat || chat.ownerTokenIdentifier !== identity.tokenIdentifier) {
    throw new Error('Chat not found')
  }

  return chat
}
