import { expect, test } from 'vitest'
import {
  createDeterministicEmbeddingProvider,
  createDeterministicEmbedding,
} from '../../shared/embeddings'
import {
  buildRetrievalContext,
  notEnoughIndexedContextMessage,
} from '../../shared/retrieval'

test('deterministic fake embeddings are stable and normalized', async () => {
  const provider = createDeterministicEmbeddingProvider(8)
  const first = await provider.embedText('authentication')
  const second = await provider.embedText('authentication')

  expect(first).toEqual(second)
  expect(first).toHaveLength(8)
  expect(createDeterministicEmbedding('other', 8)).not.toEqual(first)
})

test('retrieval ranks, thresholds, and limits context by characters', () => {
  const result = buildRetrievalContext(
    [
      {
        id: 'low',
        score: 0.2,
        path: 'low.ts',
        startLine: 1,
        endLine: 2,
        content: 'ignore me',
      },
      {
        id: 'high',
        score: 0.9,
        path: 'auth.ts',
        startLine: 10,
        endLine: 12,
        content: 'const session = true',
      },
      {
        id: 'medium',
        score: 0.6,
        path: 'other.ts',
        startLine: 2,
        endLine: 4,
        content: 'const other = true',
      },
    ],
    { topK: 2, maxContextChars: 55, minRelevanceScore: 0.35 },
  )

  expect(result.hasEnoughContext).toBe(true)
  expect(result.chunks.map((chunk) => chunk.id)).toEqual(['high', 'medium'])
  expect(result.context.length).toBeLessThanOrEqual(55)
  expect(result.context).toContain('auth.ts:10-12')
  expect(result.context).not.toContain('low.ts')
  expect(notEnoughIndexedContextMessage).toContain('enough indexed context')
})

test('retrieval returns the explicit fallback when nothing meets the threshold', () => {
  const result = buildRetrievalContext(
    [
      {
        id: 'weak',
        score: 0.1,
        path: 'weak.ts',
        startLine: 1,
        endLine: 1,
        content: 'weak',
      },
    ],
    { topK: 8, maxContextChars: 1000, minRelevanceScore: 0.35 },
  )

  expect(result).toEqual({ chunks: [], context: '', hasEnoughContext: false })
})
