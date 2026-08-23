export type GitHubRepository = {
  owner: string
  repository: string
  canonicalUrl: string
}

const githubUrlPattern = /^https?:\/\/github\.com\/([^/]+)\/([^/?#]+)\/?$/i

export function parseGitHubRepository(value: string): GitHubRepository | null {
  const match = value.trim().match(githubUrlPattern)
  if (!match) {
    return null
  }

  let owner: string
  let repository: string
  try {
    owner = decodeURIComponent(match[1]).trim()
    repository = decodeURIComponent(match[2])
      .replace(/\.git$/i, '')
      .trim()
  } catch {
    return null
  }

  if (!isGitHubSegment(owner) || !isGitHubSegment(repository)) {
    return null
  }

  return {
    owner,
    repository,
    canonicalUrl: `https://github.com/${owner}/${repository}`,
  }
}

function isGitHubSegment(value: string) {
  return value.length > 0 && !/[\s/?#]/.test(value)
}
