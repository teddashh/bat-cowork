import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { syncManagedAgent } from "./mutation-gate.js";
import { applyTask, dropJournalMemory, forgetJournal, openJournal, openTask, readTask } from "./journal.js";

test("two hundred comments survive a reload and do not verify the task", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "bat-cowork-w5-"));
  const repoDir = path.join(root, "repo");
  execFileSync("git", ["init", "-b", "main", repoDir], { stdio: "pipe" });
  execFileSync("git", ["config", "user.email", "test@bat-cowork.local"], { cwd: repoDir, stdio: "pipe" });
  execFileSync("git", ["config", "user.name", "BAT Cowork Test"], { cwd: repoDir, stdio: "pipe" });
  writeFileSync(path.join(repoDir, "README.md"), "base\n");
  execFileSync("git", ["add", "README.md"], { cwd: repoDir, stdio: "pipe" });
  execFileSync("git", ["-c", "commit.gpgsign=false", "commit", "-m", "initial"], {
    cwd: repoDir,
    stdio: "pipe",
  });
  try {
    await openTask({
      home: root,
      id: "task-history",
      driverId: "alice",
      worktreeId: repoDir,
      agentId: "agent-history",
      cwd: repoDir,
    });
    for (let index = 0; index < 200; index += 1) {
      await applyTask("task-history", {
        id: `c-${index}`,
        type: "comment",
        actor: "alice",
        text: `note ${index}`,
      });
    }
    await dropJournalMemory();
    await openJournal(root);
    const state = readTask("task-history")?.state;
    expect(state?.phase).toBe("active");
    expect(state?.revision).toBe(0);
    expect(state?.timeline.length).toBe(200);
    expect(state?.evidence).toBeNull();
  } finally {
    syncManagedAgent("agent-history", null);
    await forgetJournal();
    rmSync(root, { recursive: true, force: true });
  }
});
