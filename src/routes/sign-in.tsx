import { Navigate, createFileRoute } from '@tanstack/react-router'
import { AuthForm } from '../components/project-workspace'
import { authClient } from '../lib/auth-client'

export const Route = createFileRoute('/sign-in')({ component: SignInRoute })

function SignInRoute() {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) {
    return (
      <main className="grid min-h-screen place-items-center">Loading...</main>
    )
  }

  if (session) return <Navigate to="/app" replace />

  return <AuthForm />
}
