import assert from "node:assert/strict";
import test from "node:test";
import { evaluateDispatch } from "../src/dispatch-policy.ts";
import { SESSION_INGRESS } from "../src/session-ingress.ts";
import { claimWriter, createTask, step, type TaskState } from "../src/task-core.ts";

function base() {
  return createTask({ id: "t1", driverId: "hermes-a", worktreeId: "wt-a" });
}

test("step is reentrant and comment does not bump revision", () => {
  const state = base();
  const event = { id: "e1", type: "comment" as const, actor: "ted", text: "looks fine" };
  const a = step(state, event);
  const b = step(state, event);
  assert.deepEqual(a, b);
  assert.equal(a.state.revision, 0);
  assert.equal(a.intents.length, 0);
  assert.equal(a.state.timeline[0]?.kind, "comment");
});

test("proposal does not change revision; viewer instruction is rejected", () => {
  const proposed = step(base(), { id: "p1", type: "proposal", actor: "hermes-b", text: "try x" });
  assert.equal(proposed.state.revision, 0);
  assert.equal(proposed.intents.length, 0);
  const denied = step(base(), {
    id: "i0",
    type: "instruction",
    actor: "ted",
    role: "viewer",
    text: "do it",
  });
  assert.equal(denied.state.revision, 0);
  assert.equal(denied.intents.length, 0);
});

test("driver instruction bumps revision once and dispatches one command", () => {
  const event = {
    id: "i1",
    type: "instruction" as const,
    actor: "hermes-a",
    role: "driver" as const,
    text: "fix login",
  };
  const first = step(base(), event);
  assert.equal(first.state.revision, 1);
  assert.equal(first.intents.length, 1);
  assert.equal(first.intents[0]?.type, "dispatch");
  const second = step(first.state, event);
  assert.equal(second.state.revision, 1);
  assert.equal(second.intents.length, 0);
  assert.equal(second.state, first.state);
});

test("runtime end and exit 0 do not verify; old evidence cannot close a new revision", () => {
  let state = step(base(), {
    id: "i1",
    type: "instruction",
    actor: "hermes-a",
    role: "driver",
    text: "fix login",
  }).state;
  state = step(state, { id: "a1", type: "assistant.finished", text: "done" }).state;
  state = step(state, { id: "s1", type: "stream.ended" }).state;
  state = step(state, { id: "x1", type: "process.exited", exitCode: 0 }).state;
  assert.equal(state.phase, "active");
  const stale = step(state, {
    id: "v0",
    type: "verify.passed",
    evidence: { revision: 0, commit: "abc" },
  });
  assert.equal(stale.state.phase, "active");
  const ok = step(state, {
    id: "v1",
    type: "verify.passed",
    evidence: { revision: 1, commit: "abc" },
  });
  assert.equal(ok.state.phase, "verified");
  assert.equal(ok.intents[0]?.type, "notify");
  const notified = step(ok.state, { id: "n1", type: "notify.failed", outboxId: "out:v1" });
  assert.equal(notified.state.phase, "verified");
  assert.equal(notified.intents.length, 0);
  assert.equal(notified.state.outbox[0]?.failed, true);
});

test("unknown command is reconciled and not resent", () => {
  const started = step(base(), {
    id: "i1",
    type: "instruction",
    actor: "hermes-a",
    role: "driver",
    text: "fix login",
  });
  const commandId = started.intents[0]?.type === "dispatch" ? started.intents[0].commandId : "";
  const unknown = step(started.state, { id: "u1", type: "command.unknown", commandId });
  assert.equal(unknown.state.activeCommand?.outcome, "unknown");
  assert.equal(unknown.intents.some((intent) => intent.type === "dispatch"), false);
  assert.equal(unknown.state.liveness.kind, "blocker");
});

test("missing liveness is repaired with an unassigned blocker", () => {
  const broken = {
    ...base(),
    liveness: { kind: "command", commandId: "" },
  } as TaskState;
  const next = step(broken, { id: "c1", type: "comment", actor: "ted", text: "ping" });
  assert.equal(next.state.liveness.kind, "blocker");
  if (next.state.liveness.kind === "blocker") assert.equal(next.state.liveness.owner, "unassigned");
});

test("presence and lease expiry do not take the writer; takeover holds dispatch until settle and release", () => {
  let state = base();
  state = step(state, { id: "pr", type: "presence", actor: "ted" }).state;
  assert.equal(state.controlEpoch, 1);
  assert.equal(state.writerId, "hermes-a");
  state = step(state, { id: "ls", type: "lease.expired" }).state;
  assert.equal(state.writerId, "hermes-a");
  assert.equal(state.controlEpoch, 1);
  const taken = step(state, { id: "tk", type: "control", action: "takeover", actor: "ted" });
  assert.equal(taken.state.controlEpoch, 2);
  assert.equal(taken.state.writerId, "hermes-a");
  assert.equal(taken.state.holdDispatch, true);
  assert.equal(taken.intents.some((intent) => intent.type === "dispatch"), false);
  const early = step(taken.state, {
    id: "i2",
    type: "instruction",
    actor: "hermes-a",
    role: "driver",
    text: "more",
  });
  assert.equal(early.intents.length, 0);
  const rejected = step(taken.state, { id: "rel0", type: "control", action: "release", actor: "ted" });
  assert.equal(rejected.state.holdDispatch, true);
  const settled = step(taken.state, { id: "set", type: "writer.settled", epoch: 2 });
  const released = step(settled.state, { id: "rel", type: "control", action: "release", actor: "ted" });
  assert.equal(released.state.holdDispatch, false);
  assert.equal(released.state.writerId, "hermes-a");
});

test("rework stops at the cap", () => {
  let state = step(base(), {
    id: "i1",
    type: "instruction",
    actor: "hermes-a",
    role: "driver",
    text: "fix",
  }).state;
  const first = step(state, { id: "f1", type: "verify.failed" });
  assert.equal(first.intents[0]?.type, "repair");
  const second = step(first.state, { id: "f2", type: "verify.failed" });
  assert.equal(second.intents[0]?.type, "repair");
  const third = step(second.state, { id: "f3", type: "verify.failed" });
  assert.equal(third.intents.length, 0);
  assert.equal(third.state.liveness.kind, "blocker");
});

test("one worktree has one writer, and dispatch policy denies a stale write", () => {
  const first = claimWriter({}, "wt-a", "t1");
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const second = claimWriter(first.claims, "wt-a", "t2");
  assert.equal(second.ok, false);
  const other = claimWriter(first.claims, "wt-b", "t2");
  assert.equal(other.ok, true);
  assert.equal(
    evaluateDispatch({
      actor: "hermes-a",
      effect: "write",
      revision: 2,
      expectedRevision: 1,
      epoch: 1,
      expectedEpoch: 1,
      resourceWriter: "hermes-a",
      actorIsWriter: true,
      commandId: "c",
      alreadyDispatched: false,
    }).allow,
    false,
  );
  assert.equal(SESSION_INGRESS.every((row) => row.gate === "not-wired"), true);
});
