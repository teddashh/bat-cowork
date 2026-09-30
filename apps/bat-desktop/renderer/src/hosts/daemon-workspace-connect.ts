// Browser connection for the read-only workspace port.
// The query `?daemon=ws://127.0.0.1:PORT/ws` opts in. Nothing is connected by default.

import { DaemonClient } from '../../../../../packages/client/src/daemon-client.ts'
import { DaemonWorkspaceReadPort } from './daemon-workspace-port'
import { setWorkspaceReadPort } from './workspace-read-port'

export async function connectDaemonWorkspace(url: string): Promise<void> {
  const client = new DaemonClient({
    url,
    appVersion: '0.1.82',
    clientId: 'bat-desktop',
  })
  await client.connect()
  setWorkspaceReadPort(new DaemonWorkspaceReadPort(client))
}
