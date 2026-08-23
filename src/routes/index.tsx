/* oxlint-disable no-underscore-dangle */

import { api } from '../../convex/_generated/api'
import type { Id } from '../../convex/_generated/dataModel'
import { useMutation, useQuery } from 'convex/react'
import { FormEvent, useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { authClient } from '../lib/auth-client'
import { prepareProjectArchive } from '../lib/project-archive'
import { parseGitHubRepository } from '../lib/github'

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

type PendingImport = {
  name: string
  sourceType: 'local' | 'github'
  sourceUrl?: string
  fingerprint?: string
  archive?: Uint8Array
  warnings: { path: string; reason: string }[]
}

function ProjectHome({ email }: { email: string }) {
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

      <section className="mx-auto max-w-5xl py-8">
        <form
          className="grid gap-4 rounded-lg border bg-background p-5"
          onSubmit={prepareImport}
        >
          <div className="flex gap-2" role="group" aria-label="Project source">
            <button
              className={`rounded-md px-3 py-2 text-sm ${sourceType === 'local' ? 'bg-primary text-primary-foreground' : 'border'}`}
              type="button"
              onClick={() => setSourceType('local')}
            >
              Local folder
            </button>
            <button
              className={`rounded-md px-3 py-2 text-sm ${sourceType === 'github' ? 'bg-primary text-primary-foreground' : 'border'}`}
              type="button"
              onClick={() => setSourceType('github')}
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
                  onChange={(event) => setProjectName(event.target.value)}
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
                    setSelectedFiles(Array.from(event.target.files ?? []))
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
                onChange={(event) => setGithubUrl(event.target.value)}
                placeholder="https://github.com/owner/repository"
              />
            </label>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            className="w-fit rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
            type="submit"
            disabled={isImporting}
          >
            {isImporting ? 'Starting import...' : 'Import project'}
          </button>
        </form>
      </section>

      <ChatWorkspace
        projects={projects}
        onDeleteProject={(projectId) =>
          setProjectDialog({ projectId, mode: 'delete' })
        }
        onReviewWarnings={(projectId) =>
          setProjectDialog({ projectId, mode: 'warnings' })
        }
      />

      {duplicate && pendingImport && (
        <div className="fixed inset-0 grid place-items-center bg-black/40 p-6">
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
        <div className="fixed inset-0 grid place-items-center bg-black/40 p-6">
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
          }}
        />
      )}
    </main>
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
  onDeleteProject,
  onReviewWarnings,
}: {
  projects: ProjectSummary[] | undefined
  onDeleteProject: (projectId: Id<'projects'>) => void
  onReviewWarnings: (projectId: Id<'projects'>) => void
}) {
  const [selectedProjectId, setSelectedProjectId] =
    useState<Id<'projects'> | null>(null)
  const [selectedChatId, setSelectedChatId] = useState<Id<'chats'> | null>(null)
  const [question, setQuestion] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const createChat = useMutation(api.chats.create)
  const sendMessage = useMutation(api.chats.send)
  const removeChat = useMutation(api.chats.remove)
  const selectedProject =
    projects?.find((project) => project._id === selectedProjectId) ??
    projects?.[0] ??
    null
  const chats = useQuery(
    api.chats.list,
    selectedProject ? { projectId: selectedProject._id } : 'skip',
  )
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
    if (!selectedProjectId && projects && projects.length > 0) {
      setSelectedProjectId(projects[0]._id)
    }
  }, [projects, selectedProjectId])

  useEffect(() => {
    setSelectedChatId(null)
  }, [selectedProjectId])

  useEffect(() => {
    if (!selectedChatId && chats && chats.length > 0) {
      setSelectedChatId(chats[0]._id)
    }
  }, [chats, selectedChatId])

  async function createNewChat() {
    if (!selectedProject || !projectIsReady) return
    setError(null)
    const chatId = await createChat({ projectId: selectedProject._id })
    setSelectedChatId(chatId)
  }

  async function deleteChat(chatId: Id<'chats'>) {
    if (!window.confirm('Delete this chat and its messages?')) return
    setError(null)
    await removeChat({ chatId })
    if (selectedChatId === chatId) setSelectedChatId(null)
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

  if (projects === undefined) {
    return (
      <section className="mx-auto max-w-5xl text-sm text-muted-foreground">
        Loading projects...
      </section>
    )
  }

  if (projects.length === 0) {
    return (
      <section className="mx-auto max-w-5xl rounded-lg border bg-background p-8">
        <h2 className="text-lg font-semibold">No projects yet</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Import a local folder or public GitHub repository to create an indexed
          project. Chat opens after indexing finishes.
        </p>
      </section>
    )
  }

  return (
    <section className="mx-auto grid max-w-5xl gap-4 xl:grid-cols-[280px_1fr]">
      <aside className="min-w-0 rounded-lg border bg-background">
        <div className="border-b p-4">
          <h2 className="font-medium">Projects</h2>
        </div>
        <div className="max-h-72 overflow-auto p-2 xl:max-h-[34rem]">
          {projects.map((project) => (
            <button
              className={`mb-2 w-full min-w-0 rounded-md p-3 text-left text-sm ${project._id === selectedProject?._id ? 'bg-muted' : 'hover:bg-muted/60'}`}
              key={project._creationTime}
              type="button"
              onClick={() => setSelectedProjectId(project._id)}
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
                  Files {project.filesProcessed}/{project.totalFiles} · Chunks{' '}
                  {project.chunksEmbedded}/{project.totalChunks}
                </span>
              )}
              {project.status === 'error' && (
                <span className="mt-2 block text-xs text-destructive">
                  {project.errorMessage}
                </span>
              )}
            </button>
          ))}
        </div>
        {selectedProject && (
          <div className="space-y-2 border-t p-3">
            {selectedProject.status === 'ready_with_warnings' && (
              <button
                className="w-full rounded-md border px-3 py-2 text-sm"
                type="button"
                onClick={() => onReviewWarnings(selectedProject._id)}
              >
                Review warnings ({selectedProject.failedFiles.length})
              </button>
            )}
            <button
              className="w-full rounded-md border px-3 py-2 text-sm"
              type="button"
              onClick={() => onDeleteProject(selectedProject._id)}
            >
              Delete project
            </button>
          </div>
        )}
      </aside>

      <section className="grid min-h-[36rem] min-w-0 overflow-hidden rounded-lg border bg-background lg:grid-cols-[220px_1fr]">
        <aside className="border-b p-3 lg:border-r lg:border-b-0">
          <div className="mb-3 flex items-center justify-between gap-2">
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
          <div className="max-h-48 overflow-auto lg:max-h-[31rem]">
            {chats?.map((chat) => (
              <div
                className={`mb-2 flex items-center gap-1 rounded-md ${chat._id === selectedChatId ? 'bg-muted' : 'hover:bg-muted/60'}`}
                key={chat._id}
              >
                <button
                  className="min-w-0 flex-1 px-3 py-2 text-left text-sm"
                  type="button"
                  onClick={() => setSelectedChatId(chat._id)}
                >
                  <span className="block truncate">{chat.title}</span>
                </button>
                <button
                  className="mr-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-background hover:text-foreground"
                  type="button"
                  aria-label={`Delete ${chat.title}`}
                  onClick={() => deleteChat(chat._id)}
                >
                  Delete
                </button>
              </div>
            ))}
            {chats?.length === 0 && (
              <p className="text-sm text-muted-foreground">No chats yet.</p>
            )}
          </div>
        </aside>

        <div className="grid min-h-[36rem] grid-rows-[auto_1fr_auto]">
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
                  <p className="mt-2 text-xs text-destructive">
                    {message.error}
                  </p>
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
        </div>
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
    <div className="fixed inset-0 grid place-items-center bg-black/40 p-6">
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
