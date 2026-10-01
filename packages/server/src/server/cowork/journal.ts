// Task journal for one daemon process.
// The file under the daemon home is what a later process restores.
// reducer.js is the bundled cowork-core step. Rebuild it from packages/cowork-core
// when those rules change.

import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  createTask,
  managedWriteFields,
  step,
  type StepResult,
  type TaskEvent,
  type TaskState,
} from "./reducer.js";
import { syncManagedAgent } from "./mutation-gate.js";

const execFileAsync = promisify(execFile);

export interface JournalRecord {
  state: TaskState;
  agentId: string | null;
  cwd: string;
  baselineCommit: string;
}

const records = new Map<string, JournalRecord>();
let homeDir: string | null = null;

export function journalFile(home: string): string {
  return path.join(home, "cowork", "tasks.json");
}

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout.trim();
}

// Replace the journal in one step. The new body goes to a temp file in the same
// directory, is synced to disk, and is then renamed over the old file, so a
// process that dies mid-write leaves either the old journal or the new one.
async function replaceJournalFile(file: string, body: string): Promise<void> {
  const dir = path.dirname(file);
  await mkdir(dir, { recursive: true });
  const temp = path.join(dir, `.${path.basename(file)}.${process.pid}.${randomUUID()}.tmp`);
  try {
    const handle = await open(temp, "wx");
    try {
      await handle.writeFile(body, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temp, file);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
}

// Writes run one at a time, in call order, so an older snapshot cannot land
// after a newer one.
let persistQueue: Promise<void> = Promise.resolve();

function persist(): Promise<void> {
  if (!homeDir) return Promise.resolve();
  const file = journalFile(homeDir);
  const body = JSON.stringify([...records.values()], null, 2);
  const write = persistQueue.then(() => replaceJournalFile(file, body));
  persistQueue = write.catch(() => undefined);
  return write;
}

function bind(record: JournalRecord): void {
  if (!record.agentId) return;
  syncManagedAgent(record.agentId, managedWriteFields(record.state));
}

function parseJournal(raw: string): JournalRecord[] {
  const parsed = JSON.parse(raw) as unknown;
  if (Array.isArray(parsed)) return parsed as JournalRecord[];
  if (
    parsed &&
    typeof parsed === "object" &&
    Array.isArray((parsed as { tasks?: unknown }).tasks)
  ) {
    return (parsed as { tasks: JournalRecord[] }).tasks;
  }
  throw new Error("cowork journal: unrecognized shape");
}

export async function openJournal(home: string): Promise<void> {
  if (homeDir && homeDir !== home) {
    throw new Error(`cowork journal already open for a different daemon home`);
  }
  homeDir = home;
  records.clear();
  const raw = await readFile(journalFile(home), "utf8").catch(() => "");
  if (!raw) return;
  const parsed = parseJournal(raw);
  for (const record of parsed) {
    if (!record.baselineCommit) {
      record.baselineCommit = await git(record.cwd, ["rev-parse", "HEAD"]);
    }
    records.set(record.state.id, record);
    const command = record.state.activeCommand;
    if (command?.outcome === "inflight") {
      const result = step(record.state, {
        id: `restart-unknown-${command.id}`,
        type: "command.unknown",
        commandId: command.id,
      });
      record.state = result.state;
    }
    bind(record);
  }
  await persist();
}

export async function openTask(input: {
  home: string;
  id: string;
  driverId: string;
  worktreeId: string;
  agentId: string;
  cwd: string;
}): Promise<TaskState> {
  await openJournal(input.home);
  const state = createTask({
    id: input.id,
    driverId: input.driverId,
    worktreeId: input.worktreeId,
  });
  const record: JournalRecord = {
    state,
    agentId: input.agentId,
    cwd: input.cwd,
    baselineCommit: await git(input.cwd, ["rev-parse", "HEAD"]),
  };
  records.set(state.id, record);
  bind(record);
  await persist();
  return state;
}

export async function applyTask(id: string, event: TaskEvent): Promise<StepResult> {
  const record = records.get(id);
  if (!record) throw new Error(`cowork task not found: ${id}`);
  const result = step(record.state, event);
  record.state = result.state;
  bind(record);
  await persist();
  return result;
}

export function readTask(id: string): JournalRecord | undefined {
  return records.get(id);
}

export function listTasks(): {
  id: string;
  phase: string;
  revision: number;
  driverId: string;
  holdDispatch: boolean;
  evidenceCommit: string | null;
  receipts: { id: string; kind: string; failed: boolean }[];
  timeline: { eventId: string; kind: string; actor: string; text: string }[];
}[] {
  return [...records.values()].map((record) => ({
    id: record.state.id,
    phase: record.state.phase,
    revision: record.state.revision,
    driverId: record.state.driverId,
    holdDispatch: record.state.holdDispatch,
    evidenceCommit: record.state.evidence?.commit ?? null,
    receipts: record.state.outbox.map((item) => ({
      id: item.id,
      kind: item.kind,
      failed: item.failed,
    })),
    timeline: record.state.timeline.map((entry) => ({
      eventId: entry.eventId,
      kind: entry.kind,
      actor: entry.actor,
      text: entry.text,
    })),
  }));
}

export async function verifyTask(id: string): Promise<StepResult> {
  const record = records.get(id);
  if (!record) throw new Error(`cowork task not found: ${id}`);
  const head = await git(record.cwd, ["rev-parse", "HEAD"]);
  const porcelain = await git(record.cwd, ["status", "--porcelain"]);
  const floor = record.state.evidence?.commit ?? record.baselineCommit;
  const advanced = head !== floor && porcelain.length === 0;
  if (!advanced) {
    return applyTask(id, { id: `verify-fail-${randomUUID()}`, type: "verify.failed" });
  }
  return applyTask(id, {
    id: `verify-pass-${head.slice(0, 12)}`,
    type: "verify.passed",
    evidence: { revision: record.state.revision, commit: head },
  });
}

const TERMINAL_PHASE = new Set(["verified", "cancelled", "rejected"]);

// Called when a live foreground turn finishes. The test does not decide
// that the task is verified. A paused or finished task is left alone.
export async function settleCoworkTurn(agentId: string): Promise<StepResult | null> {
  const record = [...records.values()].find((item) => item.agentId === agentId);
  if (!record) return null;
  if (record.state.holdDispatch || TERMINAL_PHASE.has(record.state.phase)) return null;
  return verifyTask(record.state.id);
}

export async function closeJournal(): Promise<void> {
  for (const record of records.values()) {
    if (record.agentId) syncManagedAgent(record.agentId, null);
  }
  records.clear();
  homeDir = null;
}

export async function dropJournalMemory(): Promise<void> {
  records.clear();
}

export async function forgetJournal(): Promise<void> {
  records.clear();
  homeDir = null;
}
