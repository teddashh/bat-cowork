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
import { assertProviderAdmitted } from "../../../../cowork-core/src/providers.ts";

test("two clients see one run, and the same message id does not run twice", async () => {
  expect(() => assertProviderAdmitted("codex")).toThrow(/not admitted/);
  let turns = 0;
  const tempRoot = mkdtempSync(path.join(tmpdir(), "bat-cowork-w2-"));
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
  const daemon = await createTestPaseoDaemon({
    agentClients: {
      claude: createTestAgentClient("claude", {
        onStartTurn: () => {
          turns += 1;
        },
      }),
    },
  });
  const app = new DaemonClient({
    url: `ws://127.0.0.1:${daemon.port}/ws`,
    appVersion: "0.1.82",
    clientId: "client-a",
  });
  const observer = new DaemonClient({
    url: `ws://127.0.0.1:${daemon.port}/ws`,
    appVersion: "0.1.82",
    clientId: "client-b",
  });
  let agentId = "";
  try {
    await app.connect();
    await observer.connect();
    const created = await app.createWorkspace({ source: { kind: "directory", path: repoDir } });
    const agent = await app.createAgent({ provider: "claude", cwd: repoDir, model: "test-model" });
    agentId = agent.id;
    await openTask({
      home: daemon.paseoHome,
      id: "task-w2",
      driverId: "client-a",
      worktreeId: created.workspace?.id ?? repoDir,
      agentId,
      cwd: repoDir,
    });
    await applyTask("task-w2", {
      id: "instr-1",
      type: "instruction",
      actor: "client-a",
      role: "driver",
      text: "once",
    });
    await app.sendAgentMessage(agentId, "run", { messageId: "key-1" });
    const seen = await observer.fetchAgents();
    expect(seen.entries.some((entry) => entry.agent.id === agentId)).toBe(true);
    await expect(app.sendAgentMessage(agentId, "run", { messageId: "key-1" })).rejects.toThrow(
      /cowork gate: duplicate/,
    );
    expect(turns).toBe(1);
    const still = await observer.fetchAgents();
    expect(still.entries.some((entry) => entry.agent.id === agentId)).toBe(true);
  } finally {
    if (agentId) syncManagedAgent(agentId, null);
    await forgetJournal();
    await app.close().catch(() => undefined);
    await observer.close().catch(() => undefined);
    await daemon.close();
    rmSync(tempRoot, { recursive: true, force: true });
  }
}, 180000);
