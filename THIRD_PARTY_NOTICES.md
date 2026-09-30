# Third-party notices

bat-cowork is a derivative work. It is not an official Paseo, Better Agent Terminal, Goose, or xAI release.

## Paseo

The server, client, protocol, CLI, and the rest of the upstream tree come from
[getpaseo/paseo](https://github.com/getpaseo/paseo) at commit
`53ee9cd9930d9479af318c1ed29713a0bfb5f47b`.

Copyright (c) 2025-present Mohamed Boudra and other Paseo contributors.

Paseo itself is Apache-2.0, except third-party components that keep their own
licenses. Those notices stay in the upstream `LICENSE` and in the package trees.
See [LICENSE](LICENSE). Do not remove upstream copyright or license text when
renaming the product.

## Better Agent Terminal

The desktop UI will be imported from
[tony1223/better-agent-terminal](https://github.com/tony1223/better-agent-terminal)
at commit `41ea2b1e9142c9383d4b7813d754cb4a03dd0ace` (MIT). That import has not
happened. W0 only records the host-namespace map from
`renderer/src/host-api.ts` (blob `2dd7e9ea02947f21947165610c41c47367a94b22`).

When the UI is imported, keep the original MIT copyright notice with the files,
and do not reuse the upstream app id, updater endpoint, or update public key.

## bat-agent-connector

Behavior reference: [teddashh/bat-agent-connector](https://github.com/teddashh/bat-agent-connector)
at `71337aa5133fc04bf332d3da15e819c16585c7a3` (MIT). The Python task daemon is
not vendored and is not a runtime of this product.

## Not included

This tree does not copy Goose, HAPI, or Agor code. Goose remains a design
reference only. The ACP catalog entry for Goose that already exists inside
Paseo is upstream code, not a new dependency added by bat-cowork, and it is
not an admitted executor.
