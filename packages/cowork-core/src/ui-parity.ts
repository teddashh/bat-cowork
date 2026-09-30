// What this tree actually wires from the BAT shell. Not a claim of UI parity.

export type ParityStatus = "wired" | "refused" | "missing" | "not-admitted";

export interface ParityRow {
  surface: string;
  status: ParityStatus;
  evidence: string;
}

export const UI_PARITY: readonly ParityRow[] = [
  { surface: "files", status: "wired", evidence: "DaemonWorkspaceReadPort listFiles and readFile" },
  { surface: "diff", status: "wired", evidence: "DaemonWorkspaceReadPort gitDiff and gitStatus" },
  { surface: "sessions", status: "wired", evidence: "DaemonWorkspaceReadPort listSessions" },
  { surface: "terminal", status: "refused", evidence: "pty.create, pty.write, and pty.kill throw" },
  {
    surface: "git-log",
    status: "wired",
    evidence: "DaemonWorkspaceReadPort gitLog uses checkout.commits.list",
  },
  { surface: "claude-provider", status: "not-admitted", evidence: "assertProviderAdmitted('claude')" },
  { surface: "codex-provider", status: "not-admitted", evidence: "assertProviderAdmitted('codex')" },
  { surface: "grok-provider", status: "not-admitted", evidence: "assertProviderAdmitted('grok')" },
];
