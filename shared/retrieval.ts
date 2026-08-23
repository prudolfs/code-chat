export const notEnoughIndexedContextMessage =
  "I don't have enough indexed context"

export type RetrievedChunk = {
  id: string
  score: number
  path: string
  startLine: number
  endLine: number
  content: string
}

export type RetrievalLimits = {
  topK: number
  maxContextChars: number
  minRelevanceScore: number
}

export type RetrievalContext = {
  chunks: RetrievedChunk[]
  context: string
  hasEnoughContext: boolean
}

export function buildRetrievalContext(
  input: readonly RetrievedChunk[],
  limits: RetrievalLimits,
): RetrievalContext {
  const chunks: RetrievedChunk[] = []
  let context = ''
  const ranked = input
    .filter((chunk) => chunk.score >= limits.minRelevanceScore)
    // oxlint-disable-next-line unicorn/no-array-sort
    .sort((left, right) => right.score - left.score)

  for (const chunk of ranked.slice(0, limits.topK)) {
    const source = `// ${chunk.path}:${chunk.startLine}-${chunk.endLine}\n${chunk.content}`
    const separator = context.length > 0 ? '\n\n' : ''
    if (
      context.length + separator.length + source.length >
      limits.maxContextChars
    ) {
      const remaining =
        limits.maxContextChars - context.length - separator.length
      if (remaining <= 0) break
      context += separator + source.slice(0, remaining)
      chunks.push(chunk)
      break
    }
    context += separator + source
    chunks.push(chunk)
  }

  return {
    chunks,
    context,
    hasEnoughContext: chunks.length > 0,
  }
}
