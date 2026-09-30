// BAT Cowork host adapter (W1).
//
// The renderer still imports { host, getHostKind, installTauriShim }.
// Native window, clipboard, dialog, and shell open/reveal go through Tauri
// invoke. Workspace reads go through hosts/workspace-read-port.ts, whose
// default implementation is disconnected and does not touch a local
// workspace JSON file. Agent spawn/stop, the BAT updater, and the old BAT
// remote server throw UNSUPPORTED_CAPABILITY. Nothing here returns a
// permissive success for an unported method.
//
// This is not an official Better Agent Terminal or Paseo build.

import { dispatchTauriNativeDrop } from './utils/tauri-native-drop'
import {
  DROPPED_HOST_NAMESPACES,
  callDroppedHost,
  unsupportedCapability,
} from './hosts/unsupported-capabilities.mjs'
import { getWorkspaceReadPort } from './hosts/workspace-read-port'
import { parseProcfile } from './utils/procfile-parser'

type BatAppAPI = any

export interface RemoteTunnelEndpoint {
  ready: boolean
  tunneled: boolean
  host: string
  port: number
  spawned: boolean
  error?: string
  output?: string
}

export type HostKind = 'tauri' | 'unknown'

interface TauriInternals { __TAURI_INTERNALS__?: unknown; __TAURI__?: unknown }

export function getHostKind(): HostKind {
  if (typeof globalThis === 'undefined') return 'unknown'
  const g = globalThis as unknown as { window?: unknown }
  const win = g.window as TauriInternals | undefined
  if (!win) return 'unknown'
  if (win.__TAURI_INTERNALS__ !== undefined || win.__TAURI__ !== undefined) return 'tauri'
  return 'unknown'
}

export const isTauri = (): boolean => getHostKind() === 'tauri'

export type TerminalViewportMode = 'desktop' | 'mobile'
export type TerminalViewportSource = 'desktop' | 'mobile'
export type TerminalViewportState = {
  mode: TerminalViewportMode
  cols: number
  rows: number
  updatedBy: TerminalViewportSource
  updatedAt: number
}
export type SetViewportModeOptions = {
  cols?: number
  rows?: number
  source: TerminalViewportSource
}

// Kept so existing renderer imports still resolve. Claude events are not
// delivered in this milestone; nothing invokes a Claude command with this.
const CLAUDE_EVENT_PAYLOAD_KEYS: Record<string, string> = {
  onMessage: 'message',
  onToolUse: 'toolCall',
  onToolResult: 'result',
  onResult: 'result',
  onTurnEnd: 'payload',
  onError: 'error',
  onStream: 'data',
  onStatus: 'meta',
  onCommands: 'commands',
  onModeChange: 'mode',
  onPermissionRequest: 'data',
  onAskUser: 'data',
  onPermissionResolved: 'toolUseId',
  onAskUserResolved: 'toolUseId',
  onHistory: 'items',
  onResumeLoading: 'loading',
  onSessionReset: '__none__',
  onRateLimit: 'info',
  onWorktreeInfo: 'payload',
  onPromptSuggestion: 'suggestion',
  onTask: 'task',
}

const CLAUDE_EVENT_PAYLOAD_FALLBACKS = new Set(['onHistory', 'onResumeLoading'])

export function resolveClaudeEventSecondArg(
  listenerKey: string,
  payload: Record<string, unknown>,
): unknown {
  const payloadKey = CLAUDE_EVENT_PAYLOAD_KEYS[listenerKey] || 'payload'
  if (payloadKey === '__none__') return undefined
  if (Object.prototype.hasOwnProperty.call(payload, payloadKey)) {
    return payload[payloadKey]
  }
  if (
    CLAUDE_EVENT_PAYLOAD_FALLBACKS.has(listenerKey)
    && Object.prototype.hasOwnProperty.call(payload, 'payload')
  ) {
    return payload.payload
  }
  return payload[payloadKey]
}

// Windows build number parsed from a "MAJOR.MINOR.BUILD" version string.
// Returns undefined (not 0) when the version is empty or unparsable.
export function parseWindowsBuildNumber(version: string): number | undefined {
  if (!version) return undefined
  const last = version.split('.').pop()
  if (!last) return undefined
  const build = Number(last)
  return Number.isFinite(build) ? build : undefined
}

function detectPlatform(): 'win32' | 'darwin' | 'linux' {
  if (typeof navigator === 'undefined') return 'linux'
  const p = (navigator as { platform?: string }).platform || ''
  if (/win/i.test(p)) return 'win32'
  if (/mac/i.test(p)) return 'darwin'
  return 'linux'
}

type Invoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>

const LOCAL_COMMANDS = new Set([
  'app_set_title',
  'dialog_confirm',
  'dialog_select_folder',
  'dialog_select_files',
  'dialog_select_images',
  'clipboard_write_text',
  'shell_open_external',
  'shell_open_path',
  'shell_reveal_path',
])

function readInvoke(): Invoke | null {
  const g = (globalThis as unknown as {
    window?: { __TAURI_INTERNALS__?: { invoke?: Invoke } }
  }).window
  const direct = g?.__TAURI_INTERNALS__?.invoke
  return typeof direct === 'function' ? direct : null
}

function invokeLocal<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!LOCAL_COMMANDS.has(cmd)) {
    unsupportedCapability(`invoke:${cmd}`)
  }
  const invoke = readInvoke()
  if (!invoke) {
    throw new Error(
      `host-api: local command ${cmd} requires the BAT Cowork Tauri shell`,
    )
  }
  return invoke<T>(cmd, args)
}

function droppedNamespace(namespace: string): unknown {
  return new Proxy({}, {
    get(_target, prop) {
      if (prop === 'then' || typeof prop === 'symbol') return undefined
      const key = String(prop)
      return (..._args: unknown[]) => callDroppedHost(namespace, key)
    },
  })
}

const DEVICE_SETTINGS_KEY = 'bat-cowork.device-settings.v1'

function readDeviceSettings(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(DEVICE_SETTINGS_KEY)
  } catch {
    return null
  }
}

function writeDeviceSettings(data: string): void {
  if (typeof localStorage === 'undefined') {
    throw new Error('host-api: device settings storage is not available')
  }
  localStorage.setItem(DEVICE_SETTINGS_KEY, data)
}

function isAbsoluteLocalPath(value: string): boolean {
  return /^(?:[a-zA-Z]:[\\/]|\\\\|\/)/.test(value)
}

const TAURI_DROP_PATH_TTL_MS = 5000
const TAURI_DROP_PATH_MAX = 200
type TauriDroppedPathEntry = {
  path: string
  name: string
  createdAt: number
  claimed: boolean
}
const tauriDroppedPathCache: TauriDroppedPathEntry[] = []
let tauriDropPathListenerInstalled = false

function basenameForPath(path: string): string {
  const trimmed = path.replace(/[/\\]+$/, '')
  const idx = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
  return idx >= 0 ? trimmed.slice(idx + 1) : trimmed
}

function pruneTauriDroppedPathCache(now = Date.now()): void {
  for (let i = tauriDroppedPathCache.length - 1; i >= 0; i--) {
    if (now - tauriDroppedPathCache[i].createdAt > TAURI_DROP_PATH_TTL_MS) {
      tauriDroppedPathCache.splice(i, 1)
    }
  }
  while (tauriDroppedPathCache.length > TAURI_DROP_PATH_MAX) {
    tauriDroppedPathCache.shift()
  }
}

export function registerTauriDroppedPaths(paths: string[], now = Date.now()): void {
  pruneTauriDroppedPathCache(now)
  for (const path of paths) {
    if (!isAbsoluteLocalPath(path)) continue
    const name = basenameForPath(path)
    if (!name) continue
    tauriDroppedPathCache.push({ path, name, createdAt: now, claimed: false })
  }
  pruneTauriDroppedPathCache(now)
}

function getPathFromRecentTauriDrop(file: File): string | null {
  pruneTauriDroppedPathCache()
  const name = (file as File & { name?: unknown }).name
  if (typeof name !== 'string' || !name) return null
  const matches = tauriDroppedPathCache.filter(entry => !entry.claimed && entry.name === name)
  if (matches.length !== 1) return null
  matches[0].claimed = true
  return matches[0].path
}

function getPathFromDroppedFile(file: File): string | null {
  const candidate = file as File & {
    path?: unknown
    mozFullPath?: unknown
  }
  for (const value of [candidate.path, candidate.mozFullPath]) {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed && isAbsoluteLocalPath(trimmed)) return trimmed
    }
  }
  return getPathFromRecentTauriDrop(file)
}

function installTauriDropPathCache(): void {
  if (tauriDropPathListenerInstalled) return
  tauriDropPathListenerInstalled = true
  import('@tauri-apps/api/webview')
    .then(({ getCurrentWebview }) =>
      getCurrentWebview().onDragDropEvent(event => {
        const payload = event.payload
        const position = 'position' in payload ? payload.position : null
        const scale = typeof window.devicePixelRatio === 'number' && window.devicePixelRatio > 0
          ? window.devicePixelRatio
          : 1
        const paths = 'paths' in payload ? payload.paths : []
        if (payload.type === 'drop') registerTauriDroppedPaths(paths)
        dispatchTauriNativeDrop({
          type: payload.type,
          paths,
          x: position ? position.x / scale : null,
          y: position ? position.y / scale : null,
        })
      }))
    .catch(() => {})
}

const workerBuffers = new Map<string, string>()

function buildHost(): BatAppAPI {
  const platform = detectPlatform()
  const reads = () => getWorkspaceReadPort()
  const ported: Record<string, unknown> = {
    platform,
    // Unknown until a local OS probe exists. Empty means unknown, not old Windows.
    systemVersion: '',
    settings: {
      // Device chrome only. This key is not a workspace document and is not
      // shared authority.
      load: async () => readDeviceSettings(),
      save: async (data: string) => {
        writeDeviceSettings(data)
      },
      getShellPath: () => unsupportedCapability('settings.getShellPath'),
      clearTerminalHistory: () => unsupportedCapability('settings.clearTerminalHistory'),
      detectCx: () => unsupportedCapability('settings.detectCx'),
    },
    shell: {
      openExternal: (url: string) => invokeLocal<void>('shell_open_external', { url }),
      openPath: (path: string) => invokeLocal<void>('shell_open_path', { path }),
      revealPath: (path: string) => invokeLocal<void>('shell_reveal_path', { path }),
      getPathForFile: (file: File) => getPathFromDroppedFile(file),
    },
    dialog: {
      confirm: (message: string, title?: string) =>
        invokeLocal<boolean>('dialog_confirm', { message, title }),
      selectFolder: () => invokeLocal<string[] | null>('dialog_select_folder'),
      selectImages: () => invokeLocal<string[]>('dialog_select_images'),
      selectFiles: () => invokeLocal<string[]>('dialog_select_files'),
    },
    clipboard: {
      writeText: (text: string) => invokeLocal<boolean>('clipboard_write_text', { text }),
      saveImage: () => unsupportedCapability('clipboard.saveImage'),
      writeImage: () => unsupportedCapability('clipboard.writeImage'),
      onCopyShortcut: (callback: () => void) => {
        if (typeof document === 'undefined') return () => {}
        const handler = (event: KeyboardEvent) => {
          if (event.defaultPrevented) return
          if (event.shiftKey || !(event.ctrlKey || event.metaKey)) return
          if (event.key.toLowerCase() !== 'c') return
          callback()
        }
        document.addEventListener('keydown', handler, true)
        return () => document.removeEventListener('keydown', handler, true)
      },
    },
    debug: {
      // No-op. There is no sidecar log and no BAT debug command.
      log: async (..._args: unknown[]) => {},
      openLogsFolder: () => unsupportedCapability('debug.openLogsFolder'),
      get isDebugMode() { return false },
      get isPtyInputTrace() { return false },
    },
    workspace: {
      load: () => reads().listWorkspaces(),
      save: () => unsupportedCapability('workspace.save'),
      detach: () => unsupportedCapability('workspace.detach'),
      reattach: () => unsupportedCapability('workspace.reattach'),
      moveToWindow: () => unsupportedCapability('workspace.moveToWindow'),
      // Null so the first render can mount. This shell has no detached window.
      getDetachedId: () => null,
      onDetached: () => unsupportedCapability('workspace.onDetached'),
      onReattached: () => unsupportedCapability('workspace.onReattached'),
      onReload: () => unsupportedCapability('workspace.onReload'),
    },
    system: {
      onResume: (cb: () => void) => {
        const win = typeof window !== 'undefined' ? window : null
        const doc = typeof document !== 'undefined' ? document : null
        if (!win?.addEventListener) return () => {}
        let hiddenAt = 0
        let lastFired = 0
        const fire = () => {
          const now = Date.now()
          if (now - lastFired < 1000) return
          lastFired = now
          cb()
        }
        const onVisibility = () => {
          if (!doc) return
          if (doc.visibilityState === 'hidden') {
            hiddenAt = Date.now()
            return
          }
          if (hiddenAt && Date.now() - hiddenAt > 5000) fire()
          hiddenAt = 0
        }
        const onFocus = () => {
          if (hiddenAt && Date.now() - hiddenAt > 5000) fire()
        }
        const onOnline = () => fire()
        doc?.addEventListener?.('visibilitychange', onVisibility)
        win.addEventListener('focus', onFocus)
        win.addEventListener('online', onOnline)
        return () => {
          doc?.removeEventListener?.('visibilitychange', onVisibility)
          win.removeEventListener('focus', onFocus)
          win.removeEventListener('online', onOnline)
        }
      },
      notify: () => unsupportedCapability('system.notify'),
    },
    app: {
      // This shell has one window, labeled main in tauri.conf.json.
      getWindowId: async () => (getHostKind() === 'tauri' ? 'main' : null),
      getWindowIndex: () => unsupportedCapability('app.getWindowIndex'),
      getLaunchProfile: () => unsupportedCapability('app.getLaunchProfile'),
      getWindowProfile: () => unsupportedCapability('app.getWindowProfile'),
      setTitle: (title: string) => invokeLocal<void>('app_set_title', { title }),
      resolveProfileWindowClose: () => unsupportedCapability('app.resolveProfileWindowClose'),
      onProfileWindowCloseRequested: () => unsupportedCapability('app.onProfileWindowCloseRequested'),
      onStatsRequested: () => unsupportedCapability('app.onStatsRequested'),
      newWindow: () => unsupportedCapability('app.newWindow'),
      takeFreshWindowFlag: () => unsupportedCapability('app.takeFreshWindowFlag'),
      focusNextWindow: () => unsupportedCapability('app.focusNextWindow'),
      openNewInstance: () => unsupportedCapability('app.openNewInstance'),
      restoreActiveProfiles: () => unsupportedCapability('app.restoreActiveProfiles'),
      setDockBadge: () => unsupportedCapability('app.setDockBadge'),
    },
    fs: {
      readFile: (filePath: string) => reads().readFile(filePath),
      readdir: (dirPath: string) => reads().listFiles(dirPath),
      isDirectory: (path: string) => reads().isDirectory(path),
      home: () => reads().home(),
      listDirs: (dirPath: string, includeHidden: boolean) =>
        reads().listDirs(dirPath, includeHidden),
      quickLocations: () => reads().quickLocations(),
      search: (dirPath: string, query: string, filesOnly = false) =>
        reads().searchFiles(dirPath, query, filesOnly),
      resolvePathLinks: (cwd: string, rawPaths: string[]) =>
        reads().resolvePathLinks(cwd, rawPaths),
      mkdir: () => unsupportedCapability('fs.mkdir'),
      deletePath: () => unsupportedCapability('fs.deletePath'),
      uploadToDir: () => unsupportedCapability('fs.uploadToDir'),
      downloadFile: () => unsupportedCapability('fs.downloadFile'),
      writeFile: () => unsupportedCapability('fs.writeFile'),
      watch: () => unsupportedCapability('fs.watch'),
      unwatch: () => unsupportedCapability('fs.unwatch'),
      onChanged: () => unsupportedCapability('fs.onChanged'),
    },
    git: {
      getGithubUrl: (folderPath: string) => reads().gitGithubUrl(folderPath),
      getBranch: (cwd: string) => reads().gitBranch(cwd),
      getLog: (cwd: string, count?: number) => reads().gitLog(cwd, count),
      getDiff: (cwd: string, commitHash?: string, filePath?: string) =>
        reads().gitDiff({ cwd, commitHash, filePath }),
      getDiffFiles: (cwd: string, commitHash?: string) =>
        reads().gitDiffFiles({ cwd, commitHash }),
      getRoot: (cwd: string) => reads().gitRoot(cwd),
      getStatus: (cwd: string) => reads().gitStatus(cwd),
      commit: () => unsupportedCapability('git.commit'),
      checkout: () => unsupportedCapability('git.checkout'),
      merge: () => unsupportedCapability('git.merge'),
    },
    worktree: {
      status: (sessionId: string) => reads().worktreeStatus(sessionId),
      create: () => unsupportedCapability('worktree.create'),
      remove: () => unsupportedCapability('worktree.remove'),
      merge: () => unsupportedCapability('worktree.merge'),
      rehydrate: () => unsupportedCapability('worktree.rehydrate'),
    },
    workerBuffer: {
      // Device-local scrollback only. It does not start a process.
      init: async (panelId: string) => {
        if (!workerBuffers.has(panelId)) workerBuffers.set(panelId, '')
        return true
      },
      append: async (panelId: string, lines: string) => {
        workerBuffers.set(panelId, (workerBuffers.get(panelId) ?? '') + lines)
        return true
      },
      readAll: async (panelId: string) => workerBuffers.get(panelId) ?? '',
      clear: async (panelId: string) => {
        workerBuffers.set(panelId, '')
        return true
      },
      loadProcfile: async (filePath: string) => {
        const file = await reads().readFile(filePath)
        if (file.error || typeof file.content !== 'string') {
          throw new Error(file.error || `${filePath}: procfile read failed`)
        }
        return parseProcfile(file.content)
      },
      startProcess: () => unsupportedCapability('workerBuffer.startProcess'),
      stopProcess: () => unsupportedCapability('workerBuffer.stopProcess'),
    },
    pty: droppedNamespace('pty'),
  }

  for (const namespace of DROPPED_HOST_NAMESPACES) {
    ported[namespace] = droppedNamespace(namespace)
  }

  return new Proxy(ported, {
    get(target, prop) {
      if (typeof prop === 'symbol') return undefined
      if (prop in target) return target[prop as string]
      return droppedNamespace(String(prop))
    },
  }) as BatAppAPI
}

export const host: BatAppAPI = buildHost()

// Installs the strict host on window.batAppAPI. It does not install a
// permissive proxy. Unported calls throw. workspace.getDetachedId returns
// null. debug.log is a no-op.
export function installTauriShim(): void {
  if (getHostKind() !== 'tauri') return
  const win = (globalThis as unknown as { window?: Record<string, unknown> }).window
  if (!win || win.batAppAPI) return
  installTauriDropPathCache()
  win.batAppAPI = host
}
