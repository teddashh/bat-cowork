import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  DROPPED_HOST_METHODS,
  DROPPED_HOST_NAMESPACES,
  UNSUPPORTED_CAPABILITY,
  unsupportedCapability,
} from '../renderer/src/hosts/unsupported-capabilities.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const hostApi = readFileSync(join(here, '../renderer/src/host-api.ts'), 'utf8')
const readPort = readFileSync(join(here, '../renderer/src/hosts/workspace-read-port.ts'), 'utf8')

const FORBIDDEN_INVOKE_FRAGMENTS = [
  'update_check',
  'update_install',
  'update_get_version',
  'update_check_native',
  'claude_cli_',
  'claude_start_session',
  'claude_send_message',
  'claude_channel_',
  'remote_start_server',
  'remote_stop_server',
  'remote_connect',
  'remote_tunnel_',
  'tunnel_get_connection',
  'runtime_install',
  'runtime_get_status',
  'codex_account',
  'pty_create',
  'pty_kill',
  'worktree_create',
  'worker_procfile_start',
  'worker_procfile_stop',
]

test('unsupported list names the dropped capabilities', () => {
  assert.equal(UNSUPPORTED_CAPABILITY, 'UNSUPPORTED_CAPABILITY')
  for (const name of ['claudeCli', 'update', 'remote', 'runtime', 'claude', 'claudeChannel', 'codex', 'remoteTunnel', 'tunnel']) {
    assert.ok(DROPPED_HOST_NAMESPACES.includes(name), name)
  }
  for (const name of ['workerBuffer.startProcess', 'workerBuffer.stopProcess', 'git.commit', 'workspace.save']) {
    assert.ok(DROPPED_HOST_METHODS.includes(name), name)
  }
})

test('unsupportedCapability throws UNSUPPORTED_CAPABILITY and does not resolve', () => {
  assert.throws(
    () => unsupportedCapability('claudeCli.startSession'),
    (error) => {
      assert.ok(error instanceof Error)
      assert.match(error.message, /UNSUPPORTED_CAPABILITY/)
      assert.match(error.message, /claudeCli\.startSession/)
      return true
    },
  )
  assert.throws(() => unsupportedCapability('update.checkNative'), /UNSUPPORTED_CAPABILITY/)
  assert.throws(() => unsupportedCapability('remote.startServer'), /UNSUPPORTED_CAPABILITY/)
})

test('host-api refuses dropped capabilities instead of invoking them', () => {
  assert.match(hostApi, /UNSUPPORTED_CAPABILITY|unsupportedCapability/)
  assert.match(hostApi, /droppedNamespace\('pty'\)/)
  for (const name of ['claudeCli', 'update', 'remote']) {
    assert.match(hostApi, new RegExp(`DROPPED_HOST_NAMESPACES`))
    assert.doesNotMatch(hostApi, new RegExp(`['"]${name}_`))
  }
  for (const fragment of FORBIDDEN_INVOKE_FRAGMENTS) {
    assert.equal(hostApi.includes(fragment), false, fragment)
  }
  assert.match(hostApi, /unsupportedCapability\('workerBuffer\.startProcess'\)/)
  assert.match(hostApi, /unsupportedCapability\('workerBuffer\.stopProcess'\)/)
  assert.match(hostApi, /unsupportedCapability\('git\.commit'\)/)
  assert.match(hostApi, /unsupportedCapability\('workspace\.save'\)/)
  assert.match(hostApi, /unsupportedCapability\('fs\.writeFile'\)/)
  assert.doesNotMatch(hostApi, /Promise\.resolve\(null\)/)
  assert.doesNotMatch(hostApi, /permissiveValueFor/)
  assert.doesNotMatch(hostApi, /workspaces\.json/)
})

test('workspace reads go through a disconnected port, not a local JSON file', () => {
  assert.match(hostApi, /getWorkspaceReadPort\(\)/)
  assert.match(hostApi, /listWorkspaces\(\)/)
  assert.match(hostApi, /gitStatus\(/)
  assert.match(hostApi, /gitDiff\(/)
  assert.match(readPort, /WORKSPACE_READ_DISCONNECTED/)
  assert.match(readPort, /local workspace JSON/)
  assert.doesNotMatch(readPort, /readFileSync/)
  assert.doesNotMatch(readPort, /localStorage/)
  assert.doesNotMatch(readPort, /workspaces\.json/)
})
