import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { DaemonClient } from "../test-utils/index.js";
import { createTestPaseoDaemon } from "../test-utils/paseo-daemon.js";
import { syncManagedAgent } from "./mutation-gate.js";
import { applyTask, forgetJournal, openTask } from "./journal.js";

test("a client can read the task receipt", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "bat-cowork-receipt-"));
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
  const daemon = await createTestPaseoDaemon();
  const client = new DaemonClient({
    url: `ws://127.0.0.1:${daemon.port}/ws`,
    appVersion: "0.1.82",
    clientId: "client-a",
  });
  try {
    await client.connect();
    await openTask({
      home: daemon.paseoHome,
      id: "task-receipt",
      driverId: "client-a",
      worktreeId: repoDir,
      agentId: "agent-receipt",
      cwd: repoDir,
    });
    await applyTask("task-receipt", {
      id: "instr-1",
      type: "instruction",
      actor: "client-a",
      role: "driver",
      text: "ship it",
    });
    await applyTask("task-receipt", {
      id: "v1",
      type: "verify.passed",
      evidence: { revision: 1, commit: "abcabcabcabc" },
    });
    const tasks = await client.listCoworkTasks();
    const task = tasks.find((item) => item.id === "task-receipt");
    expect(task?.phase).toBe("verified");
    expect(task?.evidenceCommit).toBe("abcabcabcabc");
    expect(task?.receipts.some((receipt) => receipt.kind === "verified" && !receipt.failed)).toBe(
      true,
    );
    expect(
      task?.timeline.some((entry) => entry.kind === "instruction" && entry.text === "ship it"),
    ).toBe(true);
  } finally {
    syncManagedAgent("agent-receipt", null);
    await forgetJournal();
    await client.close().catch(() => undefined);
    await daemon.close();
    rmSync(root, { recursive: true, force: true });
  }
}, 180000);
