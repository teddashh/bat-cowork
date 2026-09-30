import type {
  PaseoAgent,
  PaseoAgentCommandsOptions,
  PaseoAgentCommandsResult,
  PaseoAgentHandle,
  PaseoAgentListOptions,
  PaseoAgentListResult,
  PaseoAgentRefetchResult,
  PaseoAgentTimelineRefetchOptions,
  PaseoClient,
  PaseoProjectListOptions,
  PaseoProjectListResult,
  PaseoWorkspace,
  PaseoWorkspaceHandle,
  PaseoWorkspaceListOptions,
  PaseoWorkspaceListResult,
} from "../index.js";

/**
 * Write verbs refused by the cowork read boundary.
 * A method name is a write when any camelCase or punctuation token equals one
 * of these (so `send`, `createAgent`, `checkoutCommit`, and `checkoutPush` fail,
 * while `listWorkspaces` and `getCheckoutDiff` do not).
 */
const WRITE_METHOD_TOKENS = new Set([
  "send",
  "create",
  "cancel",
  "write",
  "commit",
  "merge",
  "push",
]);

/**
 * Checkout, diff, and file reads are real DaemonClient methods and are NOT
 * methods on the public client (`createPaseoClient` / `createPaseoApi` in
 * `src/index.ts`). This facade does not invent them.
 *
 * Present only on DaemonClient (`src/daemon-client.ts`):
 * - `getCheckoutStatus`
 * - `getCheckoutDiff`
 * - `observeCheckoutDiff`
 * - `listCheckoutCommits`
 * - `getCommitFileDiff`
 * - `checkoutPrStatus`
 * - `listDirectory`
 * - `readFile`
 *
 * Also not wrapped, because they mutate: `checkoutCommit`, `checkoutMerge`,
 * `checkoutMergeFromBase`, `checkoutPull`, `checkoutPush`, `checkoutDiscardChanges`,
 * `writeFile`, `createFileEntry`, `renameFileEntry`, `deleteFileEntry`,
 * `uploadFile`, `sendAgentMessage`, `cancelAgent`, `createAgent`.
 *
 * Public reads that exist but are intentionally not forwarded here (no daemon
 * was connected, and several sit next to a write on the same object):
 * `workspaces.subscribe`, `agents.subscribe`, `workspaces.open`,
 * `providers.*`, `config.get` (paired with `config.patch`), `terminals.list`
 * (paired with `terminals.ref().write` / `sendKeys`).
 */
export const PUBLIC_CLIENT_READ_GAPS = [
  "getCheckoutStatus",
  "getCheckoutDiff",
  "observeCheckoutDiff",
  "listCheckoutCommits",
  "getCommitFileDiff",
  "checkoutPrStatus",
  "listDirectory",
  "readFile",
] as const;

export type PublicReadSource = Pick<PaseoClient, "workspaces" | "agents" | "projects">;

export interface ReadOnlyWorkspaceHandle {
  readonly id: string;
  readonly projectId: string | null;
  readonly directory: string | null;
  readonly name: string | null;
  readonly status: PaseoWorkspace["status"] | null;
  current(): PaseoWorkspace | null;
  refresh(options?: { requestId?: string }): Promise<PaseoWorkspace | null>;
}

export interface ReadOnlyAgentHandle {
  readonly id: string;
  readonly workspaceId: string | null;
  readonly cwd: string | null;
  readonly status: PaseoAgent["status"] | null;
  current(): PaseoAgent | null;
  /**
   * Public fetch. `PaseoClient` has no `fetchAgent`; `agents.ref().refresh()`
   * is the method that calls `DaemonClient.fetchAgent`.
   */
  refresh(requestId?: string): Promise<PaseoAgentRefetchResult | null>;
  readonly timeline: {
    /**
     * Public timeline fetch. `agents.ref().timeline.refetch()` calls
     * `DaemonClient.fetchAgentTimeline`. There is no public `fetchAgentTimeline`.
     */
    refetch(
      options?: PaseoAgentTimelineRefetchOptions,
    ): ReturnType<PaseoAgentHandle["timeline"]["refetch"]>;
  };
  commands(options?: PaseoAgentCommandsOptions): Promise<PaseoAgentCommandsResult>;
}

export interface ReadOnlyPaseoClient {
  readonly workspaces: {
    list(options?: PaseoWorkspaceListOptions): Promise<PaseoWorkspaceListResult>;
    ref(workspace: string | PaseoWorkspace): ReadOnlyWorkspaceHandle;
  };
  readonly agents: {
    list(options?: PaseoAgentListOptions): Promise<PaseoAgentListResult>;
    ref(agent: string | PaseoAgent): ReadOnlyAgentHandle;
  };
  readonly projects: {
    list(options?: PaseoProjectListOptions): Promise<PaseoProjectListResult>;
  };
}

export function assertReadOnly(method: string): void {
  const tokens = method
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .map((token) => token.toLowerCase())
    .filter((token) => token.length > 0);
  const hit = tokens.find((token) => WRITE_METHOD_TOKENS.has(token));
  if (hit) {
    throw new Error(
      `Read-only cowork client refuses "${method}" because it is a write (${hit}).`,
    );
  }
}

function allow(method: string): void {
  assertReadOnly(method);
}

function readOnlyWorkspace(handle: PaseoWorkspaceHandle): ReadOnlyWorkspaceHandle {
  return {
    get id() {
      return handle.id;
    },
    get projectId() {
      return handle.projectId;
    },
    get directory() {
      return handle.directory;
    },
    get name() {
      return handle.name;
    },
    get status() {
      return handle.status;
    },
    current() {
      allow("current");
      return handle.current();
    },
    refresh(options) {
      allow("refresh");
      return handle.refresh(options);
    },
  };
}

function readOnlyAgent(handle: PaseoAgentHandle): ReadOnlyAgentHandle {
  return {
    get id() {
      return handle.id;
    },
    get workspaceId() {
      return handle.workspaceId;
    },
    get cwd() {
      return handle.cwd;
    },
    get status() {
      return handle.status;
    },
    current() {
      allow("current");
      return handle.current();
    },
    refresh(requestId) {
      allow("refresh");
      return handle.refresh(requestId);
    },
    timeline: {
      refetch(options) {
        allow("refetch");
        return handle.timeline.refetch(options);
      },
    },
    commands(options) {
      allow("commands");
      return handle.commands(options);
    },
  };
}

/**
 * Narrow facade over the public client. The returned objects do not carry
 * `send`, `create`, `archive`, terminal stdin, or git commit.
 */
export function createReadOnlyPaseoClient(client: PublicReadSource): ReadOnlyPaseoClient {
  return {
    workspaces: {
      list(options) {
        allow("listWorkspaces");
        return client.workspaces.list(options);
      },
      ref(workspace) {
        allow("ref");
        return readOnlyWorkspace(client.workspaces.ref(workspace));
      },
    },
    agents: {
      list(options) {
        allow("listAgents");
        return client.agents.list(options);
      },
      ref(agent) {
        allow("ref");
        return readOnlyAgent(client.agents.ref(agent));
      },
    },
    projects: {
      list(options) {
        allow("listProjects");
        return client.projects.list(options);
      },
    },
  };
}
