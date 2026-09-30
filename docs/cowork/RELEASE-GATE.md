# Release gate

Not a release. No signing key is in this repo. No staging host is contacted. Cutover is closed.

| Package | Status | Evidence |
| --- | --- | --- |
| W0 | accepted | `docs/cowork/W0-REPORT.md` |
| W1 | not accepted | `w1-session.e2e.test.ts` shows sessions, files, and that closing the client leaves the daemon up. Tauri does not compile. |
| W2 | not accepted | `w2-same-run.e2e.test.ts` is two local clients and one fake provider. Same message id is not run twice. Official Codex is not admitted. |
| W3 | local evidence | `task-w3.e2e.test.ts` |
| W4 | not accepted | `w4-control.e2e.test.ts` is two principals and two worktrees. Hermes and Grokbot are not running. |
| W5 | not accepted | `ui-parity.ts` and `w5-history.test.ts`. Claude and Codex are not admitted. |
| W6 | not accepted | this file. `w6-journal.test.ts` migrates an old wrapper and restores a snapshot. |

A package marked `not accepted` is not cleared for cutover.
