# @bat-cowork/cowork-core

Pure in-memory task reducer. It does not connect to the Paseo daemon, does not admit a provider, and does not wire `evaluateDispatch` into `session.ts`. `SESSION_INGRESS` stays `not-wired`.

```sh
node --experimental-strip-types --test test/*.test.ts
```
