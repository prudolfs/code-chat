export function isProviderRateLimitError(value: unknown): boolean {
  return hasRateLimitSignal(value, new Set())
}

function hasRateLimitSignal(value: unknown, seen: Set<object>): boolean {
  if (typeof value === 'string') {
    return /rate.?limit|status(?:Code)?["': ]+429|HTTP 429/i.test(value)
  }
  if (!value || typeof value !== 'object' || seen.has(value)) return false
  seen.add(value)

  const record = value as Record<string, unknown>
  if (
    record.statusCode === 429 ||
    record.status === 429 ||
    record.type === 'rate_limit_exceeded'
  ) {
    return true
  }
  if (value instanceof Error && hasRateLimitSignal(value.message, seen)) {
    return true
  }

  return ['cause', 'lastError', 'errors', 'responseBody'].some((key) =>
    Array.isArray(record[key])
      ? record[key].some((item) => hasRateLimitSignal(item, seen))
      : hasRateLimitSignal(record[key], seen),
  )
}
