import type { Id } from '../../convex/_generated/dataModel'
import { createFileRoute } from '@tanstack/react-router'
import { ProjectHome } from '../components/project-workspace'
import { authClient } from '../lib/auth-client'

export const Route = createFileRoute('/app/projects/$projectId/chats/$chatId')({
  component: ChatRoute,
})

function ChatRoute() {
  const { projectId, chatId } = Route.useParams()
  const { data: session } = authClient.useSession()
  if (!session) return null

  return (
    <ProjectHome
      email={session.user.email}
      projectId={projectId as Id<'projects'>}
      chatId={chatId as Id<'chats'>}
    />
  )
}
