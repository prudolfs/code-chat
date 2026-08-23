import { createGateway } from '@ai-sdk/gateway'
import { embed, embedMany } from 'ai'
import type { EmbeddingProvider } from '../../shared/embeddings'
import { projectConfig } from '../../shared/project-config'

export function createGatewayEmbeddingProvider(): EmbeddingProvider {
  const gateway = createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY })
  const model = gateway.embeddingModel(projectConfig.ai.embeddingModel)

  return {
    async embedText(value) {
      const result = await embed({ model, value, maxRetries: 2 })
      return validateDimensions(result.embedding)
    },
    async embedTexts(values) {
      const result = await embedMany({
        model,
        values: [...values],
        maxRetries: 2,
      })
      return result.embeddings.map(validateDimensions)
    },
  }
}

function validateDimensions(embedding: number[]) {
  if (embedding.length !== projectConfig.ai.embeddingDimensions) {
    throw new Error('Embedding provider returned an unexpected dimension')
  }
  return embedding
}
