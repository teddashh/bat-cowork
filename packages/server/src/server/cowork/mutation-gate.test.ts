import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import {
  authorizeCoworkWrite,
  clearManagedWriteTarget,
  registerManagedWriteTarget,
} from "./mutation-gate.js";

const open = {
  writerId: "client-a",
  revision: 1,
  expectedRevision: 1,
  epoch: 1,
  expectedEpoch: 1,
  holdDispatch: false,
};

test("an unregistered agent is not blocked", () => {
  expect(
    authorizeCoworkWrite({
      kind: "agent",
      id: "missing",
      actor: "anyone",
      commandId: "m1",
    }).allow,
  ).toBe(true);
});

test("a managed agent denies a stale revision, the wrong writer, a held dispatch, and a replay", () => {
  registerManagedWriteTarget("agent", "agent-1", { ...open, expectedRevision: 0 });
  expect(
    authorizeCoworkWrite({ kind: "agent", id: "agent-1", actor: "client-a", commandId: "m1" }),
  ).toEqual({ allow: false, error: "cowork gate: revision" });

  registerManagedWriteTarget("agent", "agent-1", open);
  expect(
    authorizeCoworkWrite({ kind: "agent", id: "agent-1", actor: "other", commandId: "m1" }),
  ).toEqual({ allow: false, error: "cowork gate: writer" });

  registerManagedWriteTarget("agent", "agent-1", { ...open, holdDispatch: true });
  expect(
    authorizeCoworkWrite({ kind: "agent", id: "agent-1", actor: "client-a", commandId: "m1" }),
  ).toEqual({ allow: false, error: "cowork gate: held" });

  registerManagedWriteTarget("agent", "agent-1", { ...open, epoch: 2, expectedEpoch: 1 });
  expect(
    authorizeCoworkWrite({ kind: "agent", id: "agent-1", actor: "client-a", commandId: "m1" }),
  ).toEqual({ allow: false, error: "cowork gate: epoch" });

  registerManagedWriteTarget("agent", "agent-1", open);
  expect(
    authorizeCoworkWrite({ kind: "agent", id: "agent-1", actor: "client-a", commandId: "m1" }).allow,
  ).toBe(true);
  expect(
    authorizeCoworkWrite({ kind: "agent", id: "agent-1", actor: "client-a", commandId: "m1" }),
  ).toEqual({ allow: false, error: "cowork gate: duplicate" });
  clearManagedWriteTarget("agent", "agent-1");
});

test("send and create go through the gate in Session", () => {
  const source = readFileSync(new URL("../session.ts", import.meta.url), "utf8");
  const sendAt = source.indexOf("private async handleSendAgentMessageRequest");
  const createAt = source.indexOf("private async handleCreateAgentRequest");
  expect(sendAt).toBeGreaterThan(0);
  expect(createAt).toBeGreaterThan(0);
  const send = source.slice(sendAt, source.indexOf("private async", sendAt + 10));
  const create = source.slice(createAt, source.indexOf("private async", createAt + 10));
  expect(send).toContain("authorizeCoworkWrite");
  expect(create).toContain("authorizeCoworkWrite");
  expect(source).toContain('from "./cowork/mutation-gate.js"');
});
