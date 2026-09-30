# Desktop read

The browser shell, not the Tauri window. `cargo` still does not compile here.

Open the Vite app with `?daemon=ws://127.0.0.1:PORT/ws`. `connectDaemonWorkspace` connects and installs `DaemonWorkspaceReadPort`. Without that query, the port stays disconnected and does not read a local workspace file.

`desktop-read.e2e.test.ts` passed against a local test daemon:

| Read | Result |
| --- | --- |
| Workspace list | JSON the store can apply. `folderPath` is the repo. `terminals` is empty. |
| Files | `README.md` is listed and its contents are read. |
| Diff and status | The uncommitted marker is in the diff text and the status entry. |
| Branch and root | `main` and the repo path, from checkout status. |
| Writes | The port has no `createWorkspace` or `sendAgentMessage`. `home()` still throws. |

`gitLog` returns `[]`. Checkout status has no commit list. That empty array is not a claim that the repo has no commits. It keeps GitPanel from discarding the status and diff.

Listeners the App subscribes to on mount (`workspace.onDetached`, `workspace.onReload`, `fs.onChanged`, and the two app listeners) return an unsubscribe and deliver nothing. `fs.watch` / `fs.unwatch` resolve and do not install a watch. PTY create, write, and kill still throw.

`vite build` produced the connect chunk. This was not opened in a Tauri webview.
