import { createFileRoute } from '@tanstack/react-router'
import { ProjectHome } from '../components/project-workspace'
import { authClient } from '../lib/auth-client'

export const Route = createFileRoute('/app/')({ component: AppIndexRoute })

function AppIndexRoute() {
  const { data: session } = authClient.useSession()
  if (!session) return null

  return <ProjectHome email={session.user.email} />
}
