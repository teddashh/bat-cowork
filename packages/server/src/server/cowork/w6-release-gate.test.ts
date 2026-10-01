import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

// Table cells are trimmed, so the check does not depend on how the formatter pads columns.
function tableRows(markdown: string): string[][] {
  return markdown
    .split("\n")
    .filter((line) => line.startsWith("|"))
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );
}

test("the release gate does not clear cutover", () => {
  const gate = readFileSync(
    new URL("../../../../../docs/cowork/RELEASE-GATE.md", import.meta.url),
    "utf8",
  );
  const rows = tableRows(gate).filter(([id]) => /^W\d+$/.test(id ?? ""));
  const ids = rows.map(([id]) => id);
  for (const id of ["W0", "W1", "W2", "W3", "W4", "W5", "W6"]) {
    expect(ids).toContain(id);
  }
  expect(gate).toContain("Not a release");
  expect(gate).toContain("Cutover is closed");
  expect(gate).not.toMatch(/BEGIN [A-Z ]*PRIVATE KEY/);
  const accepted = rows.filter(([, status]) => status === "accepted");
  expect(accepted.map(([id]) => id)).toEqual(["W0"]);
});
