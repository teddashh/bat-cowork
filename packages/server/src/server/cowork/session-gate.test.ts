import pino from "pino";
import { afterEach, expect, test, vi } from "vitest";

import { createTask, managedWriteFields, step } from "../../../../cowork-core/src/task-core.ts";
import { OWNER_PERMISSIONS } from "../authorization/index.js";
import type { SessionInboundMessage, SessionOutboundMessage } from "../messages.js";
import { Session, type SessionOptions } from "../session.js";
import {
  asAgentManager,
  asAgentStorage,
  asCheckoutDiffManager,
  asDaemonConfigStore,
  asDownloadTokenStore,
  asGitHubService,
  asPushNotifications,
  asScheduleService,
  asWorkspaceGitService,
  createMessageReceiptsStub,
  createProviderSnapshotManagerStub,
  createTestCreationService,
} from "../test-utils/session-stubs.js";
import { clearManagedWriteTarget, syncManagedAgent } from "./mutation-gate.js";

const AGENT_ID = "agent-1";

afterEach(() => {
  clearManagedWriteTarget("agent", AGENT_ID);
});

function openSession(tryRunOutOfBand: ReturnType<typeof vi.fn>): {
  session: Session;
  messages: SessionOutboundMessage[];
} {
  const messages: SessionOutboundMessage[] = [];
  const logger = pino({ level: "silent" });
  const github = {
    invalidate: vi.fn(),
    searchIssuesAndPrs: vi.fn(),
    createPullRequest: vi.fn(),
    mergePullRequest: vi.fn(),
  };
  const workspaceGitService = {
    getCheckout: vi.fn(),
    getCheckoutDiff: vi.fn(),
    getSnapshot: vi.fn(),
    suggestBranchesForCwd: vi.fn(),
    listStashes: vi.fn(),
    peekSnapshot: vi.fn(),
    validateBranchRef: vi.fn(),
    hasLocalBranch: vi.fn(),
    resolveRepoRemoteUrl: vi.fn(),
    resolveRepoRoot: vi.fn(),
    getWorkspaceGitMetadata: vi.fn(),
    resolveForge: vi.fn().mockResolvedValue({ forge: "github", service: github }),
    invalidateForge: vi.fn(),
    getProjectSlug: vi.fn(),
  };
  const options: SessionOptions = {
    messageReceipts: createMessageReceiptsStub(),
    creationService: createTestCreationService(),
    clientId: "client-a",
    permissions: OWNER_PERMISSIONS,
    onMessage: (message) => messages.push(message),
    onMessageToSource: (_source, message) => messages.push(message),
    onBinaryMessage: () => undefined,
    logger,
    downloadTokenStore: asDownloadTokenStore(),
    pushNotifications: asPushNotifications(),
    paseoHome: "/tmp/paseo-home",
    agentManager: asAgentManager({
      listAgents: () => [{ id: AGENT_ID }],
      getAgent: () => ({ id: AGENT_ID }),
      listProviderSubagentActivity: () => [],
      subscribe: () => () => {},
      waitForAgentClose: vi.fn().mockResolvedValue(undefined),
      tryRunOutOfBand,
    }),
    agentStorage: asAgentStorage({
      get: vi.fn().mockResolvedValue(undefined),
      list: vi.fn().mockResolvedValue([{ id: AGENT_ID, internal: false }]),
    }),
    projectRegistry: {
      list: vi.fn().mockResolvedValue([]),
      get: vi.fn(),
      getOrCreateActiveByRoot: vi.fn(),
      upsert: vi.fn(),
      archive: vi.fn(),
      remove: vi.fn(),
      initialize: vi.fn(),
      existsOnDisk: vi.fn(),
    },
    workspaceRegistry: {
      get: vi.fn(),
      list: vi.fn().mockResolvedValue([]),
    },
    scheduleService: asScheduleService(),
    checkoutDiffManager: asCheckoutDiffManager({ scheduleRefreshForCwd: vi.fn() }),
    github: asGitHubService(github),
    workspaceGitService: asWorkspaceGitService(workspaceGitService),
    daemonConfigStore: asDaemonConfigStore({
      get: vi.fn(() => ({ mcp: { injectIntoAgents: false }, providers: {} })),
      onChange: vi.fn(() => () => {}),
    }),
    stt: null,
    tts: null,
    terminalManager: null,
    providerSnapshotManager: createProviderSnapshotManagerStub().manager,
  };
  return { session: new Session(options), messages };
}

function instructed() {
  return step(createTask({ id: "t1", driverId: "client-a", worktreeId: "wt" }), {
    id: "i1",
    type: "instruction",
    actor: "client-a",
    role: "driver",
    text: "fix the test",
  }).state;
}

async function send(session: Session, requestId: string): Promise<void> {
  await session.handleMessage({
    type: "send_agent_message_request",
    requestId,
    agentId: AGENT_ID,
    text: "hello",
  } as SessionInboundMessage);
}

function sent(messages: SessionOutboundMessage[], requestId: string) {
  return messages.find(
    (message) =>
      message.type === "send_agent_message_response" && message.payload.requestId === requestId,
  );
}

test("a paused cowork task blocks send on the real Session, and an open task does not", async () => {
  const paused = step(instructed(), {
    id: "p",
    type: "control",
    action: "pause",
    actor: "client-a",
  }).state;
  syncManagedAgent(AGENT_ID, managedWriteFields(paused));
  const heldRun = vi.fn(() => true);
  const held = openSession(heldRun);
  await send(held.session, "held");
  expect(sent(held.messages, "held")).toMatchObject({
    type: "send_agent_message_response",
    payload: { accepted: false, error: "cowork gate: held" },
  });
  expect(heldRun).not.toHaveBeenCalled();

  clearManagedWriteTarget("agent", AGENT_ID);
  syncManagedAgent(AGENT_ID, managedWriteFields(instructed()));
  const openRun = vi.fn(() => true);
  const open = openSession(openRun);
  await send(open.session, "open");
  expect(sent(open.messages, "open")).toMatchObject({
    type: "send_agent_message_response",
    payload: { accepted: true, error: null },
  });
  expect(openRun).toHaveBeenCalled();
});

test("an unregistered agent is not stopped by the cowork gate", async () => {
  const run = vi.fn(() => true);
  const { session, messages } = openSession(run);
  await send(session, "stock");
  const response = sent(messages, "stock");
  expect(response?.type).toBe("send_agent_message_response");
  if (response?.type !== "send_agent_message_response") return;
  expect(response.payload.error ?? "").not.toContain("cowork gate");
  expect(response.payload.accepted).toBe(true);
  expect(run).toHaveBeenCalled();
});
