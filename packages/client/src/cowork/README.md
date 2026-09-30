# Cowork read-only client boundary

Not W1 acceptance. No live daemon was connected. Nothing here was run against a Paseo daemon, a Tauri shell, or a production host.

## What is in this folder

`@getpaseo/client/cowork` (this source, emitted to `dist/cowork/index.js`).

1. `createNativeDaemonTransport` builds a `DaemonTransportFactory` by calling `createWebSocketTransportFactory` with an injected WebSocket factory. This file is the only module that looks at request headers. It throws `BrowserAuthorizationError` if an `Authorization` header would be handed to `defaultWebSocketFactory` or to a factory flagged `kind: "browser"`. `defaultWebSocketFactory` does not pass headers through; `nativeWebSocketFactory` does, but this wrapper does not call it. The host injects the socket factory.

   Public `createPaseoClient` / `PaseoClientConfig` do not accept `transportFactory`. The field is `DaemonClientConfig.transportFactory` on `@getpaseo/client/internal/daemon-client`. This wrapper only returns that factory. It does not construct a `DaemonClient` and it does not open a socket on its own.

2. `createReadOnlyPaseoClient` is a facade over public read methods. `assertReadOnly` throws when a method token is one of `send`, `create`, `cancel`, `write`, `commit`, `merge`, `push`.

The caller keeps the `PaseoClient` for `connect` / `close`. This facade does not connect.

## Real public methods that are forwarded

From `createPaseoApi` in `packages/client/src/index.ts`:

| Facade | Public method | What it actually calls |
| --- | --- | --- |
| `workspaces.list` | `workspaces.list` | `DaemonClient.fetchWorkspaces` when `subscribe` is omitted |
| `workspaces.ref().current` / `.refresh` | same names on `PaseoWorkspaceHandle` | `refresh` pages `fetchWorkspaces` |
| `agents.list` | `agents.list` | `DaemonClient.fetchAgents` when `subscribe` is omitted |
| `agents.ref().refresh` | `agents.ref().refresh` | `DaemonClient.fetchAgent`. There is no public `fetchAgent`. |
| `agents.ref().current` | `agents.ref().current` | last snapshot on the handle |
| `agents.ref().timeline.refetch` | `timeline.refetch` | `DaemonClient.fetchAgentTimeline`. There is no public `fetchAgentTimeline`. |
| `agents.ref().commands` | `commands` | `DaemonClient.listCommands` |
| `projects.list` | `projects.list` | `DaemonClient.listProjects` |

The facade returns new objects. It does not return the underlying workspace, agent, or terminal handle, so these public writes are not reachable from it: `workspaces.create`, `workspaces.open`, `workspaces.archive`, `setTitle`, `agents.create`, `send`, `run`, `respondToPermission`, `archive`, `detach`, `timeline.append`, `terminals.create`, `terminals.ref().write`, `terminals.ref().sendKeys` (stdin), `config.patch`.

## Gaps — methods that do not exist on the public client

Do not add these names to the facade. They exist on `DaemonClient` only:

- `getCheckoutStatus`
- `getCheckoutDiff`
- `observeCheckoutDiff`
- `listCheckoutCommits`
- `getCommitFileDiff`
- `checkoutPrStatus`
- `listDirectory`
- `readFile`

`checkoutCommit`, `checkoutMerge`, `checkoutPush`, `writeFile`, `sendAgentMessage`, and `cancelAgent` are also DaemonClient-only, and they are writes. They are not wrapped.

These public reads exist and are not forwarded in this pass: `workspaces.subscribe`, `agents.subscribe`, `providers.*`, `config.get`, `terminals.list`. `config.get` sits beside `config.patch`. `terminals.list` sits beside terminal stdin. No stream was exercised against a daemon.

## Tests

From `packages/client`, with no package install and no daemon:

```
node --experimental-strip-types --test src/cowork/*.test.ts
```

Node does not rewrite `.js` import specifiers to `.ts`. The test file registers `ts-js-specifier-hook.mjs` before loading these sources. That is a test harness, not a daemon test.

This is not W1 acceptance.
