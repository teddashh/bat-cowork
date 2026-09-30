import { assertReadOnly } from "./read-only-client.js";

export interface CheckoutDiffCompare {
  mode: "uncommitted" | "base";
  baseRef?: string;
  ignoreWhitespace?: boolean;
}

export interface DaemonReadSource {
  fetchWorkspaces(options?: { requestId?: string }): Promise<{ entries: readonly { id: string }[] }>;
  fetchAgents(options?: { requestId?: string }): Promise<unknown>;
  listDirectory(cwd: string, path: string, requestId?: string): Promise<unknown>;
  readFile(
    cwd: string,
    path: string,
    requestId?: string,
    maxBytes?: number,
  ): Promise<unknown>;
  getCheckoutStatus(cwd: string, options?: { requestId?: string }): Promise<unknown>;
  getCheckoutDiff(
    cwd: string,
    compare: CheckoutDiffCompare,
    requestId?: string,
  ): Promise<unknown>;
}

export interface DaemonReadView {
  fetchWorkspaces(options?: { requestId?: string }): Promise<{ entries: readonly { id: string }[] }>;
  fetchAgents(options?: { requestId?: string }): Promise<unknown>;
  listDirectory(cwd: string, path: string, requestId?: string): Promise<unknown>;
  readFile(cwd: string, path: string, requestId?: string, maxBytes?: number): Promise<unknown>;
  getCheckoutStatus(cwd: string, options?: { requestId?: string }): Promise<unknown>;
  getCheckoutDiff(
    cwd: string,
    compare: CheckoutDiffCompare,
    requestId?: string,
  ): Promise<unknown>;
}

// Forwards only daemon read methods. createWorkspace, sendAgentMessage, and
// checkout writes are not on this type and are refused by assertReadOnly.
export function createDaemonReadView(client: DaemonReadSource): DaemonReadView {
  return {
    fetchWorkspaces(options) {
      assertReadOnly("fetchWorkspaces");
      return client.fetchWorkspaces(options);
    },
    fetchAgents(options) {
      assertReadOnly("fetchAgents");
      return client.fetchAgents(options);
    },
    listDirectory(cwd, path, requestId) {
      assertReadOnly("listDirectory");
      return client.listDirectory(cwd, path, requestId);
    },
    readFile(cwd, path, requestId, maxBytes) {
      assertReadOnly("readFile");
      return client.readFile(cwd, path, requestId, maxBytes);
    },
    getCheckoutStatus(cwd, options) {
      assertReadOnly("getCheckoutStatus");
      return client.getCheckoutStatus(cwd, options);
    },
    getCheckoutDiff(cwd, compare, requestId) {
      assertReadOnly("getCheckoutDiff");
      return client.getCheckoutDiff(cwd, compare, requestId);
    },
  };
}
