import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/app/projects/$projectId')({
  component: ProjectRoute,
})

function ProjectRoute() {
  return <Outlet />
}
