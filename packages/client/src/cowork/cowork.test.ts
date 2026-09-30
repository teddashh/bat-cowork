import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import test from "node:test";
import type { PublicReadSource } from "./read-only-client.ts";

register(new URL("./ts-js-specifier-hook.mjs", import.meta.url));

const { createNativeDaemonTransport } = await import("./tauri-transport.ts");
const { PUBLIC_CLIENT_READ_GAPS, assertReadOnly, createReadOnlyPaseoClient } = await import(
  "./read-only-client.ts"
);
const { defaultWebSocketFactory } = await import("../daemon-client-websocket-transport.ts");
const entryModule = await import("./index.ts");

function fakeSocket() {
  return {
    readyState: 1,
    binaryType: "blob",
    send() {},
    close() {},
    addEventListener() {},
    removeEventListener() {},
  };
}

test("cowork entry re-exports the wrapper and the facade", () => {
  assert.equal(entryModule.createNativeDaemonTransport, createNativeDaemonTransport);
  assert.equal(entryModule.assertReadOnly, assertReadOnly);
  assert.equal(entryModule.createReadOnlyPaseoClient, createReadOnlyPaseoClient);
  assert.ok(entryModule.PUBLIC_CLIENT_READ_GAPS.includes("getCheckoutDiff"));
});

test("constructing with a browser factory and Authorization throws", () => {
  let calls = 0;
  const browserFactory = Object.assign(
    () => {
      calls += 1;
      return fakeSocket();
    },
    { kind: "browser" as const },
  );

  assert.throws(
    () =>
      createNativeDaemonTransport({
        webSocketFactory: browserFactory,
        headers: { Authorization: "Bearer secret" },
      }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /Authorization/);
      return true;
    },
  );

  const open = createNativeDaemonTransport({ webSocketFactory: browserFactory });
  assert.throws(
    () =>
      open({
        url: "ws://127.0.0.1:9/ws",
        headers: { authorization: "Bearer secret" },
      }),
    /Authorization/,
  );
  assert.equal(calls, 0);
});

test("defaultWebSocketFactory plus Authorization throws", () => {
  assert.throws(
    () =>
      createNativeDaemonTransport({
        webSocketFactory: defaultWebSocketFactory,
        headers: { Authorization: "Bearer secret" },
      }),
    /defaultWebSocketFactory/,
  );
});

test("a native injected factory receives the headers", () => {
  const seen: Array<{ url: string; headers?: Record<string, string> }> = [];
  const nativeFactory = Object.assign(
    (url: string, options?: { headers?: Record<string, string> }) => {
      seen.push({ url, headers: options?.headers });
      return fakeSocket();
    },
    { kind: "native" as const },
  );

  const open = createNativeDaemonTransport({ webSocketFactory: nativeFactory });
  open({
    url: "ws://127.0.0.1:9/ws",
    headers: { Authorization: "Bearer secret" },
  });

  assert.deepEqual(seen, [
    {
      url: "ws://127.0.0.1:9/ws",
      headers: { Authorization: "Bearer secret" },
    },
  ]);
});

test("assertReadOnly('send') throws and assertReadOnly('listWorkspaces') does not", () => {
  assert.throws(() => assertReadOnly("send"), /refuses/);
  for (const method of ["create", "cancel", "write", "commit", "merge", "push", "createAgent"]) {
    assert.throws(() => assertReadOnly(method), /refuses/);
  }
  assert.doesNotThrow(() => assertReadOnly("listWorkspaces"));
  assert.doesNotThrow(() => assertReadOnly("getCheckoutDiff"));
});

test("facade forwards public list and fetch names and hides writes", async () => {
  const calls: string[] = [];
  const source = {
    workspaces: {
      list: async () => {
        calls.push("workspaces.list");
        return { requestId: "w", entries: [], pageInfo: {} };
      },
      ref: () => ({
        id: "ws-1",
        projectId: "project-1",
        directory: "/tmp/demo",
        name: "demo",
        status: "active",
        current: () => null,
        refresh: async () => {
          calls.push("workspaces.refresh");
          return null;
        },
      }),
    },
    agents: {
      list: async () => {
        calls.push("agents.list");
        return { requestId: "a", entries: [], pageInfo: {} };
      },
      ref: () => ({
        id: "agent-1",
        workspaceId: "ws-1",
        cwd: "/tmp/demo",
        status: "idle",
        current: () => {
          calls.push("agents.current");
          return null;
        },
        refresh: async () => {
          calls.push("agents.refresh");
          return null;
        },
        timeline: {
          refetch: async () => {
            calls.push("timeline.refetch");
            return {};
          },
        },
        commands: async () => {
          calls.push("agents.commands");
          return {};
        },
        send: () => {
          calls.push("agents.send");
        },
      }),
    },
    projects: {
      list: async () => {
        calls.push("projects.list");
        return { requestId: "p", projects: [] };
      },
    },
  } as unknown as PublicReadSource;

  const facade = createReadOnlyPaseoClient(source);
  await facade.workspaces.list();
  await facade.projects.list();
  await facade.agents.list();
  const workspace = facade.workspaces.ref("ws-1");
  await workspace.refresh();
  const agent = facade.agents.ref("agent-1");
  agent.current();
  await agent.refresh();
  await agent.timeline.refetch();
  await agent.commands();

  assert.deepEqual(calls, [
    "workspaces.list",
    "projects.list",
    "agents.list",
    "workspaces.refresh",
    "agents.current",
    "agents.refresh",
    "timeline.refetch",
    "agents.commands",
  ]);
  assert.equal("send" in facade, false);
  assert.equal("create" in facade.agents, false);
  assert.equal("createAgent" in facade, false);
  assert.equal("send" in agent, false);
  assert.equal("run" in agent, false);
  assert.equal("cancel" in agent, false);
  assert.equal("append" in agent.timeline, false);
  assert.equal("archive" in workspace, false);
  assert.equal("setTitle" in workspace, false);
  assert.equal("agents" in workspace, false);
  assert.equal("terminals" in workspace, false);
  assert.equal("write" in facade, false);
  for (const gap of ["getCheckoutDiff", "getCheckoutStatus", "listDirectory", "readFile"]) {
    assert.equal(gap in facade, false);
    assert.ok(PUBLIC_CLIENT_READ_GAPS.includes(gap as (typeof PUBLIC_CLIENT_READ_GAPS)[number]));
  }
});

test("only tauri-transport knows about Authorization headers", () => {
  const readOnly = readFileSync(new URL("./read-only-client.ts", import.meta.url), "utf8");
  const entry = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
  const transport = readFileSync(new URL("./tauri-transport.ts", import.meta.url), "utf8");
  assert.equal(/authorization/i.test(readOnly), false);
  assert.equal(/\bheaders?\b/i.test(readOnly), false);
  assert.equal(/\bheaders?\b/i.test(entry), false);
  assert.match(transport, /createWebSocketTransportFactory/);
  assert.match(transport, /defaultWebSocketFactory/);
  assert.match(transport, /Authorization/);
});
