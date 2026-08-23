import type { IngestionConfig } from '../../shared/project-config'
import { normalizeProjectPath } from './path'

export type IngestionFile = {
  path: string
  content: string | Uint8Array
  sizeBytes?: number
}

export type FileRejectionReason =
  | 'invalid-path'
  | 'ignored-directory'
  | 'unsupported-extension'
  | 'binary-content'
  | 'generated-file'
  | 'file-too-large'
  | 'file-count-limit'
  | 'total-size-limit'
  | 'chunk-count-limit'

export type FilteredFile = IngestionFile & {
  normalizedPath: string
  extension: string
  sizeBytes: number
}

export type RejectedFile = {
  path: string
  reason: FileRejectionReason
}

export type ProjectFilterResult = {
  accepted: FilteredFile[]
  rejected: RejectedFile[]
  totalAcceptedBytes: number
}

export function filterProjectFile(
  file: IngestionFile,
  config: IngestionConfig,
): { file: FilteredFile } | { rejection: RejectedFile } {
  const normalizedPath = normalizeProjectPath(file.path)
  if (!normalizedPath) {
    return { rejection: { path: file.path, reason: 'invalid-path' } }
  }

  const pathSegments = normalizedPath.split('/')
  if (
    pathSegments.some((segment) => config.ignoredDirectories.includes(segment))
  ) {
    return { rejection: { path: file.path, reason: 'ignored-directory' } }
  }

  const extension = getExtension(normalizedPath)
  if (!config.supportedExtensions.includes(extension)) {
    return { rejection: { path: file.path, reason: 'unsupported-extension' } }
  }

  if (isBinaryContent(file.content)) {
    return { rejection: { path: file.path, reason: 'binary-content' } }
  }

  if (isGeneratedFile(normalizedPath, file.content)) {
    return { rejection: { path: file.path, reason: 'generated-file' } }
  }

  const sizeBytes = file.sizeBytes ?? getByteLength(file.content)
  if (sizeBytes > config.maxAcceptedFileBytes) {
    return { rejection: { path: file.path, reason: 'file-too-large' } }
  }

  return {
    file: {
      ...file,
      normalizedPath,
      extension,
      sizeBytes,
    },
  }
}

export function filterProjectFiles(
  files: readonly IngestionFile[],
  config: IngestionConfig,
): ProjectFilterResult {
  const accepted: FilteredFile[] = []
  const rejected: RejectedFile[] = []

  for (const file of files) {
    const result = filterProjectFile(file, config)
    if ('file' in result) {
      accepted.push(result.file)
    } else {
      rejected.push(result.rejection)
    }
  }

  return {
    accepted,
    rejected,
    totalAcceptedBytes: accepted.reduce(
      (total, file) => total + file.sizeBytes,
      0,
    ),
  }
}

export function validateProjectLimits(
  result: ProjectFilterResult,
  config: IngestionConfig,
): RejectedFile[] {
  const violations: RejectedFile[] = []

  if (result.accepted.length > config.maxAcceptedFiles) {
    violations.push({
      path: '*',
      reason: 'file-count-limit',
    })
  }

  if (result.totalAcceptedBytes > config.maxTotalAcceptedTextBytes) {
    violations.push({
      path: '*',
      reason: 'total-size-limit',
    })
  }

  return violations
}

export function getExtension(path: string) {
  const filename = path.slice(path.lastIndexOf('/') + 1)
  const dotIndex = filename.lastIndexOf('.')
  return dotIndex > 0 ? filename.slice(dotIndex).toLowerCase() : ''
}

export function isBinaryContent(content: string | Uint8Array) {
  if (typeof content === 'string') {
    return content.includes('\0')
  }

  for (const byte of content) {
    if (byte === 0) {
      return true
    }
  }

  return false
}

export function isGeneratedFile(path: string, content: string | Uint8Array) {
  const lowerPath = path.toLowerCase()
  if (
    /(^|\/)(routeTree\.gen|.*\.generated|.*\.gen)\.[^/]+$/.test(lowerPath) ||
    /(^|\/)generated\//.test(lowerPath)
  ) {
    return true
  }

  if (typeof content !== 'string') {
    return false
  }

  return /automatically generated|do not edit|@generated/i.test(
    content.slice(0, 2000),
  )
}

function getByteLength(content: string | Uint8Array) {
  return typeof content === 'string'
    ? new TextEncoder().encode(content).byteLength
    : content.byteLength
}
