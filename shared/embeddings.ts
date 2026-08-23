export type EmbeddingProvider = {
  embedText(value: string): Promise<number[]>
  embedTexts(values: readonly string[]): Promise<number[][]>
}

export function createDeterministicEmbedding(value: string, dimensions = 1536) {
  const vector = Array.from({ length: dimensions }, (_, index) => {
    let hash = 2166136261 ^ index
    for (let offset = 0; offset < value.length; offset += 1) {
      hash ^= value.charCodeAt(offset) + index
      hash = Math.imul(hash, 16777619)
    }
    return ((hash >>> 0) / 0xffffffff) * 2 - 1
  })
  const magnitude = Math.sqrt(
    vector.reduce((sum, item) => sum + item * item, 0),
  )
  return vector.map((item) => item / (magnitude || 1))
}

export function createDeterministicEmbeddingProvider(
  dimensions = 1536,
): EmbeddingProvider {
  return {
    async embedText(value) {
      return createDeterministicEmbedding(value, dimensions)
    },
    async embedTexts(values) {
      return values.map((value) =>
        createDeterministicEmbedding(value, dimensions),
      )
    },
  }
}
