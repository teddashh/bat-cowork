import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { DaemonClient } from "../test-utils/index.js";
import { createTestAgentClient } from "../test-utils/fake-agent-client.js";
import { createTestPaseoDaemon } from "../test-utils/paseo-daemon.js";
import { syncManagedAgent } from "./mutation-gate.js";
import { applyTask, forgetJournal, openTask, readTask } from "./journal.js";

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

async function waitFor(id: string, ready: (phase: string, rework: number, revision: number) => boolean) {
  const started = Date.now();
  while (Date.now() - started < 5000) {
    const state = readTask(id)?.state;
    if (state && ready(state.phase, state.reworkAttempts, state.revision)) return state;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  const state = readTask(id)?.state;
  throw new Error(`task ${id} stayed ${state?.phase ?? "missing"} rework=${state?.reworkAttempts}`);
}

test("a restart reconciles an inflight command and holds send", async () => {
  const homeRoot = mkdtempSync(path.join(tmpdir(), "bat-cowork-w3-restart-"));
  const repoDir = gitRepo(homeRoot);
  const first = await createTestPaseoDaemon({
    cleanup: false,
    paseoHomeRoot: homeRoot,
    agentClients: { claude: createTestAgentClient("claude") },
  });
  const client = new DaemonClient({
    url: `ws://127.0.0.1:${first.port}/ws`,
    appVersion: "0.1.82",
    clientId: "client-a",
  });
  let agentId = "";
  try {
    await client.connect();
    const created = await client.createWorkspace({ source: { kind: "directory", path: repoDir } });
    expect(created.error ?? null).toBeNull();
    const agent = await client.createAgent({ provider: "claude", cwd: repoDir, model: "test-model" });
    agentId = agent.id;
    await openTask({
      home: first.paseoHome,
      id: "task-inflight",
      driverId: "client-a",
      worktreeId: created.workspace?.id ?? repoDir,
      agentId,
      cwd: repoDir,
    });
    await applyTask("task-inflight", {
      id: "instr-1",
      type: "instruction",
      actor: "client-a",
      role: "driver",
      text: "still running",
    });
    expect(readTask("task-inflight")?.state.activeCommand?.outcome).toBe("inflight");
    await client.close();
    await first.close();

    const second = await createTestPaseoDaemon({
      cleanup: false,
      paseoHomeRoot: homeRoot,
      agentClients: { claude: createTestAgentClient("claude") },
    });
    const again = new DaemonClient({
      url: `ws://127.0.0.1:${second.port}/ws`,
      appVersion: "0.1.82",
      clientId: "client-a",
    });
    try {
      await again.connect();
      expect(readTask("task-inflight")?.state.activeCommand?.outcome).toBe("unknown");
      expect(readTask("task-inflight")?.state.phase).not.toBe("verified");
      await expect(again.sendAgentMessage(agentId, "keep going")).rejects.toThrow(/cowork gate: held/);
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

test("a failed turn reworks, and a later instruction is not closed by the old commit", async () => {
  let turns = 0;
  const homeRoot = mkdtempSync(path.join(tmpdir(), "bat-cowork-w3-append-"));
  const repoDir = gitRepo(homeRoot);
  const provider = createTestAgentClient("claude", {
    onStartTurn: () => {
      turns += 1;
      if (turns === 1) return;
      writeFileSync(path.join(repoDir, "README.md"), `turn ${turns}\n`);
      execFileSync("git", ["add", "README.md"], { cwd: repoDir, stdio: "pipe" });
      execFileSync("git", ["-c", "commit.gpgsign=false", "commit", "-m", `turn ${turns}`], {
        cwd: repoDir,
        stdio: "pipe",
      });
    },
  });
  const daemon = await createTestPaseoDaemon({
    cleanup: false,
    paseoHomeRoot: homeRoot,
    agentClients: { claude: provider },
  });
  const client = new DaemonClient({
    url: `ws://127.0.0.1:${daemon.port}/ws`,
    appVersion: "0.1.82",
    clientId: "client-a",
  });
  let agentId = "";
  try {
    await client.connect();
    const created = await client.createWorkspace({ source: { kind: "directory", path: repoDir } });
    const agent = await client.createAgent({ provider: "claude", cwd: repoDir, model: "test-model" });
    agentId = agent.id;
    await openTask({
      home: daemon.paseoHome,
      id: "task-append",
      driverId: "client-a",
      worktreeId: created.workspace?.id ?? repoDir,
      agentId,
      cwd: repoDir,
    });
    await applyTask("task-append", {
      id: "instr-1",
      type: "instruction",
      actor: "client-a",
      role: "driver",
      text: "first",
    });
    await client.sendAgentMessage(agentId, "no commit");
    const reworked = await waitFor("task-append", (_phase, rework) => rework >= 1);
    expect(reworked.phase).not.toBe("verified");
    expect(turns).toBe(1);

    await client.sendAgentMessage(agentId, "commit");
    const first = await waitFor("task-append", (phase, _rework, revision) => phase === "verified" && revision === 1);
    const firstCommit = first.evidence?.commit;
    expect(firstCommit).toEqual(expect.any(String));

    await applyTask("task-append", {
      id: "instr-2",
      type: "instruction",
      actor: "client-a",
      role: "driver",
      text: "second",
    });
    expect(readTask("task-append")?.state.phase).toBe("active");
    expect(readTask("task-append")?.state.revision).toBe(2);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(readTask("task-append")?.state.phase).toBe("active");
    expect(readTask("task-append")?.state.evidence?.commit).toBe(firstCommit);

    await client.sendAgentMessage(agentId, "commit again");
    const second = await waitFor("task-append", (phase, _rework, revision) => phase === "verified" && revision === 2);
    expect(second.evidence?.commit).not.toBe(firstCommit);
    expect(turns).toBe(3);
  } finally {
    if (agentId) syncManagedAgent(agentId, null);
    await forgetJournal();
    await client.close().catch(() => undefined);
    await daemon.close();
    rmSync(homeRoot, { recursive: true, force: true });
  }
}, 180000);
