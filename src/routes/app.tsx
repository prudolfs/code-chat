import { Navigate, Outlet, createFileRoute } from '@tanstack/react-router'
import { authClient } from '../lib/auth-client'

export const Route = createFileRoute('/app')({ component: AppRoute })

function AppRoute() {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) {
    return (
      <main className="grid min-h-screen place-items-center">Loading...</main>
    )
  }

  if (!session) return <Navigate to="/sign-in" replace />

  return <Outlet />
}
