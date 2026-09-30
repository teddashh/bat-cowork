# @bat-cowork/cowork-core

Pure in-memory task reducer. `managedWriteFields` is what the server copies onto a managed agent. `send_agent_message_request` and `create_agent_request` are `managed-only`: an unregistered agent still takes the stock path. No provider is admitted.

```sh
node --experimental-strip-types --test test/*.test.ts
```
