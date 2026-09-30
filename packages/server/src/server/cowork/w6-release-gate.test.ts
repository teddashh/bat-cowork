import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

test("the release gate does not clear cutover", () => {
  const gate = readFileSync(new URL("../../../../../docs/cowork/RELEASE-GATE.md", import.meta.url), "utf8");
  for (const id of ["W0", "W1", "W2", "W3", "W4", "W5", "W6"]) {
    expect(gate).toContain(`| ${id} |`);
  }
  expect(gate).toContain("Not a release");
  expect(gate).toContain("Cutover is closed");
  expect(gate).not.toMatch(/BEGIN [A-Z ]*PRIVATE KEY/);
  const rows = gate.split("\n").filter((line) => line.startsWith("| W"));
  const accepted = rows.filter((line) => line.includes("| accepted |"));
  expect(accepted.map((line) => line.slice(0, 6))).toEqual(["| W0 |"]);
});
