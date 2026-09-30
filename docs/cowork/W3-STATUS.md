# W3 status

Local daemon only. Not W1, not W2, and not a second person.

The plan's evidence for this package is: a task can take another instruction, a failed check can be reworked and verified again, and a restart reconciles an in-flight command instead of leaving it running with no owner.

| Check | Result |
| --- | --- |
| Restart | An instruction left `inflight`. A second daemon on the same home marked that command `unknown` and held send. The phase was not `verified`. |
| Rework | The first turn did not commit. The task stayed unverified and `reworkAttempts` became 1. The next turn committed. The daemon verified revision 1. |
| Append | A further instruction reopened the task at revision 2. Waiting did not let the previous commit close it. A new commit did. |

`task-w3.e2e.test.ts` passed, 2 tests. The turns are still the in-process fake `claude` client. No official Codex, no Tauri window, no second principal.
