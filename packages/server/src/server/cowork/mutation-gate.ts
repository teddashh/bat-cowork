// Write gate for targets this process has marked as cowork-managed.
// Unregistered agents and workspaces stay on the stock Paseo path.
// syncManagedAgent is the product registration. It copies fields from the
// task reducer (managedWriteFields). A paused task holds dispatch. A terminal
// task clears the registration. Deny rules match evaluateDispatch.

export interface ManagedWriteTarget {
  writerId: string;
  revision: number;
  expectedRevision: number;
  epoch: number;
  expectedEpoch: number;
  holdDispatch: boolean;
}

interface StoredTarget extends ManagedWriteTarget {
  dispatched: Set<string>;
}

const agents = new Map<string, StoredTarget>();
const workspaces = new Map<string, StoredTarget>();

function mapFor(kind: "agent" | "workspace"): Map<string, StoredTarget> {
  return kind === "agent" ? agents : workspaces;
}

export function registerManagedWriteTarget(
  kind: "agent" | "workspace",
  id: string,
  target: ManagedWriteTarget,
): void {
  mapFor(kind).set(id, { ...target, dispatched: new Set() });
}

export function clearManagedWriteTarget(kind: "agent" | "workspace", id: string): void {
  mapFor(kind).delete(id);
}

export function syncManagedAgent(
  agentId: string,
  fields: ManagedWriteTarget | null,
): void {
  if (!fields) {
    clearManagedWriteTarget("agent", agentId);
    return;
  }
  registerManagedWriteTarget("agent", agentId, fields);
}

export function authorizeCoworkWrite(input: {
  kind: "agent" | "workspace";
  id: string;
  actor: string;
  commandId: string;
}): { allow: true } | { allow: false; error: string } {
  const target = mapFor(input.kind).get(input.id);
  if (!target) return { allow: true };
  if (target.revision !== target.expectedRevision) {
    return { allow: false, error: "cowork gate: revision" };
  }
  if (target.epoch !== target.expectedEpoch) {
    return { allow: false, error: "cowork gate: epoch" };
  }
  if (target.holdDispatch) {
    return { allow: false, error: "cowork gate: held" };
  }
  if (target.writerId !== input.actor) {
    return { allow: false, error: "cowork gate: writer" };
  }
  if (target.dispatched.has(input.commandId)) {
    return { allow: false, error: "cowork gate: duplicate" };
  }
  target.dispatched.add(input.commandId);
  return { allow: true };
}
