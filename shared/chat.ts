import type { RetrievedChunk } from './retrieval'

export type ConversationMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type SourceCitation = {
  chunkId: string
  path: string
  startLine: number
  endLine: number
}

export function buildSourceCitations(
  chunks: readonly RetrievedChunk[],
): SourceCitation[] {
  const seen = new Set<string>()
  const citations: SourceCitation[] = []

  for (const chunk of chunks) {
    const key = `${chunk.path}:${chunk.startLine}:${chunk.endLine}`
    if (seen.has(key)) continue
    seen.add(key)
    citations.push({
      chunkId: chunk.id,
      path: chunk.path,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
    })
  }

  return citations
}

export function buildChatPrompt({
  question,
  retrievedContext,
  conversation,
}: {
  question: string
  retrievedContext: string
  conversation: readonly ConversationMessage[]
}) {
  const history = conversation
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join('\n\n')

  return [
    'You are CodeChat, a code documentation assistant.',
    'Answer only from the retrieved indexed code context.',
    'If the context is insufficient, say that you do not have enough indexed context.',
    'When answering from code, cite relevant files using path:line-line.',
    '',
    '<retrieved_code_context>',
    retrievedContext,
    '</retrieved_code_context>',
    '',
    '<recent_conversation>',
    history || 'No previous messages.',
    '</recent_conversation>',
    '',
    '<question>',
    question,
    '</question>',
  ].join('\n')
}
