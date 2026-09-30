// Read-only workspace port.
//
// Shared workspace authority belongs to a daemon, not to this desktop shell.
// The default port is disconnected. It rejects. It does not read or write a
// local workspace JSON file, and it does not treat an empty result as success.

export const WORKSPACE_READ_DISCONNECTED = 'WORKSPACE_READ_DISCONNECTED'

export interface WorkspaceFileEntry {
  name: string
  path: string
  isDirectory: boolean
}

export interface WorkspaceFileRead {
  content?: string
  error?: string
  size?: number
}

export interface GitStatusEntry {
  status: string
  file: string
}

export interface GitLogEntry {
  hash: string
  author: string
  date: string
  message: string
}

export interface GitDiffQuery {
  cwd: string
  commitHash?: string
  filePath?: string
}

export interface DirListing {
  current: string
  parent: string | null
  entries: { name: string; path: string }[]
}

export interface QuickLocation {
  name: string
  path: string
  kind: 'home' | 'drive' | 'volume' | 'root'
}

export interface PathLinkResolution {
  rawPath: string
  path: string
  exists: boolean
  line?: number
  column?: number
}

export interface WorkspaceReadPort {
  /** Serialized workspace list. Not a file on this machine. */
  listWorkspaces(): Promise<string | null>
  listFiles(dirPath: string): Promise<WorkspaceFileEntry[]>
  readFile(filePath: string): Promise<WorkspaceFileRead>
  isDirectory(path: string): Promise<boolean>
  listDirs(dirPath: string, includeHidden: boolean): Promise<DirListing>
  searchFiles(dirPath: string, query: string, filesOnly?: boolean): Promise<WorkspaceFileEntry[]>
  resolvePathLinks(cwd: string, rawPaths: string[]): Promise<PathLinkResolution[]>
  home(): Promise<string>
  quickLocations(): Promise<QuickLocation[]>
  gitStatus(cwd: string): Promise<GitStatusEntry[]>
  gitDiff(query: GitDiffQuery): Promise<string>
  gitDiffFiles(query: { cwd: string; commitHash?: string }): Promise<GitStatusEntry[]>
  gitLog(cwd: string, count?: number): Promise<GitLogEntry[]>
  gitBranch(cwd: string): Promise<string | null>
  gitRoot(cwd: string): Promise<string | null>
  gitGithubUrl(folderPath: string): Promise<string | null>
  /** Agent-tied worktree status. Read-only. Not a create/remove/merge. */
  worktreeStatus(sessionId: string): Promise<unknown>
}

function disconnected(method: string): Promise<never> {
  return Promise.reject(new Error(
    `${WORKSPACE_READ_DISCONNECTED}: ${method} has no daemon. ` +
    'This client does not read or write a local workspace JSON file as shared authority.',
  ))
}

export class DisconnectedWorkspaceReadPort implements WorkspaceReadPort {
  listWorkspaces(): Promise<string | null> {
    return disconnected('listWorkspaces')
  }

  listFiles(): Promise<WorkspaceFileEntry[]> {
    return disconnected('listFiles')
  }

  readFile(): Promise<WorkspaceFileRead> {
    return disconnected('readFile')
  }

  isDirectory(): Promise<boolean> {
    return disconnected('isDirectory')
  }

  listDirs(): Promise<DirListing> {
    return disconnected('listDirs')
  }

  searchFiles(): Promise<WorkspaceFileEntry[]> {
    return disconnected('searchFiles')
  }

  resolvePathLinks(): Promise<PathLinkResolution[]> {
    return disconnected('resolvePathLinks')
  }

  home(): Promise<string> {
    return disconnected('home')
  }

  quickLocations(): Promise<QuickLocation[]> {
    return disconnected('quickLocations')
  }

  gitStatus(): Promise<GitStatusEntry[]> {
    return disconnected('gitStatus')
  }

  gitDiff(): Promise<string> {
    return disconnected('gitDiff')
  }

  gitDiffFiles(): Promise<GitStatusEntry[]> {
    return disconnected('gitDiffFiles')
  }

  gitLog(): Promise<GitLogEntry[]> {
    return disconnected('gitLog')
  }

  gitBranch(): Promise<string | null> {
    return disconnected('gitBranch')
  }

  gitRoot(): Promise<string | null> {
    return disconnected('gitRoot')
  }

  gitGithubUrl(): Promise<string | null> {
    return disconnected('gitGithubUrl')
  }

  worktreeStatus(): Promise<unknown> {
    return disconnected('worktreeStatus')
  }
}

let currentPort: WorkspaceReadPort = new DisconnectedWorkspaceReadPort()

export function getWorkspaceReadPort(): WorkspaceReadPort {
  return currentPort
}

export function setWorkspaceReadPort(port: WorkspaceReadPort): void {
  currentPort = port
}
