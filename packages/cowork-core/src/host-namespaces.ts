// BAT renderer host namespaces at tony1223/better-agent-terminal
// 41ea2b1e9142c9383d4b7813d754cb4a03dd0ace
// file renderer/src/host-api.ts blob 2dd7e9ea02947f21947165610c41c47367a94b22.
// The BAT renderer is not imported into this repo yet. This table is the W0 map.

export type HostDisposition =
  | "native"
  | "workspace"
  | "split"
  | "ui-local"
  | "drop-local-agent"
  | "drop-bat-protocol"
  | "drop-bat-updater"
  | "drop-sidecar";

export interface HostNamespace {
  name: string;
  disposition: HostDisposition;
  note: string;
}

export const BAT_HOST_NAMESPACES: readonly HostNamespace[] = [
  { name: "systemVersion", disposition: "native", note: "OS version for the local shell only." },
  { name: "settings", disposition: "native", note: "Local shell path and client settings. Not shared workspace state." },
  { name: "runtime", disposition: "drop-sidecar", note: "Installs and clears managed agent runtimes. Paseo owns execution." },
  { name: "shell", disposition: "native", note: "Open/reveal local paths. Must not become an arbitrary remote shell." },
  { name: "dialog", disposition: "native", note: "Native file and folder pickers." },
  { name: "clipboard", disposition: "native", note: "Local clipboard." },
  { name: "image", disposition: "split", note: "Local image read stays native. Workspace attachments upload through the server." },
  { name: "fs", disposition: "split", note: "Client path is not a remote path. Workspace reads and writes go through the server." },
  { name: "update", disposition: "drop-bat-updater", note: "Do not keep the BAT app id, updater endpoint, or public key." },
  { name: "debug", disposition: "native", note: "Local diagnostics." },
  { name: "workspace", disposition: "workspace", note: "Shared workspace authority moves to the server. Layout prefs stay on the device." },
  { name: "profile", disposition: "split", note: "Window/profile chrome can stay local. Membership and credentials do not." },
  { name: "snippet", disposition: "ui-local", note: "Treat as device-local until a shared snippet model exists." },
  { name: "notification", disposition: "split", note: "OS notification is native. Task history must not re-notify on reconnect." },
  { name: "system", disposition: "native", note: "Resume and local notify." },
  { name: "app", disposition: "native", note: "Window id, title, dock badge, new window. Closing a window must not stop an agent." },
  { name: "github", disposition: "workspace", note: "Forge reads and writes go through the server gate." },
  { name: "codex", disposition: "drop-local-agent", note: "Account login and switching stay on the server profile, not in the client." },
  { name: "git", disposition: "workspace", note: "Status and diff are queries. commit, checkout, and merge are gated writes." },
  { name: "claude", disposition: "drop-local-agent", note: "Proxy over local Claude account and auto-continue. Do not keep a second owner." },
  { name: "claudeChannel", disposition: "drop-local-agent", note: "Local Claude channel events. Replace with a Paseo view model, do not fake Claude events." },
  { name: "claudeCli", disposition: "drop-local-agent", note: "startSession/stopSession spawn a local CLI. The client must not spawn agents." },
  { name: "remoteFs", disposition: "workspace", note: "Upload bytes to the server. Never send a client filesystem path as the remote path." },
  { name: "worktree", disposition: "workspace", note: "Create, remove, and merge are gated. Do not import BAT's cleanup defaults." },
  { name: "agent", disposition: "workspace", note: "Presets and usage are server discovery. Usage snapshot is not a quota guarantee." },
  { name: "workerBuffer", disposition: "drop-sidecar", note: "Procfile start/stop is a second process owner. Local scrollback may be rebuilt later." },
  { name: "remote", disposition: "drop-bat-protocol", note: "BAT remote server and token. Do not emulate that wire protocol." },
  { name: "remoteTunnel", disposition: "drop-bat-protocol", note: "BAT SSH tunnel helper for the old remote protocol." },
  { name: "tunnel", disposition: "drop-bat-protocol", note: "BAT tunnel connection object. Not the Paseo transport." },
  { name: "pty", disposition: "workspace", note: "xterm stays in the client. stdin and resize have one owner. Viewers do not write." },
];

export function hostNamespace(name: string): HostNamespace | undefined {
  return BAT_HOST_NAMESPACES.find((row) => row.name === name);
}
