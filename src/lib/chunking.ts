import type { FilteredFile } from './file-filter'

export type ChunkMetadata<
  ProjectId extends string = string,
  FileId extends string = string,
> = {
  projectId: ProjectId
  fileId: FileId
  path: string
  extension: string
  content: string
  startLine: number
  endLine: number
  chunkIndex: number
}

export type ChunkingOptions = {
  maxLines?: number
  maxCharacters?: number
}

const defaultChunkingOptions: Required<ChunkingOptions> = {
  maxLines: 80,
  maxCharacters: 6000,
}

export function chunkFile<ProjectId extends string, FileId extends string>(
  file: Pick<FilteredFile, 'normalizedPath' | 'extension' | 'content'>,
  ids: { projectId: ProjectId; fileId: FileId },
  options: ChunkingOptions = {},
): ChunkMetadata<ProjectId, FileId>[] {
  const settings = { ...defaultChunkingOptions, ...options }
  const content =
    typeof file.content === 'string'
      ? file.content
      : new TextDecoder().decode(file.content)
  const lines = content.split(/\r?\n/)
  if (lines.length > 1 && lines.at(-1) === '') {
    lines.pop()
  }
  const chunks: ChunkMetadata<ProjectId, FileId>[] = []
  let start = 0

  while (start < lines.length) {
    let end = Math.min(start + settings.maxLines, lines.length)
    let chunkContent = lines.slice(start, end).join('\n')

    while (end > start + 1 && chunkContent.length > settings.maxCharacters) {
      end -= 1
      chunkContent = lines.slice(start, end).join('\n')
    }

    if (chunkContent.length > 0) {
      chunks.push({
        ...ids,
        path: file.normalizedPath,
        extension: file.extension,
        content: chunkContent,
        startLine: start + 1,
        endLine: end,
        chunkIndex: chunks.length,
      })
    }

    start = end
  }

  return chunks
}
