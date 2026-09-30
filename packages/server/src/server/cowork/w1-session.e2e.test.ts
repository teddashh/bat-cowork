import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { DaemonWorkspaceReadPort } from "../../../../../apps/bat-desktop/renderer/src/hosts/daemon-workspace-port.ts";
import { DaemonClient } from "../test-utils/index.js";
import { createTestPaseoDaemon } from "../test-utils/paseo-daemon.js";

test("closing the client leaves the daemon session, files, and diff in place", async () => {
  const tempRoot = mkdtempSync(path.join(tmpdir(), "bat-cowork-w1-"));
  const repoDir = path.join(tempRoot, "repo");
  execFileSync("git", ["init", "-b", "main", repoDir], { stdio: "pipe" });
  execFileSync("git", ["config", "user.email", "test@bat-cowork.local"], { cwd: repoDir, stdio: "pipe" });
  execFileSync("git", ["config", "user.name", "BAT Cowork Test"], { cwd: repoDir, stdio: "pipe" });
  writeFileSync(path.join(repoDir, "README.md"), "base\n");
  execFileSync("git", ["add", "README.md"], { cwd: repoDir, stdio: "pipe" });
  execFileSync("git", ["-c", "commit.gpgsign=false", "commit", "-m", "initial"], {
    cwd: repoDir,
    stdio: "pipe",
  });
  writeFileSync(path.join(repoDir, "README.md"), "w1-session-marker\n");
  const daemon = await createTestPaseoDaemon();
  const first = new DaemonClient({
    url: `ws://127.0.0.1:${daemon.port}/ws`,
    appVersion: "0.1.82",
    clientId: "reader-a",
  });
  try {
    await first.connect();
    const created = await first.createWorkspace({ source: { kind: "directory", path: repoDir } });
    expect(created.error ?? null).toBeNull();
    const agent = await first.createAgent({ provider: "claude", cwd: repoDir, model: "test-model" });
    const port = new DaemonWorkspaceReadPort(first);
    const sessions = await port.listSessions();
    expect(sessions.some((session) => session.id === agent.id)).toBe(true);
    const files = await port.listFiles(repoDir);
    expect(files.some((file) => file.name === "README.md")).toBe(true);
    expect(await port.gitDiff({ cwd: repoDir })).toContain("w1-session-marker");
    await first.close();

    const second = new DaemonClient({
      url: `ws://127.0.0.1:${daemon.port}/ws`,
      appVersion: "0.1.82",
      clientId: "reader-b",
    });
    await second.connect();
    const again = await new DaemonWorkspaceReadPort(second).listSessions();
    expect(again.some((session) => session.id === agent.id)).toBe(true);
    const listed = JSON.parse((await new DaemonWorkspaceReadPort(second).listWorkspaces()) ?? "null") as {
      workspaces: { folderPath: string }[];
    };
    expect(listed.workspaces.some((workspace) => workspace.folderPath === repoDir)).toBe(true);
    await second.close();
  } finally {
    await first.close().catch(() => undefined);
    await daemon.close();
    rmSync(tempRoot, { recursive: true, force: true });
  }
}, 180000);
