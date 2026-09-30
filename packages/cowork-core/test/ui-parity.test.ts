import assert from "node:assert/strict";
import test from "node:test";
import { UI_PARITY } from "../src/ui-parity.ts";
import { assertProviderAdmitted } from "../src/providers.ts";

test("parity names the wired reads and does not admit a provider", () => {
  const bySurface = new Map(UI_PARITY.map((row) => [row.surface, row.status]));
  assert.equal(bySurface.get("files"), "wired");
  assert.equal(bySurface.get("diff"), "wired");
  assert.equal(bySurface.get("sessions"), "wired");
  assert.equal(bySurface.get("terminal"), "refused");
  assert.equal(bySurface.get("git-log"), "wired");
  assert.equal(bySurface.get("task-comment"), "wired");
  assert.equal(bySurface.get("task-instruction"), "missing");
  for (const id of ["claude", "codex", "grok"]) {
    assert.equal(bySurface.get(`${id}-provider`), "not-admitted");
    assert.throws(() => assertProviderAdmitted(id), /not admitted/);
  }
});
