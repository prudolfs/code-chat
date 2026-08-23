import { createGateway } from '@ai-sdk/gateway'
import { embed, embedMany } from 'ai'
import {
  createDeterministicEmbeddingProvider,
  type EmbeddingProvider,
} from '../../shared/embeddings'
import { convexProjectConfig } from './project_config'
import { e2eTestMode } from './e2e'
import { env } from '../_generated/server'

const maxEmbeddingsPerBatch = 128
const embeddingBatchDelayMs = 5_000

export function createGatewayEmbeddingProvider(): EmbeddingProvider {
  if (e2eTestMode) {
    return createDeterministicEmbeddingProvider(
      convexProjectConfig.ai.embeddingDimensions,
    )
  }

  const gateway = createGateway({ apiKey: env.AI_GATEWAY_API_KEY })
  const model = gateway.embeddingModel(convexProjectConfig.ai.embeddingModel)

  return {
    async embedText(value) {
      const result = await embed({ model, value, maxRetries: 2 })
      return validateDimensions(result.embedding)
    },
    async embedTexts(values) {
      const embeddings: number[][] = []
      for (
        let start = 0;
        start < values.length;
        start += maxEmbeddingsPerBatch
      ) {
        if (start > 0) await wait(embeddingBatchDelayMs)
        const result = await embedMany({
          model,
          values: values.slice(start, start + maxEmbeddingsPerBatch),
          maxRetries: 2,
        })
        embeddings.push(...result.embeddings.map(validateDimensions))
      }
      return embeddings
    },
  }
}

async function wait(milliseconds: number) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function validateDimensions(embedding: number[]) {
  if (embedding.length !== convexProjectConfig.ai.embeddingDimensions) {
    throw new Error('Embedding provider returned an unexpected dimension')
  }
  return embedding
}
