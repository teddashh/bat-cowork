// Task journal for one daemon process.
// The file under the daemon home is what a later process restores.
// reducer.js is the bundled cowork-core step. Rebuild it from packages/cowork-core
// when those rules change.

import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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

async function persist(): Promise<void> {
  if (!homeDir) return;
  const file = journalFile(homeDir);
  await mkdir(path.dirname(file), { recursive: true });
  const body = JSON.stringify([...records.values()], null, 2);
  await writeFile(file, body);
}

function bind(record: JournalRecord): void {
  if (!record.agentId) return;
  syncManagedAgent(record.agentId, managedWriteFields(record.state));
}

export async function openJournal(home: string): Promise<void> {
  if (homeDir && homeDir !== home) {
    throw new Error(`cowork journal already open for a different daemon home`);
  }
  homeDir = home;
  records.clear();
  const raw = await readFile(journalFile(home), "utf8").catch(() => "");
  if (!raw) return;
  const parsed = JSON.parse(raw) as JournalRecord[];
  for (const record of parsed) {
    records.set(record.state.id, record);
    bind(record);
  }
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

export async function verifyTask(id: string): Promise<StepResult> {
  const record = records.get(id);
  if (!record) throw new Error(`cowork task not found: ${id}`);
  const head = await git(record.cwd, ["rev-parse", "HEAD"]);
  const porcelain = await git(record.cwd, ["status", "--porcelain"]);
  const advanced = head !== record.baselineCommit && porcelain.length === 0;
  if (!advanced) {
    return applyTask(id, { id: `verify-fail-${randomUUID()}`, type: "verify.failed" });
  }
  return applyTask(id, {
    id: `verify-pass-${head.slice(0, 12)}`,
    type: "verify.passed",
    evidence: { revision: record.state.revision, commit: head },
  });
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
