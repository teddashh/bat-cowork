import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import type { FileHandle } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, expect, test, vi } from "vitest";
import { syncManagedAgent } from "./mutation-gate.js";
import {
  applyTask,
  dropJournalMemory,
  forgetJournal,
  journalFile,
  openJournal,
  openTask,
  readTask,
} from "./journal.js";

const io = vi.hoisted(() => ({
  log: [] as string[],
  // When set, the next file write keeps this many characters and then fails,
  // like a process that dies in the middle of writing.
  cutNextWriteAt: null as number | null,
}));

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  return {
    ...actual,
    async open(...args: Parameters<typeof actual.open>): Promise<FileHandle> {
      const handle = await actual.open(...args);
      const file = String(args[0]);
      const writeFile = handle.writeFile.bind(handle);
      const sync = handle.sync.bind(handle);
      handle.writeFile = async (data, options) => {
        const cut = io.cutNextWriteAt;
        if (cut === null) return writeFile(data, options);
        io.cutNextWriteAt = null;
        await writeFile(String(data).slice(0, cut), options);
        throw new Error("simulated crash mid-write");
      };
      handle.sync = async () => {
        io.log.push(`sync ${file}`);
        return sync();
      };
      return handle;
    },
    async rename(...args: Parameters<typeof actual.rename>): Promise<void> {
      io.log.push(`rename ${String(args[0])} -> ${String(args[1])}`);
      return actual.rename(...args);
    },
  };
});

function repo(root: string): string {
  const repoDir = path.join(root, "repo");
  execFileSync("git", ["init", "-b", "main", repoDir], { stdio: "pipe" });
  execFileSync("git", ["config", "user.email", "test@bat-cowork.local"], {
    cwd: repoDir,
    stdio: "pipe",
  });
  execFileSync("git", ["config", "user.name", "BAT Cowork Test"], { cwd: repoDir, stdio: "pipe" });
  writeFileSync(path.join(repoDir, "README.md"), "base\n");
  execFileSync("git", ["add", "README.md"], { cwd: repoDir, stdio: "pipe" });
  execFileSync("git", ["-c", "commit.gpgsign=false", "commit", "-m", "initial"], {
    cwd: repoDir,
    stdio: "pipe",
  });
  return repoDir;
}

async function withTask(run: (root: string, file: string) => Promise<void>): Promise<void> {
  const root = mkdtempSync(path.join(tmpdir(), "bat-cowork-journal-"));
  const repoDir = repo(root);
  try {
    await openTask({
      home: root,
      id: "task-a",
      driverId: "alice",
      worktreeId: repoDir,
      agentId: "agent-a",
      cwd: repoDir,
    });
    await run(root, journalFile(root));
  } finally {
    syncManagedAgent("agent-a", null);
    await forgetJournal();
    rmSync(root, { recursive: true, force: true });
  }
}

function leftoverTempFiles(file: string): string[] {
  return readdirSync(path.dirname(file)).filter((name) => name.endsWith(".tmp"));
}

beforeEach(() => {
  io.log.length = 0;
  io.cutNextWriteAt = null;
});

test("the journal is replaced by renaming a synced temp file from the same directory", async () => {
  await withTask(async (_root, file) => {
    const renameIndex = io.log.findIndex((entry) => entry.endsWith(` -> ${file}`));
    expect(renameIndex).toBeGreaterThanOrEqual(0);
    const temp = io.log[renameIndex]!.slice("rename ".length, -` -> ${file}`.length);
    expect(path.dirname(temp)).toBe(path.dirname(file));
    expect(temp).not.toBe(file);
    expect(io.log.indexOf(`sync ${temp}`)).toBeGreaterThanOrEqual(0);
    expect(io.log.indexOf(`sync ${temp}`)).toBeLessThan(renameIndex);
    expect(leftoverTempFiles(file)).toEqual([]);
    expect(JSON.parse(readFileSync(file, "utf8"))).toHaveLength(1);
  });
});

test("a write that dies midway leaves the previous journal readable", async () => {
  await withTask(async (root, file) => {
    const before = readFileSync(file, "utf8");
    io.cutNextWriteAt = 24;
    await expect(
      applyTask("task-a", { id: "lost", type: "comment", actor: "alice", text: "not written" }),
    ).rejects.toThrow("simulated crash mid-write");

    expect(readFileSync(file, "utf8")).toBe(before);
    expect(leftoverTempFiles(file)).toEqual([]);

    await dropJournalMemory();
    await openJournal(root);
    const restored = readTask("task-a");
    expect(restored).toBeDefined();
    expect(restored?.state.timeline.some((entry) => entry.text === "not written")).toBe(false);
  });
});
