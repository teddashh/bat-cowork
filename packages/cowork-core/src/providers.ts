// Provider admission at the locked Paseo baseline.
// Catalog presence is not a logged-in executor and is not permission to dispatch.

export type ProviderStatus =
  | "upstream-adapter-present"
  | "acp-catalog-only"
  | "not-an-agent-provider";

export interface ProviderRecord {
  id: string;
  status: ProviderStatus;
  /** V1 dispatch stays closed until a real CLI contract test records evidence. */
  admittedForDispatch: false;
  evidence: string;
}

export const PROVIDERS: readonly ProviderRecord[] = [
  {
    id: "claude",
    status: "upstream-adapter-present",
    admittedForDispatch: false,
    evidence: "packages/server/src/server/agent/providers/claude exists. No live CLI run in W0.",
  },
  {
    id: "codex",
    status: "upstream-adapter-present",
    admittedForDispatch: false,
    evidence: "packages/server/src/server/agent/providers/codex exists. No live CLI run in W0.",
  },
  {
    id: "grok",
    status: "acp-catalog-only",
    admittedForDispatch: false,
    evidence:
      'packages/app/src/data/acp-provider-catalog.ts id "grok" command ["grok","agent","stdio"] version 0.2.11. plugins/grok-usage-source exists and is not a quota guarantee.',
  },
  {
    id: "antigravity",
    status: "not-an-agent-provider",
    admittedForDispatch: false,
    evidence:
      "No ACP catalog id at this baseline. packages/desktop editor target only, plus a community link in public-docs/community.md. Do not dispatch.",
  },
];

export function providerRecord(id: string): ProviderRecord | undefined {
  return PROVIDERS.find((row) => row.id === id);
}

export function assertProviderAdmitted(id: string): never {
  const row = providerRecord(id);
  const status = row ? row.status : "unknown";
  throw new Error(
    `Provider ${id} is not admitted for dispatch (${status}). ` +
      "A catalog row or an adapter directory is not a logged-in executor.",
  );
}
