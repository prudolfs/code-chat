import { unzipSync } from 'fflate'
import { v } from 'convex/values'
import { internal } from './_generated/api'
import {
  internalAction,
  internalMutation,
  internalQuery,
} from './_generated/server'
import type { ActionCtx } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { chunkFile } from '../src/lib/chunking'
import { createGatewayEmbeddingProvider } from './lib/embeddings'
import { convexProjectConfig } from './lib/project_config'
import {
  filterProjectFiles,
  validateProjectLimits,
  type IngestionFile,
} from '../src/lib/file-filter'
import { parseGitHubRepository } from '../src/lib/github'

export const getProject = internalQuery({
  args: { projectId: v.id('projects') },
  handler: async (ctx, args) => await ctx.db.get(args.projectId),
})

export const saveFile = internalMutation({
  args: {
    projectId: v.id('projects'),
    path: v.string(),
    extension: v.string(),
    content: v.string(),
    sizeBytes: v.number(),
  },
  handler: async (ctx, args) => await ctx.db.insert('files', args),
})

export const saveChunk = internalMutation({
  args: {
    projectId: v.id('projects'),
    fileId: v.id('files'),
    content: v.string(),
    startLine: v.number(),
    endLine: v.number(),
    chunkIndex: v.number(),
    embedding: v.optional(v.array(v.number())),
  },
  handler: async (ctx, args) => await ctx.db.insert('chunks', args),
})

export const setProgress = internalMutation({
  args: {
    projectId: v.id('projects'),
    filesProcessed: v.number(),
    totalFiles: v.number(),
    chunksEmbedded: v.number(),
    totalChunks: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.projectId, args)
  },
})

export const finish = internalMutation({
  args: {
    projectId: v.id('projects'),
    warnings: v.array(v.object({ path: v.string(), reason: v.string() })),
    failedFiles: v.array(v.object({ path: v.string(), reason: v.string() })),
    filesProcessed: v.number(),
    totalFiles: v.number(),
    chunksEmbedded: v.number(),
    totalChunks: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.projectId, {
      status: args.warnings.length > 0 ? 'ready_with_warnings' : 'ready',
      warnings: args.warnings,
      failedFiles: args.failedFiles,
      filesProcessed: args.filesProcessed,
      totalFiles: args.totalFiles,
      chunksEmbedded: args.chunksEmbedded,
      totalChunks: args.totalChunks,
      errorMessage: undefined,
      archiveStorageId: undefined,
    })
  },
})

export const fail = internalMutation({
  args: { projectId: v.id('projects'), errorMessage: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.projectId, {
      status: 'error',
      errorMessage: args.errorMessage,
      archiveStorageId: undefined,
    })
  },
})

export const run = internalAction({
  args: {
    projectId: v.id('projects'),
    archiveStorageId: v.optional(v.id('_storage')),
  },
  handler: async (ctx, args) => {
    const archiveStorageId = args.archiveStorageId

    try {
      const project = await ctx.runQuery(internal.ingestion.getProject, {
        projectId: args.projectId,
      })
      if (!project) {
        throw new Error('Project not found')
      }
      const embeddingProvider = createGatewayEmbeddingProvider()

      const archive = archiveStorageId
        ? await readStoredArchive(ctx, archiveStorageId)
        : await downloadGitHubArchive(project.sourceUrl)
      const files = archiveToFiles(archive)
      const filtered = filterProjectFiles(files, convexProjectConfig.ingestion)
      const accepted = filtered.accepted.slice(
        0,
        convexProjectConfig.ingestion.maxAcceptedFiles,
      )
      const warnings: { path: string; reason: string }[] = [
        ...filtered.rejected,
        ...validateProjectLimits(filtered, convexProjectConfig.ingestion),
      ]
      const acceptedWithinSizeLimit: typeof accepted = []
      let acceptedBytes = 0
      for (const file of accepted) {
        if (
          acceptedBytes + file.sizeBytes >
          convexProjectConfig.ingestion.maxTotalAcceptedTextBytes
        ) {
          warnings.push({
            path: file.normalizedPath,
            reason: 'total-size-limit',
          })
          continue
        }
        acceptedWithinSizeLimit.push(file)
        acceptedBytes += file.sizeBytes
      }

      const chunkedFiles = acceptedWithinSizeLimit.map((file) => ({
        file,
        chunks: chunkFile(file, {
          projectId: String(args.projectId),
          fileId: file.normalizedPath,
        }),
      }))
      const totalChunksBeforeLimit = chunkedFiles.reduce(
        (total, entry) => total + entry.chunks.length,
        0,
      )
      const limitedChunkedFiles: typeof chunkedFiles = []
      let chunksRemaining = convexProjectConfig.ingestion.maxChunksPerProject
      for (const entry of chunkedFiles) {
        const chunks = entry.chunks.slice(0, chunksRemaining)
        if (chunks.length < entry.chunks.length) {
          warnings.push({
            path: entry.file.normalizedPath,
            reason: 'chunk-count-limit',
          })
        }
        if (chunks.length > 0) {
          limitedChunkedFiles.push({ file: entry.file, chunks })
          chunksRemaining -= chunks.length
        }
      }
      const totalChunks = Math.min(
        totalChunksBeforeLimit,
        convexProjectConfig.ingestion.maxChunksPerProject,
      )

      await ctx.runMutation(internal.ingestion.setProgress, {
        projectId: args.projectId,
        filesProcessed: 0,
        totalFiles: limitedChunkedFiles.length,
        chunksEmbedded: 0,
        totalChunks,
      })

      let filesProcessed = 0
      let chunksEmbedded = 0
      for (const entry of limitedChunkedFiles) {
        const embeddings = await embeddingProvider.embedTexts(
          entry.chunks.map((chunk) => chunk.content),
        )
        const fileId = await ctx.runMutation(internal.ingestion.saveFile, {
          projectId: args.projectId,
          path: entry.file.normalizedPath,
          extension: entry.file.extension,
          content: decodeText(entry.file.content),
          sizeBytes: entry.file.sizeBytes,
        })

        for (const [chunkIndex, chunk] of entry.chunks.entries()) {
          await ctx.runMutation(internal.ingestion.saveChunk, {
            projectId: args.projectId,
            fileId,
            content: chunk.content,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            chunkIndex: chunk.chunkIndex,
            embedding: embeddings[chunkIndex],
          })
          chunksEmbedded += 1
        }

        filesProcessed += 1
        await ctx.runMutation(internal.ingestion.setProgress, {
          projectId: args.projectId,
          filesProcessed,
          totalFiles: limitedChunkedFiles.length,
          chunksEmbedded,
          totalChunks,
        })
      }

      await ctx.runMutation(internal.ingestion.finish, {
        projectId: args.projectId,
        warnings,
        failedFiles: warnings,
        filesProcessed,
        totalFiles: limitedChunkedFiles.length,
        chunksEmbedded,
        totalChunks,
      })
    } catch {
      await ctx.runMutation(internal.ingestion.fail, {
        projectId: args.projectId,
        errorMessage: 'Project indexing failed. Please try again.',
      })
    } finally {
      if (archiveStorageId) {
        try {
          await ctx.storage.delete(archiveStorageId)
        } catch {
          // Temporary cleanup should not replace the indexing result.
        }
      }
    }
  },
})

async function readStoredArchive(ctx: ActionCtx, storageId: Id<'_storage'>) {
  const blob = await ctx.storage.get(storageId)
  if (!blob) {
    throw new Error('Archive not found')
  }
  return new Uint8Array(await blob.arrayBuffer())
}

async function downloadGitHubArchive(sourceUrl?: string) {
  if (!sourceUrl) {
    throw new Error('GitHub URL not found')
  }
  const repository = parseGitHubRepository(sourceUrl)
  if (!repository) {
    throw new Error('Invalid GitHub URL')
  }

  const urls = [
    `https://github.com/${repository.owner}/${repository.repository}/archive/refs/heads/main.zip`,
    `https://github.com/${repository.owner}/${repository.repository}/archive/refs/heads/master.zip`,
  ]
  for (const url of urls) {
    const response = await fetch(url)
    if (response.ok) {
      return new Uint8Array(await response.arrayBuffer())
    }
  }
  throw new Error('GitHub archive download failed')
}

function archiveToFiles(archive: Uint8Array): IngestionFile[] {
  const entries = unzipSync(archive)
  return Object.entries(entries)
    .filter(([path]) => !path.endsWith('/'))
    .map(([path, content]) => ({ path, content }))
}

function decodeText(content: string | Uint8Array) {
  return typeof content === 'string'
    ? content
    : new TextDecoder().decode(content)
}
