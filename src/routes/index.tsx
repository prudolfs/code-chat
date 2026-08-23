import { api } from '../../convex/_generated/api'
import { useQuery } from 'convex/react'
import { FormEvent, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { authClient } from '../lib/auth-client'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) {
    return (
      <main className="grid min-h-screen place-items-center">Loading...</main>
    )
  }

  return session ? <ProjectHome email={session.user.email} /> : <AuthForm />
}

function AuthForm() {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [email, setEmail] = useState('demo@example.com')
  const [password, setPassword] = useState('password123')
  const [name, setName] = useState('Demo User')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const result =
      mode === 'sign-in'
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({ email, password, name })

    setIsSubmitting(false)
    if (result.error) {
      setError(result.error.message ?? 'Authentication failed')
    }
  }

  async function signInWith(provider: 'google' | 'github') {
    setError(null)
    const result = await authClient.signIn.social({ provider })
    if (result.error) {
      setError(result.error.message ?? 'Authentication failed')
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 p-6">
      <section className="w-full max-w-md space-y-6 rounded-xl border bg-background p-8 shadow-sm">
        <div>
          <p className="text-sm font-medium text-muted-foreground">CodeChat</p>
          <h1 className="mt-2 text-2xl font-semibold">
            {mode === 'sign-in'
              ? 'Sign in to your workspace'
              : 'Create your workspace'}
          </h1>
        </div>
        <form className="space-y-4" onSubmit={submit}>
          {mode === 'sign-up' && (
            <label className="grid gap-2 text-sm font-medium">
              Name
              <input
                className="rounded-md border px-3 py-2"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
          )}
          <label className="grid gap-2 text-sm font-medium">
            Email
            <input
              className="rounded-md border px-3 py-2"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Password
            <input
              className="rounded-md border px-3 py-2"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground"
            disabled={isSubmitting}
            type="submit"
          >
            {mode === 'sign-in' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        <div className="grid grid-cols-2 gap-3">
          <button
            className="rounded-md border px-3 py-2 text-sm"
            type="button"
            onClick={() => signInWith('google')}
          >
            Google
          </button>
          <button
            className="rounded-md border px-3 py-2 text-sm"
            type="button"
            onClick={() => signInWith('github')}
          >
            GitHub
          </button>
        </div>
        <button
          className="text-sm text-muted-foreground underline"
          type="button"
          onClick={() => setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}
        >
          {mode === 'sign-in' ? 'Need an account?' : 'Already have an account?'}
        </button>
      </section>
    </main>
  )
}

function ProjectHome({ email }: { email: string }) {
  const projects = useQuery(api.projects.list)

  return (
    <main className="min-h-screen bg-muted/30 p-6">
      <section className="mx-auto flex max-w-5xl items-center justify-between border-b pb-5">
        <div>
          <p className="text-sm text-muted-foreground">CodeChat</p>
          <h1 className="text-2xl font-semibold">Your projects</h1>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span>{email}</span>
          <button
            className="rounded-md border px-3 py-2"
            type="button"
            onClick={() => authClient.signOut()}
          >
            Sign out
          </button>
        </div>
      </section>
      <section className="mx-auto grid max-w-5xl gap-4 py-8 sm:grid-cols-2 lg:grid-cols-3">
        {projects?.map((project) => (
          <article
            className="rounded-lg border bg-background p-5"
            // oxlint-disable-next-line no-underscore-dangle
            key={project._creationTime}
          >
            <h2 className="font-medium">{project.name}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {project.sourceType} · {project.status}
            </p>
          </article>
        ))}
        {projects?.length === 0 && (
          <p className="text-muted-foreground">No projects yet.</p>
        )}
      </section>
    </main>
  )
}
