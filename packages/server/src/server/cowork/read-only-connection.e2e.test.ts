import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { createDaemonReadView } from "../../../../client/src/cowork/daemon-reads.ts";
import { DaemonClient } from "../test-utils/index.js";
import { createTestPaseoDaemon } from "../test-utils/paseo-daemon.js";

function gitRepo(): { repoDir: string; tempRoot: string } {
  const tempRoot = mkdtempSync(path.join(tmpdir(), "bat-cowork-read-"));
  const repoDir = path.join(tempRoot, "repo");
  execFileSync("git", ["init", "-b", "main", repoDir], { stdio: "pipe" });
  execFileSync("git", ["config", "user.email", "test@bat-cowork.local"], {
    cwd: repoDir,
    stdio: "pipe",
  });
  execFileSync("git", ["config", "user.name", "BAT Cowork Test"], { cwd: repoDir, stdio: "pipe" });
  writeFileSync(path.join(repoDir, "README.md"), "read only\n");
  execFileSync("git", ["add", "README.md"], { cwd: repoDir, stdio: "pipe" });
  execFileSync("git", ["-c", "commit.gpgsign=false", "commit", "-m", "initial"], {
    cwd: repoDir,
    stdio: "pipe",
  });
  return { repoDir, tempRoot };
}

test("a read-only client sees a workspace, a file, and a diff on a local daemon", async () => {
  const daemon = await createTestPaseoDaemon();
  const { repoDir, tempRoot } = gitRepo();
  const client = new DaemonClient({
    url: `ws://127.0.0.1:${daemon.port}/ws`,
    appVersion: "0.1.82",
  });
  const reads = createDaemonReadView(client);
  try {
    await client.connect();
    const created = await client.createWorkspace({
      source: { kind: "directory", path: repoDir },
    });
    expect(created.error ?? null).toBeNull();
    const workspaceId = created.workspace?.id;
    expect(workspaceId).toEqual(expect.any(String));

    const listed = await reads.fetchWorkspaces();
    expect(listed.entries.some((entry) => entry.id === workspaceId)).toBe(true);

    const agents = await reads.fetchAgents();
    expect(agents).toBeTruthy();

    const directory = await reads.listDirectory(repoDir, ".");
    expect(JSON.stringify(directory)).toContain("README.md");

    const diff = await reads.getCheckoutDiff(repoDir, { mode: "uncommitted" });
    expect(diff).toBeTruthy();

    expect("createWorkspace" in reads).toBe(false);
    expect("sendAgentMessage" in reads).toBe(false);
  } finally {
    await client.close().catch(() => undefined);
    await daemon.close();
    rmSync(tempRoot, { recursive: true, force: true });
  }
}, 180000);
