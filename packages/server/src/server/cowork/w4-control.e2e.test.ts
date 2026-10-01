import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { claimWriter } from "../../../../cowork-core/src/task-core.ts";
import { assertProviderAdmitted } from "../../../../cowork-core/src/providers.ts";
import { DaemonClient } from "../test-utils/index.js";
import { createTestAgentClient } from "../test-utils/fake-agent-client.js";
import { createTestPaseoDaemon } from "../test-utils/paseo-daemon.js";
import { syncManagedAgent } from "./mutation-gate.js";
import { applyTask, forgetJournal, openTask, readTask } from "./journal.js";

function repo(root: string, name: string): string {
  const repoDir = path.join(root, name);
  execFileSync("git", ["init", "-b", "main", repoDir], { stdio: "pipe" });
  execFileSync("git", ["config", "user.email", "test@bat-cowork.local"], {
    cwd: repoDir,
    stdio: "pipe",
  });
  execFileSync("git", ["config", "user.name", "BAT Cowork Test"], { cwd: repoDir, stdio: "pipe" });
  writeFileSync(path.join(repoDir, "README.md"), name + "\n");
  execFileSync("git", ["add", "README.md"], { cwd: repoDir, stdio: "pipe" });
  execFileSync("git", ["-c", "commit.gpgsign=false", "commit", "-m", "initial"], {
    cwd: repoDir,
    stdio: "pipe",
  });
  return repoDir;
}

test("two principals cannot share one worktree, and takeover revokes send until settle", async () => {
  expect(() => assertProviderAdmitted("grok")).toThrow(/not admitted/);
  let turns = 0;
  const root = mkdtempSync(path.join(tmpdir(), "bat-cowork-w4-"));
  const firstRepo = repo(root, "one");
  const secondRepo = repo(root, "two");
  const daemon = await createTestPaseoDaemon({
    agentClients: {
      claude: createTestAgentClient("claude", {
        onStartTurn: () => {
          turns += 1;
        },
      }),
    },
  });
  const alice = new DaemonClient({
    url: `ws://127.0.0.1:${daemon.port}/ws`,
    appVersion: "0.1.82",
    clientId: "alice",
  });
  const bob = new DaemonClient({
    url: `ws://127.0.0.1:${daemon.port}/ws`,
    appVersion: "0.1.82",
    clientId: "bob",
  });
  const agents: string[] = [];
  try {
    await alice.connect();
    await bob.connect();
    const workspaceA = await alice.createWorkspace({
      source: { kind: "directory", path: firstRepo },
    });
    const workspaceB = await bob.createWorkspace({
      source: { kind: "directory", path: secondRepo },
    });
    const agentA = await alice.createAgent({
      provider: "claude",
      cwd: firstRepo,
      model: "test-model",
    });
    const agentB = await bob.createAgent({
      provider: "claude",
      cwd: secondRepo,
      model: "test-model",
    });
    agents.push(agentA.id, agentB.id);
    const treeA = workspaceA.workspace?.id ?? firstRepo;
    const treeB = workspaceB.workspace?.id ?? secondRepo;
    await openTask({
      home: daemon.paseoHome,
      id: "task-a",
      driverId: "alice",
      worktreeId: treeA,
      agentId: agentA.id,
      cwd: firstRepo,
    });
    await openTask({
      home: daemon.paseoHome,
      id: "task-b",
      driverId: "bob",
      worktreeId: treeB,
      agentId: agentB.id,
      cwd: secondRepo,
    });
    const claimed = claimWriter({}, treeA, "task-a");
    expect(claimed.ok).toBe(true);
    if (claimed.ok) {
      const conflict = claimWriter(claimed.claims, treeA, "task-b");
      expect(conflict.ok).toBe(false);
    }
    const separate = claimWriter(claimed.ok ? claimed.claims : {}, treeB, "task-b");
    expect(separate.ok).toBe(true);

    await applyTask("task-a", {
      id: "instr-a",
      type: "instruction",
      actor: "alice",
      role: "driver",
      text: "alice owns this",
    });
    const revision = readTask("task-a")?.state.revision;
    await applyTask("task-a", { id: "note", type: "comment", actor: "bob", text: "looks fine" });
    await applyTask("task-a", {
      id: "viewer",
      type: "instruction",
      actor: "bob",
      role: "viewer",
      text: "I will do it",
    });
    expect(readTask("task-a")?.state.revision).toBe(revision);

    await applyTask("task-a", { id: "take", type: "control", action: "takeover", actor: "bob" });
    await expect(alice.sendAgentMessage(agentA.id, "go")).rejects.toThrow(/cowork gate: held/);
    await expect(bob.sendAgentMessage(agentA.id, "mine")).rejects.toThrow(/cowork gate: held/);
    expect(turns).toBe(0);
    await applyTask("task-a", { id: "early", type: "control", action: "release", actor: "bob" });
    expect(readTask("task-a")?.state.holdDispatch).toBe(true);
    await applyTask("task-a", { id: "settled", type: "writer.settled", epoch: 2 });
    await applyTask("task-a", { id: "back", type: "control", action: "release", actor: "bob" });
    expect(readTask("task-a")?.state.writerId).toBe("alice");
    expect(readTask("task-a")?.state.holdDispatch).toBe(false);
    await alice.sendAgentMessage(agentA.id, "go");
    expect(turns).toBe(1);
    await expect(bob.sendAgentMessage(agentA.id, "still not mine")).rejects.toThrow(
      /cowork gate: writer/,
    );
    expect(turns).toBe(1);
  } finally {
    for (const id of agents) syncManagedAgent(id, null);
    await forgetJournal();
    await alice.close().catch(() => undefined);
    await bob.close().catch(() => undefined);
    await daemon.close();
    rmSync(root, { recursive: true, force: true });
  }
}, 180000);
