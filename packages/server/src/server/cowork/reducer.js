// Generated from packages/cowork-core/src. Do not edit.

// packages/cowork-core/src/dispatch-policy.ts
function evaluateDispatch(input) {
  if (input.effect === "read") return { allow: true };
  if (input.revision !== input.expectedRevision) return { allow: false, reason: "revision" };
  if (input.epoch !== input.expectedEpoch) return { allow: false, reason: "epoch" };
  if (!input.actorIsWriter || input.resourceWriter !== input.actor) {
    return { allow: false, reason: "writer" };
  }
  if (input.alreadyDispatched) return { allow: false, reason: "duplicate" };
  return { allow: true };
}

// packages/cowork-core/src/host-namespaces.ts
var BAT_HOST_NAMESPACES = [
  { name: "systemVersion", disposition: "native", note: "OS version for the local shell only." },
  { name: "settings", disposition: "native", note: "Local shell path and client settings. Not shared workspace state." },
  { name: "runtime", disposition: "drop-sidecar", note: "Installs and clears managed agent runtimes. Paseo owns execution." },
  { name: "shell", disposition: "native", note: "Open/reveal local paths. Must not become an arbitrary remote shell." },
  { name: "dialog", disposition: "native", note: "Native file and folder pickers." },
  { name: "clipboard", disposition: "native", note: "Local clipboard." },
  { name: "image", disposition: "split", note: "Local image read stays native. Workspace attachments upload through the server." },
  { name: "fs", disposition: "split", note: "Client path is not a remote path. Workspace reads and writes go through the server." },
  { name: "update", disposition: "drop-bat-updater", note: "Do not keep the BAT app id, updater endpoint, or public key." },
  { name: "debug", disposition: "native", note: "Local diagnostics." },
  { name: "workspace", disposition: "workspace", note: "Shared workspace authority moves to the server. Layout prefs stay on the device." },
  { name: "profile", disposition: "split", note: "Window/profile chrome can stay local. Membership and credentials do not." },
  { name: "snippet", disposition: "ui-local", note: "Treat as device-local until a shared snippet model exists." },
  { name: "notification", disposition: "split", note: "OS notification is native. Task history must not re-notify on reconnect." },
  { name: "system", disposition: "native", note: "Resume and local notify." },
  { name: "app", disposition: "native", note: "Window id, title, dock badge, new window. Closing a window must not stop an agent." },
  { name: "github", disposition: "workspace", note: "Forge reads and writes go through the server gate." },
  { name: "codex", disposition: "drop-local-agent", note: "Account login and switching stay on the server profile, not in the client." },
  { name: "git", disposition: "workspace", note: "Status and diff are queries. commit, checkout, and merge are gated writes." },
  { name: "claude", disposition: "drop-local-agent", note: "Proxy over local Claude account and auto-continue. Do not keep a second owner." },
  { name: "claudeChannel", disposition: "drop-local-agent", note: "Local Claude channel events. Replace with a Paseo view model, do not fake Claude events." },
  { name: "claudeCli", disposition: "drop-local-agent", note: "startSession/stopSession spawn a local CLI. The client must not spawn agents." },
  { name: "remoteFs", disposition: "workspace", note: "Upload bytes to the server. Never send a client filesystem path as the remote path." },
  { name: "worktree", disposition: "workspace", note: "Create, remove, and merge are gated. Do not import BAT's cleanup defaults." },
  { name: "agent", disposition: "workspace", note: "Presets and usage are server discovery. Usage snapshot is not a quota guarantee." },
  { name: "workerBuffer", disposition: "drop-sidecar", note: "Procfile start/stop is a second process owner. Local scrollback may be rebuilt later." },
  { name: "remote", disposition: "drop-bat-protocol", note: "BAT remote server and token. Do not emulate that wire protocol." },
  { name: "remoteTunnel", disposition: "drop-bat-protocol", note: "BAT SSH tunnel helper for the old remote protocol." },
  { name: "tunnel", disposition: "drop-bat-protocol", note: "BAT tunnel connection object. Not the Paseo transport." },
  { name: "pty", disposition: "workspace", note: "xterm stays in the client. stdin and resize have one owner. Viewers do not write." }
];
function hostNamespace(name) {
  return BAT_HOST_NAMESPACES.find((row) => row.name === name);
}

// packages/cowork-core/src/providers.ts
var PROVIDERS = [
  {
    id: "claude",
    status: "upstream-adapter-present",
    admittedForDispatch: false,
    evidence: "packages/server/src/server/agent/providers/claude exists. No live CLI run in W0."
  },
  {
    id: "codex",
    status: "upstream-adapter-present",
    admittedForDispatch: false,
    evidence: "packages/server/src/server/agent/providers/codex exists. No live CLI run in W0."
  },
  {
    id: "grok",
    status: "acp-catalog-only",
    admittedForDispatch: false,
    evidence: 'packages/app/src/data/acp-provider-catalog.ts id "grok" command ["grok","agent","stdio"] version 0.2.11. plugins/grok-usage-source exists and is not a quota guarantee.'
  },
  {
    id: "antigravity",
    status: "not-an-agent-provider",
    admittedForDispatch: false,
    evidence: "No ACP catalog id at this baseline. packages/desktop editor target only, plus a community link in public-docs/community.md. Do not dispatch."
  }
];
function providerRecord(id) {
  return PROVIDERS.find((row) => row.id === id);
}
function assertProviderAdmitted(id) {
  const row = providerRecord(id);
  const status = row ? row.status : "unknown";
  throw new Error(
    `Provider ${id} is not admitted for dispatch (${status}). A catalog row or an adapter directory is not a logged-in executor.`
  );
}

// packages/cowork-core/src/session-ingress.ts
var SESSION_INGRESS = [
  { type: "agent.skills.get_status.request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "agent.skills.reconcile.request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "agent.skills.uninstall.request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "agent.skills.save_selection.request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "agent.skills.import_legacy_selection.request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "voice_audio_chunk", lane: "voice", effect: "read", gate: "not-wired" },
  { type: "abort_request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "audio_played", lane: "voice", effect: "read", gate: "not-wired" },
  { type: "set_voice_mode", lane: "voice", effect: "read", gate: "not-wired" },
  { type: "dictation_stream_start", lane: "voice", effect: "read", gate: "not-wired" },
  { type: "dictation_stream_chunk", lane: "voice", effect: "read", gate: "not-wired" },
  { type: "dictation_stream_finish", lane: "voice", effect: "read", gate: "not-wired" },
  { type: "dictation_stream_cancel", lane: "voice", effect: "read", gate: "not-wired" },
  { type: "restart_server_request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "shutdown_server_request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "client_heartbeat", lane: "session", effect: "read", gate: "not-wired" },
  { type: "ping", lane: "session", effect: "read", gate: "not-wired" },
  { type: "agent.rewind.request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "agent.detach.request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "fetch_agent_timeline_request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "agent.timeline.append.request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "agent.timeline.search.request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "agent.timeline.list_prompts.request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "agent.provider_subagents.list.request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "agent.provider_subagents.timeline.get.request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "session.events.set_subscription.request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "agent.timeline.set_subscription.request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "agent.fork_context.request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "agent.create.request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "creation.subscribe.request", lane: "subscribe", effect: "read", gate: "not-wired" },
  { type: "workspace.create.request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "fetch_agents_request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "fetch_agent_history_request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "fetch_recent_provider_sessions_request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "fetch_agent_request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "delete_agent_request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "archive_agent_request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "close_items_request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "update_agent_request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "project.rename.request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "project.icon.set.request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "send_agent_message_request", lane: "session", effect: "write", gate: "managed-only" },
  { type: "wait_for_finish_request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "create_agent_request", lane: "session", effect: "write", gate: "managed-only" },
  { type: "resume_agent_request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "import_agent_request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "refresh_agent_request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "cancel_agent_request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "agent_permission_response", lane: "session", effect: "write", gate: "not-wired" },
  { type: "clear_agent_attention", lane: "session", effect: "write", gate: "not-wired" },
  { type: "set_agent_mode_request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "set_agent_model_request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "set_agent_feature_request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "set_agent_thinking_request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "agent.config.apply.request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "get_daemon_config_request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "daemon.get_status.request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "daemon.get_pairing_offer.request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "daemon.config.reload.request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "hub.management.daemon.connect.request", lane: "hub", effect: "write", gate: "not-wired" },
  { type: "hub.management.daemon.get_status.request", lane: "hub", effect: "read", gate: "not-wired" },
  { type: "hub.management.daemon.disconnect.request", lane: "hub", effect: "write", gate: "not-wired" },
  { type: "hub.management.daemon.permissions.update.request", lane: "hub", effect: "write", gate: "not-wired" },
  { type: "diagnostics.request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "daemon.update.request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "set_daemon_config_request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "read_project_config_request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "write_project_config_request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "checkout_status_request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "checkout.commits.list.request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "checkout.commits.file_diff.request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "validate_branch_request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "branch_suggestions_request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "directory_suggestions_request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "checkout.diff.get.request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "subscribe_checkout_diff_request", lane: "subscribe", effect: "read", gate: "not-wired" },
  { type: "unsubscribe_checkout_diff_request", lane: "subscribe", effect: "read", gate: "not-wired" },
  { type: "checkout_switch_branch_request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "checkout.rename_branch.request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "checkout_commit_request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "checkout_merge_request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "checkout_merge_from_base_request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "checkout_pull_request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "checkout_push_request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "checkout.refresh.request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "checkout.discard_changes.request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "checkout_pr_create_request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "checkout_pr_merge_request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "checkout.forge.set_auto_merge.request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "checkout.github.set_auto_merge.request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "checkout.forge.get_check_details.request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "checkout.github.get_check_details.request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "checkout_pr_status_request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "pull_request_timeline_request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "forge.search.request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "github_search_request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "stash_save_request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "stash_pop_request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "stash_list_request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "fetch_workspaces_request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "project.list.request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "paseo_worktree_list_request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "paseo_worktree_archive_request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "create_paseo_worktree_request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "list_available_editors_request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "open_in_editor_request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "open_project_request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "project.add.request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "project.create_directory.request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "workspace.github.search_repositories.request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "project.github.clone.request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "archive_workspace_request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "project.remove.request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "workspace.title.set.request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "workspace.pin.set.request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "workspace.label.list.request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "workspace.label.assignment.set.request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "workspace.label.update.request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "workspace.label.delete.request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "workspace.label.delete.inspect.request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "file_explorer_request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "fs.file.subscribe.request", lane: "subscribe", effect: "read", gate: "not-wired" },
  { type: "fs.file.unsubscribe.request", lane: "subscribe", effect: "read", gate: "not-wired" },
  { type: "fs.file.write.request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "fs.entry.create.request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "fs.entry.rename.request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "fs.entry.duplicate.request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "fs.entry.delete.request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "project_icon_request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "project.icon.get.request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "file_download_token_request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "file.upload.request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "workspace.recovery.inspect.request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "workspace.recovery.restore.request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "workspace.clear_attention.request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "workspace.mark_unread.request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "list_provider_models_request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "list_provider_modes_request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "list_provider_features_request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "list_available_providers_request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "get_providers_snapshot_request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "refresh_providers_snapshot_request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "provider_diagnostic_request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "provider.usage.list.request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "usage.list_reports.request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "agent.resolve_usage_report.request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "start_workspace_script_request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "workspace.script.list.request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "workspace.script.start.request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "workspace.script.stop.request", lane: "session", effect: "write", gate: "not-wired" },
  { type: "schedule/create", lane: "session", effect: "write", gate: "not-wired" },
  { type: "schedule/list", lane: "session", effect: "read", gate: "not-wired" },
  { type: "schedule/inspect", lane: "session", effect: "read", gate: "not-wired" },
  { type: "schedule/logs", lane: "session", effect: "read", gate: "not-wired" },
  { type: "schedule/pause", lane: "session", effect: "write", gate: "not-wired" },
  { type: "schedule/resume", lane: "session", effect: "write", gate: "not-wired" },
  { type: "schedule/delete", lane: "session", effect: "write", gate: "not-wired" },
  { type: "schedule/run-once", lane: "session", effect: "write", gate: "not-wired" },
  { type: "schedule/update", lane: "session", effect: "write", gate: "not-wired" },
  { type: "list_commands_request", lane: "session", effect: "read", gate: "not-wired" },
  { type: "register_push_token", lane: "session", effect: "write", gate: "not-wired" },
  { type: "push.unregister.request", lane: "session", effect: "write", gate: "not-wired" }
];
function ingressByType(type) {
  return SESSION_INGRESS.find((row) => row.type === type);
}
function assertIngressGated(type) {
  const row = ingressByType(type);
  if (row?.gate === "managed-only") return;
  const label = row ? `${row.lane}/${row.effect}` : "unclassified";
  throw new Error(
    `CoworkMutationGate is not wired for ${type} (${label}). Refusing to treat a stock Paseo ingress as an authorized cowork command.`
  );
}

// packages/cowork-core/src/task-core.ts
var TERMINAL = /* @__PURE__ */ new Set(["verified", "cancelled", "rejected"]);
function createTask(input) {
  return {
    id: input.id,
    phase: "active",
    revision: 0,
    driverId: input.driverId,
    controlEpoch: 1,
    writerId: input.driverId,
    writerSettledEpoch: null,
    holdDispatch: false,
    worktreeId: input.worktreeId,
    appliedEventIds: [],
    timeline: [],
    activeCommand: null,
    pendingInput: null,
    evidence: null,
    reworkAttempts: 0,
    maxRework: input.maxRework ?? 2,
    outbox: [],
    liveness: { kind: "blocker", owner: "unassigned", reason: "no-instruction" }
  };
}
function note(state, eventId, kind, actor, text) {
  return {
    ...state,
    timeline: [...state.timeline, { eventId, kind, actor, text }]
  };
}
function withLiveness(state, liveness) {
  return { ...state, liveness };
}
function livenessMissing(state) {
  const slot = state.liveness;
  if (!slot) return true;
  if (slot.kind === "command") return slot.commandId.length === 0;
  if (slot.kind === "wake") return slot.nextWakeAt.length === 0;
  if (slot.kind === "blocker") return slot.owner.length === 0;
  return true;
}
function ensureLiveness(state) {
  if (TERMINAL.has(state.phase)) return state;
  if (!livenessMissing(state)) return state;
  return withLiveness(state, { kind: "blocker", owner: "unassigned", reason: "missing-liveness" });
}
function commandIdFor(eventId) {
  return `cmd:${eventId}`;
}
function step(state, event) {
  if (state.appliedEventIds.includes(event.id)) {
    return { state, intents: [] };
  }
  const seen = {
    ...state,
    appliedEventIds: [...state.appliedEventIds, event.id]
  };
  const result = reduce(seen, event);
  return { state: ensureLiveness(result.state), intents: result.intents };
}
function reduce(state, event) {
  switch (event.type) {
    case "comment":
    case "proposal":
      return { state: note(state, event.id, event.type, event.actor, event.text), intents: [] };
    case "presence":
      return { state: note(state, event.id, "presence", event.actor, ""), intents: [] };
    case "lease.expired":
      return { state: note(state, event.id, "lease.expired", "system", "lease expired; writer kept"), intents: [] };
    case "instruction":
      return instruct(state, event);
    case "control":
      return control(state, event);
    case "writer.settled":
      if (event.epoch !== state.controlEpoch) return { state, intents: [] };
      return {
        state: note(
          { ...state, writerSettledEpoch: event.epoch },
          event.id,
          "writer.settled",
          "system",
          `epoch ${event.epoch}`
        ),
        intents: []
      };
    case "command.unknown":
      if (state.activeCommand?.id !== event.commandId) return { state, intents: [] };
      return {
        state: withLiveness(
          note(
            { ...state, activeCommand: { id: event.commandId, outcome: "unknown" } },
            event.id,
            "command.unknown",
            "system",
            event.commandId
          ),
          { kind: "blocker", owner: "unassigned", reason: "command-unknown" }
        ),
        intents: []
      };
    case "assistant.finished":
    case "stream.ended":
    case "process.exited":
      return {
        state: note(state, event.id, event.type, "runtime", event.type === "assistant.finished" ? event.text : event.type),
        intents: []
      };
    case "verify.failed":
      return failVerify(state, event.id);
    case "verify.passed":
      return passVerify(state, event);
    case "notify.failed":
      return {
        state: {
          ...state,
          outbox: state.outbox.map(
            (item) => item.id === event.outboxId ? { ...item, failed: true } : item
          )
        },
        intents: []
      };
    default: {
      const _never = event;
      return _never;
    }
  }
}
function instruct(state, event) {
  const allowed = event.role === "driver" && event.actor === state.driverId && !TERMINAL.has(state.phase);
  if (!allowed) {
    return { state: note(state, event.id, "instruction.rejected", event.actor, event.text), intents: [] };
  }
  const revision = state.revision + 1;
  const commandId = commandIdFor(event.id);
  const next = {
    ...note(state, event.id, "instruction", event.actor, event.text),
    revision,
    pendingInput: { revision, text: event.text },
    reworkAttempts: 0,
    activeCommand: state.holdDispatch ? state.activeCommand : { id: commandId, outcome: "inflight" }
  };
  if (state.holdDispatch) {
    return {
      state: withLiveness(next, { kind: "blocker", owner: state.driverId, reason: "dispatch-held" }),
      intents: []
    };
  }
  return {
    state: withLiveness(next, { kind: "command", commandId }),
    intents: [{ type: "dispatch", commandId, revision }]
  };
}
function control(state, event) {
  if (event.action === "pause") {
    return {
      state: withLiveness(
        note({ ...state, phase: "paused", holdDispatch: true }, event.id, "pause", event.actor, ""),
        { kind: "blocker", owner: event.actor, reason: "paused" }
      ),
      intents: []
    };
  }
  if (event.action === "cancel") {
    return {
      state: note(
        { ...state, phase: "cancelled", holdDispatch: true, activeCommand: null },
        event.id,
        "cancel",
        event.actor,
        ""
      ),
      intents: []
    };
  }
  if (event.action === "takeover") {
    const controlEpoch = state.controlEpoch + 1;
    return {
      state: withLiveness(
        note(
          { ...state, controlEpoch, holdDispatch: true, writerSettledEpoch: null },
          event.id,
          "takeover",
          event.actor,
          `epoch ${controlEpoch}`
        ),
        { kind: "blocker", owner: event.actor, reason: "await-writer-settle" }
      ),
      intents: []
    };
  }
  if (state.phase === "paused") {
    if (event.actor !== state.driverId) {
      return { state: note(state, event.id, "release.rejected", event.actor, "not the driver"), intents: [] };
    }
    return {
      state: withLiveness(
        note({ ...state, holdDispatch: false, phase: "active" }, event.id, "release", event.actor, ""),
        { kind: "wake", nextWakeAt: "after-release" }
      ),
      intents: []
    };
  }
  const settled = state.writerSettledEpoch === state.controlEpoch;
  if (!settled) {
    return { state: note(state, event.id, "release.rejected", event.actor, "writer not settled"), intents: [] };
  }
  return {
    state: withLiveness(
      note(
        { ...state, holdDispatch: false, phase: state.phase === "paused" ? "active" : state.phase, writerId: state.driverId },
        event.id,
        "release",
        event.actor,
        ""
      ),
      { kind: "wake", nextWakeAt: "after-release" }
    ),
    intents: []
  };
}
function failVerify(state, eventId) {
  if (TERMINAL.has(state.phase)) return { state, intents: [] };
  if (state.reworkAttempts >= state.maxRework) {
    return {
      state: withLiveness(
        note(state, eventId, "verify.failed", "verifier", "rework cap"),
        { kind: "blocker", owner: "unassigned", reason: "rework-cap" }
      ),
      intents: []
    };
  }
  const reworkAttempts = state.reworkAttempts + 1;
  const commandId = `repair:${eventId}`;
  return {
    state: withLiveness(
      note(
        { ...state, reworkAttempts, activeCommand: { id: commandId, outcome: "inflight" } },
        eventId,
        "verify.failed",
        "verifier",
        `attempt ${reworkAttempts}`
      ),
      { kind: "command", commandId }
    ),
    intents: [{ type: "repair", commandId, revision: state.revision }]
  };
}
function passVerify(state, event) {
  const matches = event.evidence.revision === state.revision && event.evidence.commit.length > 0;
  const unknown = state.activeCommand?.outcome === "unknown";
  if (!matches || unknown || state.holdDispatch || TERMINAL.has(state.phase)) {
    return { state: note(state, event.id, "verify.rejected", "verifier", "evidence does not close"), intents: [] };
  }
  const outboxId = `out:${event.id}`;
  return {
    state: note(
      {
        ...state,
        phase: "verified",
        evidence: event.evidence,
        activeCommand: null,
        outbox: [...state.outbox, { id: outboxId, kind: "verified", failed: false }]
      },
      event.id,
      "verify.passed",
      "verifier",
      event.evidence.commit
    ),
    intents: [{ type: "notify", outboxId }]
  };
}
function claimWriter(claims, worktreeId, taskId) {
  const holder = claims[worktreeId];
  if (holder !== void 0 && holder !== taskId) return { ok: false, holder };
  return { ok: true, claims: { ...claims, [worktreeId]: taskId } };
}
function dispatchAllowed(state, actor, commandId) {
  return evaluateDispatch({
    actor,
    effect: "write",
    revision: state.revision,
    expectedRevision: state.revision,
    epoch: state.controlEpoch,
    expectedEpoch: state.controlEpoch,
    resourceWriter: state.writerId,
    actorIsWriter: actor === state.writerId && !state.holdDispatch,
    commandId,
    alreadyDispatched: state.activeCommand?.id === commandId && state.activeCommand.outcome === "inflight"
  });
}
function managedWriteFields(state) {
  if (state.writerId === null) return null;
  if (state.phase === "verified" || state.phase === "cancelled" || state.phase === "rejected") {
    return null;
  }
  return {
    writerId: state.writerId,
    revision: state.revision,
    expectedRevision: state.revision,
    epoch: state.controlEpoch,
    expectedEpoch: state.controlEpoch,
    holdDispatch: state.holdDispatch
  };
}
export {
  BAT_HOST_NAMESPACES,
  PROVIDERS,
  SESSION_INGRESS,
  assertIngressGated,
  assertProviderAdmitted,
  claimWriter,
  createTask,
  dispatchAllowed,
  evaluateDispatch,
  hostNamespace,
  ingressByType,
  managedWriteFields,
  providerRecord,
  step
};
