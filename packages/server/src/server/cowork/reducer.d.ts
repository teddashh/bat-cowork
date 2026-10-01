export type Phase = "active" | "paused" | "verified" | "cancelled" | "rejected";

export type Liveness =
  | { kind: "command"; commandId: string }
  | { kind: "wake"; nextWakeAt: string }
  | { kind: "blocker"; owner: string; reason: string };

export interface Evidence {
  revision: number;
  commit: string;
}

export interface TaskState {
  id: string;
  phase: Phase;
  revision: number;
  driverId: string;
  controlEpoch: number;
  writerId: string | null;
  writerSettledEpoch: number | null;
  holdDispatch: boolean;
  worktreeId: string;
  appliedEventIds: readonly string[];
  timeline: readonly { eventId: string; kind: string; actor: string; text: string }[];
  activeCommand: { id: string; outcome: "inflight" | "unknown" } | null;
  pendingInput: { revision: number; text: string } | null;
  evidence: Evidence | null;
  reworkAttempts: number;
  maxRework: number;
  outbox: readonly { id: string; kind: "verified"; failed: boolean }[];
  liveness: Liveness;
}

export type TaskEvent =
  | { id: string; type: "comment"; actor: string; text: string }
  | { id: string; type: "proposal"; actor: string; text: string }
  | { id: string; type: "instruction"; actor: string; role: "driver" | "viewer"; text: string }
  | {
      id: string;
      type: "control";
      action: "pause" | "takeover" | "cancel" | "release";
      actor: string;
    }
  | { id: string; type: "presence"; actor: string }
  | { id: string; type: "lease.expired" }
  | { id: string; type: "writer.settled"; epoch: number }
  | { id: string; type: "command.unknown"; commandId: string }
  | { id: string; type: "assistant.finished"; text: string }
  | { id: string; type: "stream.ended" }
  | { id: string; type: "process.exited"; exitCode: number }
  | { id: string; type: "verify.failed" }
  | { id: string; type: "verify.passed"; evidence: Evidence }
  | { id: string; type: "notify.failed"; outboxId: string };

export interface StepResult {
  state: TaskState;
  intents: readonly {
    type: "dispatch" | "repair" | "notify";
    commandId?: string;
    revision?: number;
    outboxId?: string;
  }[];
}

export function createTask(input: {
  id: string;
  driverId: string;
  worktreeId: string;
  maxRework?: number;
}): TaskState;

export function step(state: TaskState, event: TaskEvent): StepResult;

export function managedWriteFields(state: TaskState): {
  writerId: string;
  revision: number;
  expectedRevision: number;
  epoch: number;
  expectedEpoch: number;
  holdDispatch: boolean;
} | null;
