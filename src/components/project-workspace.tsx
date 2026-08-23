/* oxlint-disable no-underscore-dangle */

import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { useMutation, useQuery } from 'convex/react'
import { Trash2 } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { authClient } from '../lib/auth-client'
import { signInSchema, signUpSchema } from '../lib/auth-validation'
import { prepareProjectArchive } from '../lib/project-archive'
import { parseGitHubRepository } from '../lib/github'

export function AuthForm() {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const parsed =
      mode === 'sign-in'
        ? signInSchema.safeParse({ email, password })
        : signUpSchema.safeParse({ email, password, name })

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check your details.')
      return
    }

    setIsSubmitting(true)
    try {
      const result =
        mode === 'sign-in'
          ? await authClient.signIn.email({
              email: parsed.data.email,
              password: parsed.data.password,
              callbackURL: '/app',
            })
          : await authClient.signUp.email({
              email: parsed.data.email,
              password: parsed.data.password,
              name: name.trim(),
              callbackURL: '/app',
            })

      if (result.error) {
        setError(result.error.message ?? 'Authentication failed.')
      }
    } catch {
      setError('Unable to reach the authentication service. Try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function signInWith(provider: 'google' | 'github') {
    setError(null)
    setIsSubmitting(true)
    try {
      const result = await authClient.signIn.social({
        provider,
        callbackURL: '/app',
      })
      if (result.error) {
        setError(result.error.message ?? 'Authentication failed.')
      }
    } catch {
      setError('Unable to reach the authentication service. Try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 p-6">
      <section className="w-full max-w-md space-y-6 rounded-lg border bg-background p-8 shadow-sm">
        <div>
          <p className="text-sm font-medium text-muted-foreground">CodeChat</p>
          <h1 className="mt-2 text-2xl font-semibold">
            {mode === 'sign-in'
              ? 'Sign in to your workspace'
              : 'Create your workspace'}
          </h1>
        </div>
        <div
          className="grid grid-cols-2 rounded-md bg-muted p-1"
          role="tablist"
          aria-label="Authentication mode"
        >
          {(['sign-in', 'sign-up'] as const).map((nextMode) => (
            <button
              key={nextMode}
              className={`rounded-sm px-3 py-2 text-sm font-medium ${mode === nextMode ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}
              type="button"
              role="tab"
              aria-selected={mode === nextMode}
              disabled={isSubmitting}
              onClick={() => {
                setMode(nextMode)
                setError(null)
              }}
            >
              {nextMode === 'sign-in' ? 'Sign in' : 'Sign up'}
            </button>
          ))}
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
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
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
            className="flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm"
            type="button"
            disabled={isSubmitting}
            onClick={() => signInWith('google')}
          >
            <GoogleIcon />
            Google
          </button>
          <button
            className="flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm"
            type="button"
            disabled={isSubmitting}
            onClick={() => signInWith('github')}
          >
            <GitHubIcon />
            GitHub
          </button>
        </div>
      </section>
    </main>
  )
}

function GoogleIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-[17px]"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.98-.9 6.63-2.37l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.39 13.92A6.02 6.02 0 0 1 6.08 12c0-.67.11-1.32.31-1.92V7.46H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.54l3.35-2.62Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.95c1.47 0 2.79.5 3.82 1.49l2.88-2.88A9.65 9.65 0 0 0 12 2a10 10 0 0 0-8.96 5.46l3.35 2.62C7.18 7.71 9.39 5.95 12 5.95Z"
      />
    </svg>
  )
}

function GitHubIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-[17px] fill-current"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.87c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.54 9.54 0 0 1 12 6.82a9.6 9.6 0 0 1 2.5.34c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.86v2.76c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
    </svg>
  )
}

type PendingImport = {
  name: string
  sourceType: 'local' | 'github'
  sourceUrl?: string
  fingerprint?: string
  archive?: Uint8Array
  warnings: { path: string; reason: string }[]
}

export function ProjectHome({
  email,
  projectId: routeProjectId,
  chatId: routeChatId,
}: {
  email: string
  projectId?: Id<'projects'>
  chatId?: Id<'chats'>
}) {
  const navigate = useNavigate()
  const projects = useQuery(api.projects.list)
  const createProject = useMutation(api.projects.create)
  const generateUploadUrl = useMutation(api.projects.generateUploadUrl)
  const startImport = useMutation(api.projects.startImport)
  const replaceProject = useMutation(api.projects.replace)
  const removeProject = useMutation(api.projects.remove)
  const [sourceType, setSourceType] = useState<'local' | 'github'>('local')
  const [projectName, setProjectName] = useState('My project')
  const [githubUrl, setGithubUrl] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null)
  const [duplicateRequest, setDuplicateRequest] = useState<{
    sourceType: 'local' | 'github'
    sourceUrl?: string
    fingerprint?: string
  } | null>(null)
  const [projectDialog, setProjectDialog] = useState<{
    projectId: Id<'projects'>
    mode: 'warnings' | 'delete'
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [showImportPanel, setShowImportPanel] = useState(false)
  const duplicate = useQuery(
    api.projects.findDuplicate,
    duplicateRequest ?? 'skip',
  )

  async function prepareImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (sourceType === 'github') {
      const repository = parseGitHubRepository(githubUrl)
      if (!repository) {
        setError(
          'Enter a public GitHub repository URL like https://github.com/owner/repository.',
        )
        return
      }
      const nextImport: PendingImport = {
        name: repository.repository,
        sourceType: 'github',
        sourceUrl: repository.canonicalUrl,
        warnings: [],
      }
      setPendingImport(nextImport)
      setDuplicateRequest({
        sourceType: 'github',
        sourceUrl: repository.canonicalUrl,
      })
      return
    }

    if (selectedFiles.length === 0) {
      setError('Choose a project folder before importing.')
      return
    }
    const prepared = await prepareProjectArchive(selectedFiles)
    const nextImport: PendingImport = {
      name: projectName.trim() || 'Local project',
      sourceType: 'local',
      fingerprint: prepared.fingerprint,
      archive: prepared.archive,
      warnings: prepared.warnings,
    }
    setPendingImport(nextImport)
    setDuplicateRequest({
      sourceType: 'local',
      fingerprint: prepared.fingerprint,
    })
  }

  async function uploadArchive(archive: Uint8Array) {
    const uploadUrl = await generateUploadUrl({})
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: archive.buffer as ArrayBuffer,
      headers: { 'Content-Type': 'application/zip' },
    })
    if (!response.ok) {
      throw new Error('Project upload failed')
    }
    const result: unknown = await response.json()
    if (
      !result ||
      typeof result !== 'object' ||
      !('storageId' in result) ||
      typeof result.storageId !== 'string'
    ) {
      throw new Error('Project upload failed')
    }
    return result.storageId as never
  }

  async function completeImport(action: 'create' | 'replace') {
    if (!pendingImport) return
    setError(null)
    setIsImporting(true)
    try {
      let projectId
      if (action === 'replace' && duplicate) {
        if (pendingImport.archive) {
          const archiveStorageId = await uploadArchive(pendingImport.archive)
          await replaceProject({ projectId: duplicate._id, archiveStorageId })
        } else {
          await replaceProject({ projectId: duplicate._id })
        }
      } else {
        projectId = await createProject({
          name: pendingImport.name,
          sourceType: pendingImport.sourceType,
          sourceUrl: pendingImport.sourceUrl,
          fingerprint: pendingImport.fingerprint,
        })
        const archiveStorageId = pendingImport.archive
          ? await uploadArchive(pendingImport.archive)
          : undefined
        await startImport({ projectId, archiveStorageId })
      }
      setPendingImport(null)
      setDuplicateRequest(null)
      setSelectedFiles([])
      setShowImportPanel(false)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Project import failed. Check the selected folder or repository URL and try again.',
      )
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <main className="min-h-screen bg-muted/30 p-4 sm:p-6">
      <section className="mx-auto flex max-w-5xl flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">CodeChat</p>
          <h1 className="text-2xl font-semibold">Your projects</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="min-w-0 break-all">{email}</span>
          <button
            className="rounded-md border px-3 py-2"
            type="button"
            onClick={() => authClient.signOut()}
          >
            Sign out
          </button>
        </div>
      </section>

      {projects === undefined ? (
        <section className="mx-auto max-w-6xl py-8 text-sm text-muted-foreground">
          Loading projects...
        </section>
      ) : projects.length === 0 ? (
        <section className="mx-auto max-w-2xl py-8">
          <ImportProjectPanel
            error={error}
            githubUrl={githubUrl}
            isImporting={isImporting}
            projectName={projectName}
            selectedFiles={selectedFiles}
            sourceType={sourceType}
            onGithubUrlChange={setGithubUrl}
            onProjectNameChange={setProjectName}
            onSelectedFilesChange={setSelectedFiles}
            onSourceTypeChange={setSourceType}
            onSubmit={prepareImport}
          />
        </section>
      ) : (
        <ChatWorkspace
          projects={projects}
          routeProjectId={routeProjectId}
          routeChatId={routeChatId}
          onAddProject={() => {
            setError(null)
            setShowImportPanel(true)
          }}
          onDeleteProject={(projectId) =>
            setProjectDialog({ projectId, mode: 'delete' })
          }
          onReviewWarnings={(projectId) =>
            setProjectDialog({ projectId, mode: 'warnings' })
          }
        />
      )}

      {projects && projects.length > 0 && showImportPanel && (
        <div className="fixed inset-0 z-10 grid place-items-center bg-black/40 p-6">
          <section
            className="w-full max-w-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Add project"
          >
            <ImportProjectPanel
              error={error}
              githubUrl={githubUrl}
              isImporting={isImporting}
              projectName={projectName}
              selectedFiles={selectedFiles}
              sourceType={sourceType}
              onCancel={() => setShowImportPanel(false)}
              onGithubUrlChange={setGithubUrl}
              onProjectNameChange={setProjectName}
              onSelectedFilesChange={setSelectedFiles}
              onSourceTypeChange={setSourceType}
              onSubmit={prepareImport}
            />
          </section>
        </div>
      )}

      {duplicate && pendingImport && (
        <div className="fixed inset-0 z-20 grid place-items-center bg-black/40 p-6">
          <section
            className="w-full max-w-md space-y-4 rounded-lg border bg-background p-6 shadow-lg"
            role="dialog"
            aria-modal="true"
          >
            <h2 className="text-lg font-semibold">Project already exists</h2>
            <p className="text-sm text-muted-foreground">
              Choose whether to create another project or replace the existing
              index for {duplicate.name}.
            </p>
            <div className="flex justify-end gap-3">
              <button
                className="rounded-md border px-3 py-2 text-sm"
                type="button"
                disabled={isImporting}
                onClick={() => completeImport('create')}
              >
                Create duplicate
              </button>
              <button
                className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
                type="button"
                disabled={isImporting}
                onClick={() => completeImport('replace')}
              >
                Replace and re-index
              </button>
            </div>
          </section>
        </div>
      )}

      {duplicate === null && pendingImport && (
        <div className="fixed inset-0 z-20 grid place-items-center bg-black/40 p-6">
          <section
            className="w-full max-w-md space-y-4 rounded-lg border bg-background p-6 shadow-lg"
            role="dialog"
            aria-modal="true"
          >
            <h2 className="text-lg font-semibold">Ready to import</h2>
            <p className="text-sm text-muted-foreground">
              {pendingImport.name} is ready. Unsupported, ignored, or generated
              files will be skipped with warnings.
            </p>
            {pendingImport.warnings.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {pendingImport.warnings.length} files or limits will produce
                warnings.
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                className="rounded-md border px-3 py-2 text-sm"
                type="button"
                onClick={() => {
                  setPendingImport(null)
                  setDuplicateRequest(null)
                }}
              >
                Cancel
              </button>
              <button
                className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
                type="button"
                disabled={isImporting}
                onClick={() => completeImport('create')}
              >
                Start indexing
              </button>
            </div>
          </section>
        </div>
      )}

      {projectDialog && (
        <WarningDialog
          mode={projectDialog.mode}
          project={projects?.find(
            (item) => item._id === projectDialog.projectId,
          )}
          onClose={() => setProjectDialog(null)}
          onDelete={async () => {
            await removeProject({ projectId: projectDialog.projectId })
            setProjectDialog(null)
            await navigate({ to: '/app' })
          }}
        />
      )}
    </main>
  )
}

function ImportProjectPanel({
  error,
  githubUrl,
  isImporting,
  projectName,
  selectedFiles,
  sourceType,
  onCancel,
  onGithubUrlChange,
  onProjectNameChange,
  onSelectedFilesChange,
  onSourceTypeChange,
  onSubmit,
}: {
  error: string | null
  githubUrl: string
  isImporting: boolean
  projectName: string
  selectedFiles: File[]
  sourceType: 'local' | 'github'
  onCancel?: () => void
  onGithubUrlChange: (value: string) => void
  onProjectNameChange: (value: string) => void
  onSelectedFilesChange: (files: File[]) => void
  onSourceTypeChange: (sourceType: 'local' | 'github') => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>
}) {
  return (
    <form
      className="grid gap-4 rounded-lg border bg-background p-5 shadow-sm"
      onSubmit={onSubmit}
    >
      <div>
        <h2 className="text-lg font-semibold">Import a project</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a local folder or public GitHub repository to start chatting
          with your codebase.
        </p>
      </div>
      <div className="flex gap-2" role="group" aria-label="Project source">
        <button
          className={`rounded-md px-3 py-2 text-sm ${sourceType === 'local' ? 'bg-primary text-primary-foreground' : 'border'}`}
          type="button"
          onClick={() => onSourceTypeChange('local')}
        >
          Local folder
        </button>
        <button
          className={`rounded-md px-3 py-2 text-sm ${sourceType === 'github' ? 'bg-primary text-primary-foreground' : 'border'}`}
          type="button"
          onClick={() => onSourceTypeChange('github')}
        >
          GitHub URL
        </button>
      </div>
      {sourceType === 'local' ? (
        <>
          <label className="grid gap-2 text-sm font-medium">
            Project name
            <input
              className="rounded-md border px-3 py-2"
              value={projectName}
              onChange={(event) => onProjectNameChange(event.target.value)}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Project folder
            <input
              {...({ webkitdirectory: '', directory: '' } as Record<
                string,
                string
              >)}
              className="rounded-md border px-3 py-2"
              type="file"
              multiple
              onChange={(event) =>
                onSelectedFilesChange(Array.from(event.target.files ?? []))
              }
            />
          </label>
          {selectedFiles.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {selectedFiles.length} files selected. Unsupported and ignored
              files will be skipped.
            </p>
          )}
        </>
      ) : (
        <label className="grid gap-2 text-sm font-medium">
          Public GitHub repository URL
          <input
            className="rounded-md border px-3 py-2"
            value={githubUrl}
            onChange={(event) => onGithubUrlChange(event.target.value)}
            placeholder="https://github.com/owner/repository"
          />
        </label>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-3">
        {onCancel && (
          <button
            className="rounded-md border px-4 py-2"
            type="button"
            disabled={isImporting}
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
        <button
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
          type="submit"
          disabled={isImporting}
        >
          {isImporting ? 'Starting import...' : 'Import project'}
        </button>
      </div>
    </form>
  )
}

type ProjectSummary = {
  _id: Id<'projects'>
  _creationTime: number
  name: string
  sourceType: 'local' | 'github'
  status: 'pending' | 'indexing' | 'ready' | 'ready_with_warnings' | 'error'
  failedFiles: { path: string; reason: string }[]
  filesProcessed: number
  totalFiles: number
  chunksEmbedded: number
  totalChunks: number
  errorMessage?: string
}

function ChatWorkspace({
  projects,
  routeProjectId,
  routeChatId,
  onAddProject,
  onDeleteProject,
  onReviewWarnings,
}: {
  projects: ProjectSummary[]
  routeProjectId?: Id<'projects'>
  routeChatId?: Id<'chats'>
  onAddProject: () => void
  onDeleteProject: (projectId: Id<'projects'>) => void
  onReviewWarnings: (projectId: Id<'projects'>) => void
}) {
  const navigate = useNavigate()
  const [question, setQuestion] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const createChat = useMutation(api.chats.create)
  const sendMessage = useMutation(api.chats.send)
  const removeChat = useMutation(api.chats.remove)
  const selectedProject =
    projects?.find((project) => project._id === routeProjectId) ??
    projects?.[0] ??
    null
  const chats = useQuery(
    api.chats.list,
    selectedProject ? { projectId: selectedProject._id } : 'skip',
  )
  const selectedChatId =
    routeChatId && chats?.some((chat) => chat._id === routeChatId)
      ? routeChatId
      : null
  const messages = useQuery(
    api.chats.messages,
    selectedChatId ? { chatId: selectedChatId } : 'skip',
  )
  const projectIsReady =
    selectedProject?.status === 'ready' ||
    selectedProject?.status === 'ready_with_warnings'
  const inputDisabledReason = !selectedProject
    ? 'Select a project'
    : !projectIsReady
      ? projectStatusMessage(selectedProject)
      : !selectedChatId
        ? 'Start a chat first'
        : null
  const pendingAssistant =
    isSending ||
    (selectedChatId !== null &&
      (messages?.at(-1)?.role === 'user' || messages === undefined))

  useEffect(() => {
    if (
      projects &&
      projects.length > 0 &&
      !projects.some((project) => project._id === routeProjectId)
    ) {
      void navigate({
        to: '/app/projects/$projectId',
        params: { projectId: projects[0]._id },
        replace: true,
      })
    }
  }, [navigate, projects, routeProjectId])

  useEffect(() => {
    if (!routeChatId && selectedProject && chats && chats.length > 0) {
      void navigate({
        to: '/app/projects/$projectId/chats/$chatId',
        params: {
          projectId: selectedProject._id,
          chatId: chats[0]._id,
        },
        replace: true,
      })
    }
  }, [chats, navigate, routeChatId, selectedProject])

  useEffect(() => {
    if (
      routeChatId &&
      selectedProject &&
      chats &&
      !chats.some((chat) => chat._id === routeChatId)
    ) {
      void navigate({
        to: '/app/projects/$projectId',
        params: { projectId: selectedProject._id },
        replace: true,
      })
    }
  }, [chats, navigate, routeChatId, selectedProject])

  async function createNewChat() {
    if (!selectedProject || !projectIsReady) return
    setError(null)
    const chatId = await createChat({ projectId: selectedProject._id })
    await navigate({
      to: '/app/projects/$projectId/chats/$chatId',
      params: { projectId: selectedProject._id, chatId },
    })
  }

  async function deleteChat(chatId: Id<'chats'>) {
    if (!window.confirm('Delete this chat and its messages?')) return
    setError(null)
    await removeChat({ chatId })
    if (selectedChatId === chatId && selectedProject) {
      await navigate({
        to: '/app/projects/$projectId',
        params: { projectId: selectedProject._id },
      })
    }
  }

  async function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedChatId) return
    const content = question.trim()
    if (!content) return

    setQuestion('')
    setError(null)
    setIsSending(true)
    try {
      await sendMessage({ chatId: selectedChatId, content })
    } catch (cause) {
      setQuestion(content)
      setError(cause instanceof Error ? cause.message : 'Message failed')
    } finally {
      setIsSending(false)
    }
  }

  if (!selectedProject) return null

  return (
    <section className="mx-auto grid max-w-6xl gap-4 py-8 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="flex min-w-0 flex-col overflow-hidden rounded-lg border bg-background lg:min-h-[40rem]">
        <section className="border-b">
          <div className="flex items-center justify-between gap-2 border-b p-4">
            <h2 className="font-medium">Projects</h2>
            <button
              className="rounded-md border px-3 py-1.5 text-sm"
              type="button"
              onClick={onAddProject}
            >
              Add project
            </button>
          </div>
          <div className="max-h-64 overflow-auto p-2">
            {projects.map((project) => (
              <div
                className={`mb-2 flex min-w-0 items-center gap-1 rounded-md ${project._id === selectedProject._id ? 'bg-muted' : 'hover:bg-muted/60'}`}
                key={project._id}
              >
                <button
                  className="min-w-0 flex-1 p-3 text-left text-sm"
                  type="button"
                  onClick={() =>
                    navigate({
                      to: '/app/projects/$projectId',
                      params: { projectId: project._id },
                    })
                  }
                >
                  <span className="block font-medium break-words">
                    {project.name}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {project.sourceType} · {project.status}
                  </span>
                  {(project.status === 'indexing' ||
                    project.status === 'pending') && (
                    <span className="mt-2 block text-xs text-muted-foreground">
                      Files {project.filesProcessed}/{project.totalFiles} ·
                      Chunks {project.chunksEmbedded}/{project.totalChunks}
                    </span>
                  )}
                  {project.status === 'error' && (
                    <span className="mt-2 block text-xs text-destructive">
                      {project.errorMessage}
                    </span>
                  )}
                </button>
                <button
                  className="mr-2 grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-background hover:text-destructive"
                  type="button"
                  aria-label={`Delete project ${project.name}`}
                  title={`Delete project ${project.name}`}
                  onClick={() => onDeleteProject(project._id)}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
          {selectedProject.status === 'ready_with_warnings' && (
            <div className="border-t p-3">
              <button
                className="w-full rounded-md border px-3 py-2 text-sm"
                type="button"
                onClick={() => onReviewWarnings(selectedProject._id)}
              >
                Warnings ({selectedProject.failedFiles.length})
              </button>
            </div>
          )}
        </section>

        <section className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-2 border-b p-4">
            <h2 className="font-medium">Chats</h2>
            <button
              className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
              type="button"
              disabled={!projectIsReady}
              onClick={createNewChat}
            >
              New
            </button>
          </div>
          <div className="max-h-64 flex-1 overflow-auto p-2 lg:max-h-none">
            {chats?.map((chat) => (
              <div
                className={`mb-2 flex items-center gap-1 rounded-md ${chat._id === selectedChatId ? 'bg-muted' : 'hover:bg-muted/60'}`}
                key={chat._id}
              >
                <button
                  className="min-w-0 flex-1 px-3 py-2 text-left text-sm"
                  type="button"
                  onClick={() =>
                    navigate({
                      to: '/app/projects/$projectId/chats/$chatId',
                      params: {
                        projectId: selectedProject._id,
                        chatId: chat._id,
                      },
                    })
                  }
                >
                  <span className="block truncate">{chat.title}</span>
                </button>
                <button
                  className="mr-2 grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-background hover:text-destructive"
                  type="button"
                  aria-label={`Delete chat ${chat.title}`}
                  title={`Delete chat ${chat.title}`}
                  onClick={() => deleteChat(chat._id)}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
            ))}
            {chats?.length === 0 && (
              <p className="p-2 text-sm text-muted-foreground">No chats yet.</p>
            )}
          </div>
        </section>
      </aside>

      <section className="grid min-h-[40rem] min-w-0 grid-rows-[auto_1fr_auto] overflow-hidden rounded-lg border bg-background">
        <header className="border-b p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="font-medium break-words">
                {selectedProject?.name ?? 'Select a project'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {selectedProject
                  ? `${selectedProject.sourceType} project · ${projectStatusMessage(selectedProject)}`
                  : 'Choose an indexed project to chat.'}
              </p>
            </div>
            {selectedProject?.status === 'ready_with_warnings' && (
              <button
                className="w-fit rounded-md border px-3 py-2 text-sm"
                type="button"
                onClick={() => onReviewWarnings(selectedProject._id)}
              >
                Review warnings
              </button>
            )}
          </div>
        </header>

        <div className="space-y-4 overflow-auto p-4">
          {!selectedChatId && projectIsReady && (
            <button
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
              type="button"
              onClick={createNewChat}
            >
              Start a chat
            </button>
          )}
          {messages?.map((message) => (
            <article
              className={`max-w-full rounded-lg border p-3 text-sm sm:max-w-[85%] ${message.role === 'user' ? 'ml-auto bg-primary text-primary-foreground' : 'bg-muted'}`}
              key={message._id}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              {message.error && (
                <p className="mt-2 text-xs text-destructive">{message.error}</p>
              )}
              {message.sources && message.sources.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {message.sources.map((source) => (
                    <span
                      className="rounded-md border bg-background px-2 py-1 text-xs text-foreground"
                      key={`${message._id}-${source.path}-${source.startLine}`}
                    >
                      {source.path}:{source.startLine}-{source.endLine}
                    </span>
                  ))}
                </div>
              )}
            </article>
          ))}
          {pendingAssistant && selectedChatId && (
            <p className="text-sm text-muted-foreground">Thinking...</p>
          )}
        </div>

        <form className="border-t p-4" onSubmit={submitQuestion}>
          {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <input
              className="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm"
              value={question}
              disabled={inputDisabledReason !== null || isSending}
              placeholder={inputDisabledReason ?? 'Ask about this codebase'}
              onChange={(event) => setQuestion(event.target.value)}
            />
            <button
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
              type="submit"
              disabled={inputDisabledReason !== null || isSending}
            >
              Send
            </button>
          </div>
        </form>
      </section>
    </section>
  )
}

function projectStatusMessage(project: ProjectSummary) {
  if (project.status === 'pending') return 'Waiting to start indexing'
  if (project.status === 'indexing') {
    return `Indexing files ${project.filesProcessed}/${project.totalFiles}, chunks ${project.chunksEmbedded}/${project.totalChunks}`
  }
  if (project.status === 'ready') return 'Ready'
  if (project.status === 'ready_with_warnings') return 'Ready with warnings'
  return project.errorMessage ?? 'Import failed'
}

function WarningDialog({
  mode,
  project,
  onClose,
  onDelete,
}: {
  mode: 'warnings' | 'delete'
  project:
    | {
        name: string
        failedFiles: { path: string; reason: string }[]
      }
    | undefined
  onClose: () => void
  onDelete: () => Promise<void>
}) {
  if (!project) return null
  const isWarningReview = mode === 'warnings'
  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-black/40 p-6">
      <section
        className="max-h-[80vh] w-full max-w-lg space-y-4 overflow-auto rounded-lg border bg-background p-6 shadow-lg"
        role="dialog"
        aria-modal="true"
      >
        <h2 className="text-lg font-semibold">
          {isWarningReview
            ? 'Project imported with warnings'
            : 'Delete project?'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isWarningReview
            ? 'Some files could not be indexed. You can proceed with the available context or delete this project.'
            : `Deleting ${project.name} also removes its related chats, messages, files, and indexed chunks.`}
        </p>
        {isWarningReview && project.failedFiles.length > 0 && (
          <ul className="max-h-48 space-y-1 overflow-auto rounded-md bg-muted p-3 text-sm">
            {project.failedFiles.map((file) => (
              <li key={`${file.path}-${file.reason}`}>
                {file.path}: {file.reason}
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end gap-3">
          <button
            className="rounded-md border px-3 py-2 text-sm"
            type="button"
            onClick={onClose}
          >
            {isWarningReview ? 'Proceed with warnings' : 'Cancel'}
          </button>
          <button
            className="rounded-md bg-destructive px-3 py-2 text-sm text-white"
            type="button"
            onClick={onDelete}
          >
            Delete project
          </button>
        </div>
      </section>
    </div>
  )
}
