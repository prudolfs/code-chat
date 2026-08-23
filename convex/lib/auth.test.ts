import { expect, test, vi } from 'vitest'
import { requireIdentity, requireOwnedProject } from './auth'

function createContext(identity: unknown, project: unknown) {
  return {
    auth: {
      getUserIdentity: vi.fn().mockResolvedValue(identity),
    },
    db: {
      get: vi.fn().mockResolvedValue(project),
    },
  } as never
}

test('rejects unauthenticated access', async () => {
  const ctx = createContext(null, null)

  await expect(requireIdentity(ctx)).rejects.toThrow('Unauthenticated')
})

test('rejects a project owned by another identity', async () => {
  const ctx = createContext(
    { tokenIdentifier: 'issuer|current-user' },
    { _id: 'projects|other', ownerTokenIdentifier: 'issuer|other-user' },
  )

  await expect(
    requireOwnedProject(ctx, 'projects|other' as never),
  ).rejects.toThrow('Project not found')
})

test('returns a project owned by the current identity', async () => {
  const project = {
    _id: 'projects|owned',
    ownerTokenIdentifier: 'issuer|current-user',
  }
  const ctx = createContext({ tokenIdentifier: 'issuer|current-user' }, project)

  await expect(
    requireOwnedProject(ctx, 'projects|owned' as never),
  ).resolves.toBe(project)
})
