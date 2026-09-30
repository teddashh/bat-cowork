import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { DaemonWorkspaceReadPort } from "../../../../../apps/bat-desktop/renderer/src/hosts/daemon-workspace-port.ts";
import { DaemonClient } from "../test-utils/index.js";
import { createTestPaseoDaemon } from "../test-utils/paseo-daemon.js";

function gitRepo(): { repoDir: string; tempRoot: string } {
  const tempRoot = mkdtempSync(path.join(tmpdir(), "bat-cowork-desktop-read-"));
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

test("the desktop read port lists a daemon workspace, a file, and a diff", async () => {
  const daemon = await createTestPaseoDaemon();
  const { repoDir, tempRoot } = gitRepo();
  const client = new DaemonClient({
    url: `ws://127.0.0.1:${daemon.port}/ws`,
    appVersion: "0.1.82",
  });
  const port = new DaemonWorkspaceReadPort(client);
  try {
    await client.connect();
    const created = await client.createWorkspace({
      source: { kind: "directory", path: repoDir },
    });
    expect(created.error ?? null).toBeNull();
    writeFileSync(path.join(repoDir, "README.md"), "desktop-read-marker\n");

    const raw = await port.listWorkspaces();
    const parsed = JSON.parse(raw ?? "null") as {
      workspaces: { id: string; folderPath: string; name: string }[];
      terminals: unknown[];
    };
    expect(parsed.terminals).toEqual([]);
    expect(parsed.workspaces.some((workspace) => workspace.folderPath === repoDir)).toBe(true);

    const files = await port.listFiles(repoDir);
    expect(files.some((file) => file.name === "README.md" && !file.isDirectory)).toBe(true);

    const read = await port.readFile(path.join(repoDir, "README.md"));
    expect(read.content).toContain("desktop-read-marker");

    const diff = await port.gitDiff({ cwd: repoDir });
    expect(diff).toContain("desktop-read-marker");
    const status = await port.gitStatus(repoDir);
    expect(status.some((entry) => entry.file.endsWith("README.md"))).toBe(true);
    expect(await port.gitBranch(repoDir)).toBe("main");
    expect(await port.gitRoot(repoDir)).toBe(repoDir);
    expect(await port.gitLog(repoDir)).toEqual([]);

    await expect(port.home()).rejects.toThrow(/DAEMON_READ_UNSUPPORTED/);
    expect("createWorkspace" in port).toBe(false);
    expect("sendAgentMessage" in port).toBe(false);
  } finally {
    await client.close().catch(() => undefined);
    await daemon.close();
    rmSync(tempRoot, { recursive: true, force: true });
  }
}, 180000);
