import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BAT_HOST_NAMESPACES } from "../src/host-namespaces.ts";
import { PROVIDERS, assertProviderAdmitted } from "../src/providers.ts";
import { SESSION_INGRESS, assertIngressGated } from "../src/session-ingress.ts";

const SESSION_FILE = new URL("../../server/src/server/session.ts", import.meta.url);
const CATALOG_FILE = new URL("../../app/src/data/acp-provider-catalog.ts", import.meta.url);

function sessionCases(source: string): string[] {
  const lines = source.split("\n");
  const found: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    if (lineNo < 2300 || lineNo > 3200) continue;
    const match = lines[i].match(/case "([^"]+)"/);
    if (!match || seen.has(match[1])) continue;
    seen.add(match[1]);
    found.push(match[1]);
  }
  return found;
}

test("session ingress matches the locked Session switch", () => {
  const source = readFileSync(SESSION_FILE, "utf8");
  const fromSource = sessionCases(source);
  const fromTable = SESSION_INGRESS.map((row) => row.type);
  assert.deepEqual(fromTable, fromSource);
  assert.equal(SESSION_INGRESS.length, 162);
  const managed = SESSION_INGRESS.filter((row) => row.gate === "managed-only").map((row) => row.type);
  assert.deepEqual(managed.sort(), ["create_agent_request", "send_agent_message_request"]);
  for (const row of SESSION_INGRESS) {
    if (row.gate !== "managed-only") assert.equal(row.gate, "not-wired");
  }
  const send = SESSION_INGRESS.find((row) => row.type === "send_agent_message_request");
  assert.equal(send?.effect, "write");
  assertIngressGated("send_agent_message_request");
  assert.throws(() => assertIngressGated("checkout_commit_request"), /not wired/);
});

test("BAT host map keeps the namespaces that must not survive as a second owner", () => {
  assert.equal(BAT_HOST_NAMESPACES.length, 30);
  const byName = Object.fromEntries(BAT_HOST_NAMESPACES.map((row) => [row.name, row.disposition]));
  assert.equal(byName.pty, "workspace");
  assert.equal(byName.update, "drop-bat-updater");
  assert.equal(byName.remote, "drop-bat-protocol");
  assert.equal(byName.claudeCli, "drop-local-agent");
  assert.equal(byName.runtime, "drop-sidecar");
  assert.equal(byName.app, "native");
  const names = BAT_HOST_NAMESPACES.map((row) => row.name);
  assert.equal(new Set(names).size, names.length);
});

test("no provider is admitted, and the Grok catalog row is the one in this tree", () => {
  assert.equal(PROVIDERS.every((row) => row.admittedForDispatch === false), true);
  for (const row of PROVIDERS) {
    assert.throws(() => assertProviderAdmitted(row.id), /not admitted/);
  }
  const catalog = readFileSync(CATALOG_FILE, "utf8");
  assert.match(catalog, /id:\s*"grok"/);
  assert.match(catalog, /\["grok",\s*"agent",\s*"stdio"\]/);
  assert.doesNotMatch(catalog, /id:\s*"antigravity"/);
  assert.equal(PROVIDERS.find((row) => row.id === "antigravity")?.status, "not-an-agent-provider");
});
