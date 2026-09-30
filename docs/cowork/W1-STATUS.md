# W1 status

Not accepted. No live daemon. The Tauri shell did not compile. The imported App still throws on `host.pty.onOutput` during mount.

## What landed

| Area | Result |
| --- | --- |
| BAT UI | Imported at `41ea2b1`. MIT notice kept. Agent SDKs and the sidecar were not imported. |
| Host | Dropped namespaces throw `UNSUPPORTED_CAPABILITY`. Workspace reads use a disconnected port. They do not read a local workspace JSON file. |
| Shell | New crate, id `dev.teddashh.bat-cowork`, updater absent, CSP not null. `cargo check` exit 101: `pkg-config` missing, `glib-sys` build script failed. Full text in `apps/bat-desktop/BUILD.md`. |
| Renderer bundle | `npx vite build` in `apps/bat-desktop` exited 0. That is a static bundle, not a running shell. |
| Client | `packages/client/src/cowork` read-only facade. Checkout diff methods exist on `DaemonClient` only and are not wrapped. 7 tests passed. |
| Task core | In-memory `step` in `packages/cowork-core`. 12 tests passed, including the original W0 inventory. `SESSION_INGRESS` is still `not-wired`. |

## Tests run here

- `node --test test/host-unsupported.test.mjs` in `apps/bat-desktop` — 4 passed
- `node --experimental-strip-types --test src/cowork/*.test.ts` in `packages/client` — 7 passed
- `node --experimental-strip-types --test test/*.test.ts` in `packages/cowork-core` — 12 passed

## Next gate

Plug `WorkspaceReadPort` into a non-production Paseo daemon and show workspace, session, and diff without spawning an agent. Until that connection is real, do not open mutations.
