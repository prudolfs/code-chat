export function normalizeProjectPath(value: string): string | null {
  const normalizedSeparators = value.trim().replaceAll('\\', '/')
  const segments = normalizedSeparators.split('/')
  const result: string[] = []

  for (const segment of segments) {
    if (!segment || segment === '.') {
      continue
    }
    if (segment === '..') {
      return null
    }
    result.push(segment)
  }

  return result.length > 0 ? result.join('/') : null
}
