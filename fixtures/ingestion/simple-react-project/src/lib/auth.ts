export function requireUser(sessionUserId: string | null) {
  if (!sessionUserId) {
    throw new Error('Authentication required')
  }

  return sessionUserId
}
