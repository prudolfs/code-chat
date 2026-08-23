import { zipSync } from 'fflate'
import { projectConfig } from './project-config'
import {
  filterProjectFiles,
  validateProjectLimits,
  type IngestionFile,
  type RejectedFile,
} from './file-filter'

export type PreparedProjectArchive = {
  archive: Uint8Array
  warnings: RejectedFile[]
  fingerprint: string
  acceptedFileCount: number
}

export async function prepareProjectArchive(
  files: readonly File[],
): Promise<PreparedProjectArchive> {
  const ingestionFiles: IngestionFile[] = await Promise.all(
    files.map(async (file) => ({
      path: file.webkitRelativePath || file.name,
      content: new Uint8Array(await file.arrayBuffer()),
      sizeBytes: file.size,
    })),
  )
  const filtered = filterProjectFiles(ingestionFiles, projectConfig.ingestion)
  const accepted = filtered.accepted.slice(
    0,
    projectConfig.ingestion.maxAcceptedFiles,
  )
  const warnings = [
    ...filtered.rejected,
    ...validateProjectLimits(filtered, projectConfig.ingestion),
  ]
  const entries: Record<string, Uint8Array> = {}
  for (const file of accepted) {
    entries[file.normalizedPath] =
      typeof file.content === 'string'
        ? new TextEncoder().encode(file.content)
        : file.content
  }

  return {
    archive: zipSync(entries),
    warnings,
    fingerprint: await fingerprintFiles(accepted),
    acceptedFileCount: accepted.length,
  }
}

async function fingerprintFiles(
  files: readonly { normalizedPath: string; sizeBytes: number }[],
) {
  const input = files
    .map((file) => `${file.normalizedPath}:${file.sizeBytes}`)
    // oxlint-disable-next-line unicorn/no-array-sort
    .sort()
    .join('|')
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(input),
  )
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}
