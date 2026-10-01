import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import type { TimelineMessage } from "../../../client/src/timeline-subscription/index.ts";
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

function streamEvent(
  message: TimelineMessage,
): { type: string; request?: { id: string }; item?: { type?: string; text?: string } } | null {
  if (message.type !== "agent_stream") return null;
  return message.payload.event as {
    type: string;
    request?: { id: string };
    item?: { type?: string; text?: string };
  };
}

async function until(ready: () => boolean, label: string): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 8000) {
    if (ready()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`timed out waiting for ${label}`);
}

test("the other client sees the permission and the reply, and the same id does not run again", async () => {
  let turns = 0;
  const root = mkdtempSync(path.join(tmpdir(), "bat-cowork-w2-stream-"));
  const repoDir = gitRepo(root);
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
  let stop = () => {};
  try {
    await app.connect();
    await observer.connect();
    await app.createWorkspace({ source: { kind: "directory", path: repoDir } });
    const agent = await app.createAgent({ provider: "claude", cwd: repoDir, model: "test-model" });
    agentId = agent.id;
    await openTask({
      home: daemon.paseoHome,
      id: "task-stream",
      driverId: "client-a",
      worktreeId: repoDir,
      agentId,
      cwd: repoDir,
    });
    await applyTask("task-stream", {
      id: "instr-1",
      type: "instruction",
      actor: "client-a",
      role: "driver",
      text: "once",
    });
    const seen: string[] = [];
    let permissionId = "";
    const subscription = observer.subscribeAgentTimeline(agentId, (message) => {
      const event = streamEvent(message);
      if (!event) return;
      if (event.type === "permission_requested" && event.request?.id)
        permissionId = event.request.id;
      if (
        event.type === "timeline" &&
        event.item?.type === "assistant_message" &&
        event.item.text
      ) {
        seen.push(event.item.text);
      }
    });
    stop = () => {
      void subscription.release();
    };
    await app.sendAgentMessage(
      agentId,
      "rm -f permission.txt\nrespond with exactly: same-run-marker",
      {
        messageId: "key-stream",
      },
    );
    await until(() => permissionId.length > 0, "permission");
    await app.respondToPermission(agentId, permissionId, { behavior: "allow" });
    await until(() => seen.join("").includes("same-run-marker"), "reply");
    expect(turns).toBe(1);
    await expect(
      app.sendAgentMessage(agentId, "rm -f permission.txt", { messageId: "key-stream" }),
    ).rejects.toThrow(/cowork gate: duplicate/);
    expect(turns).toBe(1);
  } finally {
    try {
      stop();
    } catch {
      // Releasing the timeline must not skip the journal cleanup.
    }
    if (agentId) syncManagedAgent(agentId, null);
    await forgetJournal();
    await app.close().catch(() => undefined);
    await observer.close().catch(() => undefined);
    await daemon.close();
    rmSync(root, { recursive: true, force: true });
  }
}, 180000);

test("a daemon worktree gets the commit and the main checkout does not", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "bat-cowork-w2-tree-"));
  const repoDir = gitRepo(root);
  const mainHead = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repoDir,
    encoding: "utf8",
  }).trim();
  let worktree = "";
  const daemon = await createTestPaseoDaemon({
    agentClients: {
      claude: createTestAgentClient("claude", {
        onStartTurn: () => {
          if (!worktree) return;
          writeFileSync(path.join(worktree, "README.md"), "from the worktree\n");
          execFileSync("git", ["add", "README.md"], { cwd: worktree, stdio: "pipe" });
          execFileSync("git", ["-c", "commit.gpgsign=false", "commit", "-m", "worktree"], {
            cwd: worktree,
            stdio: "pipe",
          });
        },
      }),
    },
  });
  const client = new DaemonClient({
    url: `ws://127.0.0.1:${daemon.port}/ws`,
    appVersion: "0.1.82",
    clientId: "client-a",
  });
  let agentId = "";
  try {
    await client.connect();
    await client.createWorkspace({ source: { kind: "directory", path: repoDir } });
    const created = await client.createPaseoWorktree({ cwd: repoDir, worktreeSlug: "w2-leaf" });
    expect(created.error ?? null).toBeNull();
    worktree = created.workspace?.workspaceDirectory ?? "";
    expect(worktree).not.toBe("");
    expect(worktree).not.toBe(repoDir);
    const agent = await client.createAgent({
      provider: "claude",
      cwd: worktree,
      model: "test-model",
    });
    agentId = agent.id;
    await openTask({
      home: daemon.paseoHome,
      id: "task-tree",
      driverId: "client-a",
      worktreeId: created.workspace?.id ?? worktree,
      agentId,
      cwd: worktree,
    });
    await applyTask("task-tree", {
      id: "instr-1",
      type: "instruction",
      actor: "client-a",
      role: "driver",
      text: "commit in the worktree",
    });
    await client.sendAgentMessage(agentId, "do it");
    const started = Date.now();
    while (Date.now() - started < 8000) {
      if (readTask("task-tree")?.state.phase === "verified") break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(readTask("task-tree")?.state.phase).toBe("verified");
    const treeHead = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: worktree,
      encoding: "utf8",
    }).trim();
    expect(treeHead).not.toBe(mainHead);
    expect(
      execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoDir, encoding: "utf8" }).trim(),
    ).toBe(mainHead);
  } finally {
    if (agentId) syncManagedAgent(agentId, null);
    await forgetJournal();
    await client.close().catch(() => undefined);
    await daemon.close();
    rmSync(root, { recursive: true, force: true });
  }
}, 180000);
