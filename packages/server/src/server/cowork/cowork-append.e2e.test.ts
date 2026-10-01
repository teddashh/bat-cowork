import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { DaemonClient } from "../test-utils/index.js";
import { createTestPaseoDaemon } from "../test-utils/paseo-daemon.js";
import { syncManagedAgent } from "./mutation-gate.js";
import { forgetJournal, openTask } from "./journal.js";

test("a client comment keeps its own id and a viewer cannot pause", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "bat-cowork-append-"));
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
  const driver = new DaemonClient({
    url: `ws://127.0.0.1:${daemon.port}/ws`,
    appVersion: "0.1.82",
    clientId: "client-a",
  });
  const viewer = new DaemonClient({
    url: `ws://127.0.0.1:${daemon.port}/ws`,
    appVersion: "0.1.82",
    clientId: "client-b",
  });
  try {
    await driver.connect();
    await viewer.connect();
    await openTask({
      home: daemon.paseoHome,
      id: "task-append",
      driverId: "client-a",
      worktreeId: repoDir,
      agentId: "agent-append",
      cwd: repoDir,
    });
    const comment = await viewer.appendCoworkTask({
      taskId: "task-append",
      eventId: "note-1",
      action: { type: "comment", text: "from the viewer" },
    });
    expect(comment.error).toBeNull();
    expect(comment.duplicate).toBe(false);
    expect(
      comment.task?.timeline.some(
        (entry) =>
          entry.kind === "comment" &&
          entry.actor === "client-b" &&
          entry.text === "from the viewer",
      ),
    ).toBe(true);

    const again = await viewer.appendCoworkTask({
      taskId: "task-append",
      eventId: "note-1",
      action: { type: "comment", text: "from the viewer" },
    });
    expect(again.duplicate).toBe(true);
    expect(again.task?.timeline.filter((entry) => entry.eventId === "note-1")).toHaveLength(1);

    const denied = await viewer.appendCoworkTask({
      taskId: "task-append",
      eventId: "pause-b",
      action: { type: "control", control: "pause" },
    });
    expect(denied.task?.phase).toBe("active");
    expect(denied.task?.holdDispatch).toBe(false);
    expect(
      denied.task?.timeline.some(
        (entry) => entry.kind === "control.rejected" && entry.actor === "client-b",
      ),
    ).toBe(true);

    const paused = await driver.appendCoworkTask({
      taskId: "task-append",
      eventId: "pause-a",
      action: { type: "control", control: "pause" },
    });
    expect(paused.error).toBeNull();
    expect(paused.task?.phase).toBe("paused");
    expect(paused.task?.holdDispatch).toBe(true);

    const missing = await driver.appendCoworkTask({
      taskId: "no-such-task",
      eventId: "note-missing",
      action: { type: "comment", text: "nowhere" },
    });
    expect(missing.task).toBeNull();
    expect(missing.error).toBe("task not found");
  } finally {
    syncManagedAgent("agent-append", null);
    await forgetJournal();
    await driver.close().catch(() => undefined);
    await viewer.close().catch(() => undefined);
    await daemon.close();
    rmSync(root, { recursive: true, force: true });
  }
}, 180000);
