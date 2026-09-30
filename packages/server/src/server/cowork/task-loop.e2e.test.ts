import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { DaemonClient } from "../test-utils/index.js";
import { createTestAgentClient } from "../test-utils/fake-agent-client.js";
import { createTestPaseoDaemon } from "../test-utils/paseo-daemon.js";
import { syncManagedAgent } from "./mutation-gate.js";
import {
  applyTask,
  dropJournalMemory,
  forgetJournal,
  openJournal,
  openTask,
  readTask,
  verifyTask,
} from "./journal.js";

function gitRepo(): { repoDir: string; tempRoot: string } {
  const tempRoot = mkdtempSync(path.join(tmpdir(), "bat-cowork-task-"));
  const repoDir = path.join(tempRoot, "repo");
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
  return { repoDir, tempRoot };
}

async function waitForVerified(id: string) {
  const started = Date.now();
  while (Date.now() - started < 5000) {
    const record = readTask(id);
    if (record?.state.phase === "verified") return record;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`task ${id} stayed ${readTask(id)?.state.phase ?? "missing"}`);
}

test("a paused task survives the client, then one turn and a real commit can verify", async () => {
  let turns = 0;
  let repoDir = "";
  let tempRoot = "";
  const provider = createTestAgentClient("claude", {
    onStartTurn: () => {
      turns += 1;
      writeFileSync(path.join(repoDir, "README.md"), "changed by the turn\n");
      execFileSync("git", ["add", "README.md"], { cwd: repoDir, stdio: "pipe" });
      execFileSync("git", ["-c", "commit.gpgsign=false", "commit", "-m", "turn"], {
        cwd: repoDir,
        stdio: "pipe",
      });
    },
  });
  const daemon = await createTestPaseoDaemon({ agentClients: { claude: provider } });
  ({ repoDir, tempRoot } = gitRepo());
  const first = new DaemonClient({
    url: `ws://127.0.0.1:${daemon.port}/ws`,
    appVersion: "0.1.82",
    clientId: "client-a",
  });
  let agentId = "";
  try {
    await first.connect();
    const created = await first.createWorkspace({
      source: { kind: "directory", path: repoDir },
    });
    expect(created.error ?? null).toBeNull();
    const agent = await first.createAgent({
      provider: "claude",
      cwd: repoDir,
      model: "test-model",
    });
    agentId = agent.id;
    expect(agentId).not.toBe("");

    await openTask({
      home: daemon.paseoHome,
      id: "task-1",
      driverId: "client-a",
      worktreeId: created.workspace?.id ?? repoDir,
      agentId,
      cwd: repoDir,
    });
    await applyTask("task-1", {
      id: "instr-1",
      type: "instruction",
      actor: "client-a",
      role: "driver",
      text: "change the readme",
    });
    const blocked = await verifyTask("task-1");
    expect(blocked.state.phase).not.toBe("verified");

    await applyTask("task-1", {
      id: "pause-1",
      type: "control",
      action: "pause",
      actor: "client-a",
    });
    await expect(first.sendAgentMessage(agentId, "do it")).rejects.toThrow(/cowork gate: held/);
    expect(turns).toBe(0);

    await first.close();
    syncManagedAgent(agentId, null);
    await dropJournalMemory();
    await openJournal(daemon.paseoHome);

    const second = new DaemonClient({
      url: `ws://127.0.0.1:${daemon.port}/ws`,
      appVersion: "0.1.82",
      clientId: "client-b",
    });
    await second.connect();
    await expect(second.sendAgentMessage(agentId, "do it again")).rejects.toThrow(/cowork gate: held/);
    expect(turns).toBe(0);
    await second.close();

    await applyTask("task-1", {
      id: "release-1",
      type: "control",
      action: "release",
      actor: "client-a",
    });
    const third = new DaemonClient({
      url: `ws://127.0.0.1:${daemon.port}/ws`,
      appVersion: "0.1.82",
      clientId: "client-a",
    });
    await third.connect();
    await third.sendAgentMessage(agentId, "do it");
    expect(turns).toBe(1);
    const verified = await waitForVerified("task-1");
    expect(verified.state.evidence?.commit).toEqual(expect.any(String));
    expect(verified.state.outbox.some((item) => item.kind === "verified" && !item.failed)).toBe(
      true,
    );

    await dropJournalMemory();
    await openJournal(daemon.paseoHome);
    expect(readTask("task-1")?.state.phase).toBe("verified");
    await third.close();
  } finally {
    if (agentId) syncManagedAgent(agentId, null);
    await forgetJournal();
    await first.close().catch(() => undefined);
    await daemon.close();
    rmSync(tempRoot, { recursive: true, force: true });
  }
}, 180000);
