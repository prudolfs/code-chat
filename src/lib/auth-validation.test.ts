import { describe, expect, test } from 'vitest'
import { signInSchema, signUpSchema } from './auth-validation'

describe('auth validation', () => {
  test('normalizes valid sign-in credentials', () => {
    expect(
      signInSchema.parse({
        email: '  developer@example.com ',
        password: 'password123',
      }),
    ).toEqual({
      email: 'developer@example.com',
      password: 'password123',
    })
  })

  test('rejects an invalid email and short password', () => {
    const result = signInSchema.safeParse({
      email: 'not-an-email',
      password: 'short',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual([
        'email',
        'password',
      ])
    }
  })

  test('requires a non-empty sign-up name', () => {
    const result = signUpSchema.safeParse({
      email: 'developer@example.com',
      password: 'password123',
      name: '   ',
    })

    expect(result.success).toBe(false)
  })
})
