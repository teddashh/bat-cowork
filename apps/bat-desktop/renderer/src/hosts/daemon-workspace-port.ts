// Read-only workspace port backed by a daemon.
// It does not create workspaces, send to agents, or write files.
// Methods with no daemon read throw. They do not pretend the result is empty.

import type {
  DirListing,
  GitDiffQuery,
  GitLogEntry,
  GitStatusEntry,
  PathLinkResolution,
  QuickLocation,
  WorkspaceFileEntry,
  WorkspaceFileRead,
  WorkspaceReadPort,
} from './workspace-read-port'

export const DAEMON_READ_UNSUPPORTED = 'DAEMON_READ_UNSUPPORTED'

export interface DaemonWorkspaceEntry {
  id: string
  name: string
  projectRootPath: string
  workspaceDirectory?: string
  activityAt?: string | null
}

export interface DaemonDirectoryEntry {
  name: string
  path: string
  kind: string
}

export interface DaemonDiffFile {
  path: string
  isNew?: boolean
  isDeleted?: boolean
  hunks?: readonly { lines?: readonly { content?: string }[] }[]
}

export interface DaemonWorkspaceSource {
  fetchWorkspaces(): Promise<{ entries: readonly DaemonWorkspaceEntry[] }>
  listDirectory(cwd: string, path: string): Promise<{ entries: readonly DaemonDirectoryEntry[] }>
  readFile(cwd: string, path: string): Promise<{ bytes?: Uint8Array; content?: string; size?: number }>
  getCheckoutDiff(
    cwd: string,
    compare: { mode: 'uncommitted' | 'base'; baseRef?: string },
  ): Promise<{ files?: readonly DaemonDiffFile[]; error?: { message?: string } | null }>
  getCheckoutStatus(cwd: string): Promise<{
    isGit?: boolean
    currentBranch?: string | null
    repoRoot?: string | null
    remoteUrl?: string | null
  }>
}

function unsupported(method: string): Promise<never> {
  return Promise.reject(new Error(
    `${DAEMON_READ_UNSUPPORTED}: ${method} is not a daemon read this port implements`,
  ))
}

function splitPath(value: string): { dir: string; name: string } {
  const slash = Math.max(value.lastIndexOf('/'), value.lastIndexOf('\\'))
  if (slash <= 0) return { dir: value, name: value }
  return { dir: value.slice(0, slash), name: value.slice(slash + 1) }
}

export function serializeDaemonWorkspaces(entries: readonly DaemonWorkspaceEntry[]): string {
  const workspaces = entries.map((entry) => ({
    id: entry.id,
    name: entry.name,
    folderPath: entry.workspaceDirectory || entry.projectRootPath,
    createdAt: entry.activityAt ? Date.parse(entry.activityAt) || 0 : 0,
  }))
  return JSON.stringify({
    workspaces,
    terminals: [],
    activeWorkspaceId: workspaces[0]?.id ?? null,
  })
}

export function formatDaemonDiff(files: readonly DaemonDiffFile[]): string {
  const lines: string[] = []
  for (const file of files) {
    lines.push(`diff -- ${file.path}`)
    for (const hunk of file.hunks ?? []) {
      for (const line of hunk.lines ?? []) {
        if (line.content) lines.push(line.content)
      }
    }
  }
  return lines.join('\n')
}

function diffStatus(file: DaemonDiffFile): string {
  if (file.isNew) return 'A'
  if (file.isDeleted) return 'D'
  return 'M'
}

export class DaemonWorkspaceReadPort implements WorkspaceReadPort {
  constructor(private readonly source: DaemonWorkspaceSource) {}

  async listWorkspaces(): Promise<string | null> {
    const listed = await this.source.fetchWorkspaces()
    return serializeDaemonWorkspaces(listed.entries)
  }

  async listFiles(dirPath: string): Promise<WorkspaceFileEntry[]> {
    const listed = await this.source.listDirectory(dirPath, '.')
    return listed.entries.map((entry) => ({
      name: entry.name,
      path: entry.path,
      isDirectory: entry.kind === 'directory',
    }))
  }

  async readFile(filePath: string): Promise<WorkspaceFileRead> {
    const { dir, name } = splitPath(filePath)
    const file = await this.source.readFile(dir, name)
    const content = file.content ?? (file.bytes ? new TextDecoder().decode(file.bytes) : undefined)
    return { content, size: file.size }
  }

  async gitDiff(query: GitDiffQuery): Promise<string> {
    const diff = await this.source.getCheckoutDiff(query.cwd, {
      mode: query.commitHash ? 'base' : 'uncommitted',
      ...(query.commitHash ? { baseRef: query.commitHash } : {}),
    })
    if (diff.error?.message) throw new Error(diff.error.message)
    const files = query.filePath
      ? (diff.files ?? []).filter((file) => file.path === query.filePath)
      : diff.files ?? []
    return formatDaemonDiff(files)
  }

  async gitStatus(cwd: string): Promise<GitStatusEntry[]> {
    const diff = await this.source.getCheckoutDiff(cwd, { mode: 'uncommitted' })
    if (diff.error?.message) throw new Error(diff.error.message)
    return (diff.files ?? []).map((file) => ({ status: diffStatus(file), file: file.path }))
  }

  async gitDiffFiles(query: { cwd: string; commitHash?: string }): Promise<GitStatusEntry[]> {
    const diff = await this.source.getCheckoutDiff(query.cwd, {
      mode: query.commitHash ? 'base' : 'uncommitted',
      ...(query.commitHash ? { baseRef: query.commitHash } : {}),
    })
    if (diff.error?.message) throw new Error(diff.error.message)
    return (diff.files ?? []).map((file) => ({ status: diffStatus(file), file: file.path }))
  }

  async isDirectory(dirPath: string): Promise<boolean> {
    await this.source.listDirectory(dirPath, '.')
    return true
  }

  async gitBranch(cwd: string): Promise<string | null> {
    const status = await this.source.getCheckoutStatus(cwd)
    if (!status.isGit) return null
    return status.currentBranch ?? null
  }

  async gitRoot(cwd: string): Promise<string | null> {
    const status = await this.source.getCheckoutStatus(cwd)
    if (!status.isGit) return null
    return status.repoRoot ?? null
  }

  async gitGithubUrl(folderPath: string): Promise<string | null> {
    const status = await this.source.getCheckoutStatus(folderPath)
    return status.remoteUrl ?? null
  }

  // Checkout status has no commit list. GitPanel's load rejects the whole
  // panel if this throws, which would also hide the status and diff we can
  // read. An empty array means history was not fetched.
  gitLog(): Promise<GitLogEntry[]> {
    return Promise.resolve([])
  }

  listDirs(): Promise<DirListing> {
    return unsupported('listDirs')
  }

  searchFiles(): Promise<WorkspaceFileEntry[]> {
    return unsupported('searchFiles')
  }

  resolvePathLinks(): Promise<PathLinkResolution[]> {
    return unsupported('resolvePathLinks')
  }

  home(): Promise<string> {
    return unsupported('home')
  }

  quickLocations(): Promise<QuickLocation[]> {
    return unsupported('quickLocations')
  }

  worktreeStatus(): Promise<unknown> {
    return unsupported('worktreeStatus')
  }
}
