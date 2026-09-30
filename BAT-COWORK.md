# bat-cowork

Server-first development workstation.

- The desktop is the BAT Tauri / React workflow. It is not imported yet.
- The daemon is this Paseo tree, locked at `53ee9cd9930d9479af318c1ed29713a0bfb5f47b`.
- Task rules will live in-process. There is no second Python task daemon.

This repository is not an official Paseo or Better Agent Terminal build.
Product name, app id, data directory, and update keys stay separate from both
upstreams. Automatic update is off until a new trust chain exists.

## Remotes

- `origin` — this product
- `upstream-paseo` — https://github.com/getpaseo/paseo

`baseline/paseo-w0` is the untouched snapshot. Product work lands on `main`
above that commit. Do not merge the BAT host back in.

## Status

W0 is the only accepted package. W3 has local evidence. W1, W2, W4, W5, and W6 are not accepted. See `docs/cowork/RELEASE-GATE.md`.

This round proved, on a local test daemon:

- W1: a second client still sees the session, the file, and the diff after the first client closes. Tauri still does not compile.
- W2: two clients see the same agent, its permission request, and its reply. The same message id does not start a second turn. A worktree created by the daemon receives the commit. The main checkout does not move. Codex is not admitted.
- W4: two worktrees, a viewer cannot pause or instruct, and takeover holds send until the writer settles. Grok is not admitted. Hermes and Grokbot are not running.
- W5: files, diff, and sessions are wired. The terminal is refused. Git log is missing. Two hundred comments reload without verifying the task.
- W6: an old `{ tasks }` wrapper migrates, and putting the journal file back rolls a later comment out. Cutover stays closed.

Not a release. Do not point this tree at a running production daemon or an existing BAT session.
