import type {
  IocalcAuditEvent,
  IocalcAuditEventType,
  IocalcBoundaryAction,
  IocalcBoundaryDecision,
  IocalcCapabilities,
  IocalcForbiddenCapabilityName
} from "./types.js";

const FORBIDDEN_CAPABILITIES = [
  "walletActionsEnabled",
  "feedbackCanMutateGameplay",
  "externalUrlFetchEnabled",
  "codeExecutionEnabled",
  "secretsAccessEnabled",
  "productionMutationEnabled"
] as const satisfies readonly IocalcForbiddenCapabilityName[];

const BOUNDARY_ACTIONS = [
  "read_capabilities",
  "read_state",
  "submit_command",
  "resolve_season",
  "read_report",
  "read_log",
  "read_match_history",
  "run_agent_trial",
  "reject_request"
] as const satisfies readonly IocalcBoundaryAction[];

const AUDIT_EVENT_TYPES = [
  "boundary-decision",
  "state-read",
  "command-submitted",
  "command-rejected",
  "season-resolved",
  "report-read",
  "log-read",
  "history-read",
  "agent-trial-run",
  "request-rejected"
] as const satisfies readonly IocalcAuditEventType[];

export const IOCALC_FORBIDDEN_CAPABILITIES: readonly IocalcForbiddenCapabilityName[] = Object.freeze([
  ...FORBIDDEN_CAPABILITIES
]);

export const IOCALC_BOUNDARY_ACTIONS: readonly IocalcBoundaryAction[] = Object.freeze([...BOUNDARY_ACTIONS]);

export const IOCALC_AUDIT_EVENT_TYPES: readonly IocalcAuditEventType[] = Object.freeze([...AUDIT_EVENT_TYPES]);

export const DEFAULT_SAFE_CAPABILITIES: IocalcCapabilities = {
  canReadState: true,
  canSubmitGameCommand: true,
  canResolveSeason: true,
  canReadReport: true,
  canRunAgentTrial: false,
  walletActionsEnabled: false,
  feedbackCanMutateGameplay: false,
  externalUrlFetchEnabled: false,
  codeExecutionEnabled: false,
  secretsAccessEnabled: false,
  productionMutationEnabled: false
};

export function assertSafeCapabilities(capabilities: IocalcCapabilities): void {
  if (capabilities.walletActionsEnabled) throw new Error("Unsafe capability: walletActionsEnabled");
  if (capabilities.feedbackCanMutateGameplay) throw new Error("Unsafe capability: feedbackCanMutateGameplay");
  if (capabilities.externalUrlFetchEnabled) throw new Error("Unsafe capability: externalUrlFetchEnabled");
  if (capabilities.codeExecutionEnabled) throw new Error("Unsafe capability: codeExecutionEnabled");
  if (capabilities.secretsAccessEnabled) throw new Error("Unsafe capability: secretsAccessEnabled");
  if (capabilities.productionMutationEnabled) throw new Error("Unsafe capability: productionMutationEnabled");
}

export function makeSandboxBoundaryDecision(
  action: IocalcBoundaryAction,
  reason: string,
  allowed = true
): IocalcBoundaryDecision {
  return {
    action,
    allowed,
    sandboxOnly: true,
    policy: "sandbox-gameplay-only",
    reason,
    blockedCapabilities: [...FORBIDDEN_CAPABILITIES],
    reviewedBy: "iocalc-referee-0001"
  };
}

export function assertSandboxBoundaryDecision(decision: IocalcBoundaryDecision): void {
  if (!decision || typeof decision !== "object") {
    throw new Error("Unsafe boundary decision: expected object");
  }
  if (!BOUNDARY_ACTIONS.includes(decision.action)) {
    throw new Error(`Unsafe boundary action: ${String(decision.action)}`);
  }
  if (typeof decision.allowed !== "boolean") {
    throw new Error("Unsafe boundary decision: allowed must be boolean");
  }
  if (decision.policy !== "sandbox-gameplay-only") {
    throw new Error(`Unsafe boundary policy: ${decision.policy}`);
  }
  if (decision.sandboxOnly !== true) {
    throw new Error("Unsafe boundary decision: sandboxOnly must be true");
  }
  if (!Array.isArray(decision.blockedCapabilities)) {
    throw new Error("Unsafe boundary decision: blockedCapabilities must be an array");
  }
  const blocked = new Set(decision.blockedCapabilities);
  if (
    decision.blockedCapabilities.length !== FORBIDDEN_CAPABILITIES.length ||
    blocked.size !== FORBIDDEN_CAPABILITIES.length
  ) {
    throw new Error("Unsafe boundary decision: blockedCapabilities must match the forbidden set");
  }
  for (const capability of FORBIDDEN_CAPABILITIES) {
    if (!blocked.has(capability)) {
      throw new Error(`Unsafe boundary decision: missing blocked capability ${capability}`);
    }
  }
  if (typeof decision.reason !== "string" || decision.reason.trim().length === 0) {
    throw new Error("Unsafe boundary decision: reason must be non-empty text");
  }
}

export function assertSandboxAuditEvent(event: IocalcAuditEvent): void {
  if (!event || typeof event !== "object") {
    throw new Error("Unsafe audit event: expected object");
  }
  if (!AUDIT_EVENT_TYPES.includes(event.type)) {
    throw new Error(`Unsafe audit event type: ${String(event.type)}`);
  }
  if (!BOUNDARY_ACTIONS.includes(event.action)) {
    throw new Error(`Unsafe audit event action: ${String(event.action)}`);
  }
  assertSandboxBoundaryDecision(event.boundary);
  if (event.boundary.action !== event.action) {
    throw new Error("Unsafe audit event: action must match boundary action");
  }
  if (typeof event.summary !== "string" || event.summary.trim().length === 0) {
    throw new Error("Unsafe audit event: summary must be non-empty text");
  }
}
