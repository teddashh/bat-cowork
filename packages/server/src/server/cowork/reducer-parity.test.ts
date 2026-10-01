import { expect, test } from "vitest";
import { createTask as bundledCreate, step as bundledStep } from "./reducer.js";
import {
  createTask as sourceCreate,
  step as sourceStep,
} from "../../../../cowork-core/src/task-core.ts";

test("the bundled reducer matches cowork-core for pause, release, and verify", () => {
  const input = { id: "t", driverId: "driver", worktreeId: "wt" };
  let bundled = bundledCreate(input);
  let source = sourceCreate(input);
  const events = [
    { id: "i", type: "instruction" as const, actor: "driver", role: "driver" as const, text: "go" },
    { id: "p", type: "control" as const, action: "pause" as const, actor: "driver" },
    { id: "r0", type: "control" as const, action: "release" as const, actor: "other" },
    { id: "r1", type: "control" as const, action: "release" as const, actor: "driver" },
    { id: "u", type: "command.unknown" as const, commandId: "cmd:i" },
    { id: "r2", type: "control" as const, action: "release" as const, actor: "driver" },
    { id: "vf", type: "verify.failed" as const },
  ];
  for (const event of events) {
    bundled = bundledStep(bundled, event).state;
    source = sourceStep(source, event).state;
    expect(bundled).toEqual(source);
  }
});
