import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
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

test("an old tasks wrapper migrates, and restoring the file rolls the extra comment back", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "bat-cowork-w6-"));
  const repoDir = repo(root);
  try {
    await openTask({
      home: root,
      id: "task-old",
      driverId: "alice",
      worktreeId: repoDir,
      agentId: "agent-old",
      cwd: repoDir,
    });
    const file = journalFile(root);
    const snapshot = readFileSync(file, "utf8");
    const tasks = JSON.parse(snapshot) as { baselineCommit?: string }[];
    delete tasks[0]?.baselineCommit;
    writeFileSync(file, JSON.stringify({ tasks }));
    await dropJournalMemory();
    await openJournal(root);
    expect(readTask("task-old")?.baselineCommit).toMatch(/^[0-9a-f]{40}$/);

    const restored = readFileSync(file, "utf8");
    await applyTask("task-old", {
      id: "extra",
      type: "comment",
      actor: "alice",
      text: "do not keep",
    });
    expect(readTask("task-old")?.state.timeline.some((entry) => entry.text === "do not keep")).toBe(
      true,
    );
    writeFileSync(file, restored);
    await dropJournalMemory();
    await openJournal(root);
    expect(readTask("task-old")?.state.timeline.some((entry) => entry.text === "do not keep")).toBe(
      false,
    );
  } finally {
    syncManagedAgent("agent-old", null);
    await forgetJournal();
    rmSync(root, { recursive: true, force: true });
  }
});
