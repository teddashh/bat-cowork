// Pure list of BAT host capabilities this milestone refuses.
// No Tauri invoke, no local workspace JSON, no agent process.

export const UNSUPPORTED_CAPABILITY = 'UNSUPPORTED_CAPABILITY'

// Namespaces that must never be implemented as a successful invoke.
// workerBuffer procfile start/stop is a method pair, not a whole namespace.
export const DROPPED_HOST_NAMESPACES = Object.freeze([
  'runtime',
  'update',
  'claude',
  'claudeChannel',
  'claudeCli',
  'codex',
  'remote',
  'remoteTunnel',
  'tunnel',
])

// Method names that spawn or stop a process, mutate shared workspace state,
// or talk to the old BAT updater / remote server. Callers must see a throw.
export const DROPPED_HOST_METHODS = Object.freeze([
  'workerBuffer.startProcess',
  'workerBuffer.stopProcess',
  'workspace.save',
  'workspace.detach',
  'workspace.reattach',
  'workspace.moveToWindow',
  'git.commit',
  'git.checkout',
  'git.merge',
  'fs.mkdir',
  'fs.deletePath',
  'fs.uploadToDir',
  'fs.downloadFile',
  'fs.writeFile',
  'worktree.create',
  'worktree.remove',
  'worktree.merge',
  'worktree.rehydrate',
  'pty.create',
  'pty.write',
  'pty.kill',
  'pty.restart',
  'agent.start',
  'agent.stop',
])

export function isDroppedHostNamespace(name) {
  return DROPPED_HOST_NAMESPACES.includes(name)
}

export function unsupportedCapability(name) {
  const label = typeof name === 'string' && name ? name : 'unknown'
  throw new Error(
    `${UNSUPPORTED_CAPABILITY}: ${label} is not implemented in BAT Cowork W1`,
  )
}
