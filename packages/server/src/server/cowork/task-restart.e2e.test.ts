import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { DaemonClient } from "../test-utils/index.js";
import { createTestAgentClient } from "../test-utils/fake-agent-client.js";
import { createTestPaseoDaemon } from "../test-utils/paseo-daemon.js";
import { syncManagedAgent } from "./mutation-gate.js";
import { applyTask, forgetJournal, openTask } from "./journal.js";

function gitRepo(root: string): string {
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

test("a restarted daemon restores the paused task and still blocks send", async () => {
  let turns = 0;
  const provider = () =>
    createTestAgentClient("claude", {
      onStartTurn: () => {
        turns += 1;
      },
    });
  const homeRoot = mkdtempSync(path.join(tmpdir(), "bat-cowork-restart-"));
  const repoDir = gitRepo(homeRoot);
  const first = await createTestPaseoDaemon({
    cleanup: false,
    paseoHomeRoot: homeRoot,
    agentClients: { claude: provider() },
  });
  const client = new DaemonClient({
    url: `ws://127.0.0.1:${first.port}/ws`,
    appVersion: "0.1.82",
    clientId: "client-a",
  });
  let agentId = "";
  try {
    await client.connect();
    const created = await client.createWorkspace({
      source: { kind: "directory", path: repoDir },
    });
    expect(created.error ?? null).toBeNull();
    const agent = await client.createAgent({
      provider: "claude",
      cwd: repoDir,
      model: "test-model",
    });
    agentId = agent.id;
    await openTask({
      home: first.paseoHome,
      id: "task-restart",
      driverId: "client-a",
      worktreeId: created.workspace?.id ?? repoDir,
      agentId,
      cwd: repoDir,
    });
    await applyTask("task-restart", {
      id: "instr-1",
      type: "instruction",
      actor: "client-a",
      role: "driver",
      text: "hold still",
    });
    await applyTask("task-restart", {
      id: "pause-1",
      type: "control",
      action: "pause",
      actor: "client-a",
    });
    await expect(client.sendAgentMessage(agentId, "not yet")).rejects.toThrow(/cowork gate: held/);
    expect(turns).toBe(0);
    await client.close();
    await first.close();

    const second = await createTestPaseoDaemon({
      cleanup: false,
      paseoHomeRoot: homeRoot,
      agentClients: { claude: provider() },
    });
    const again = new DaemonClient({
      url: `ws://127.0.0.1:${second.port}/ws`,
      appVersion: "0.1.82",
      clientId: "client-b",
    });
    try {
      await again.connect();
      await expect(again.sendAgentMessage(agentId, "still held")).rejects.toThrow(/cowork gate: held/);
      expect(turns).toBe(0);
    } finally {
      await again.close().catch(() => undefined);
      await second.close();
    }
  } finally {
    if (agentId) syncManagedAgent(agentId, null);
    await forgetJournal();
    await client.close().catch(() => undefined);
    rmSync(homeRoot, { recursive: true, force: true });
  }
}, 180000);
