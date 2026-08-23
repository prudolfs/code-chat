import { expect, test } from 'vitest'
import { buildChatPrompt, buildSourceCitations } from '../../shared/chat'

test('chat prompt includes bounded conversation and retrieved code context', () => {
  const prompt = buildChatPrompt({
    question: 'How does auth work?',
    retrievedContext: '// convex/auth.ts:1-3\nexport const auth = true',
    conversation: [
      { role: 'user', content: 'What is this project?' },
      { role: 'assistant', content: 'A code documentation assistant.' },
    ],
  })

  expect(prompt).toContain('<retrieved_code_context>')
  expect(prompt).toContain('convex/auth.ts:1-3')
  expect(prompt).toContain('USER: What is this project?')
  expect(prompt).toContain('ASSISTANT: A code documentation assistant.')
  expect(prompt).toContain('<question>\nHow does auth work?\n</question>')
})

test('source citations are deduplicated by path and line range', () => {
  const citations = buildSourceCitations([
    {
      id: 'chunk-1',
      score: 0.9,
      path: 'src/index.ts',
      startLine: 1,
      endLine: 8,
      content: 'first',
    },
    {
      id: 'chunk-2',
      score: 0.8,
      path: 'src/index.ts',
      startLine: 1,
      endLine: 8,
      content: 'duplicate',
    },
  ])

  expect(citations).toEqual([
    {
      chunkId: 'chunk-1',
      path: 'src/index.ts',
      startLine: 1,
      endLine: 8,
    },
  ])
})
