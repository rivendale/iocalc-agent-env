import type {
  IocalcAuditEvent,
  IocalcAuditEventType,
  IocalcBoundaryAction,
  IocalcBoundaryDecision,
  IocalcCapabilities,
  IocalcForbiddenCapabilityName,
  IocalcGameApiManifest,
  IocalcSafeCapabilityName
} from "./types.js";

const SAFE_CAPABILITIES = [
  "canReadState",
  "canSubmitGameCommand",
  "canResolveSeason",
  "canReadReport",
  "canRunAgentTrial"
] as const satisfies readonly IocalcSafeCapabilityName[];

const REQUIRED_MANIFEST_ROUTES = [
  "GET /api/game/manifest",
  "GET /api/game/capabilities",
  "GET /api/game/state",
  "POST /api/game/command",
  "POST /api/game/resolve",
  "GET /api/game/report",
  "GET /api/game/log",
  "GET /api/game/match-history"
] as const;

const OPTIONAL_MANIFEST_ROUTES = ["POST /api/game/agent-trial"] as const;

const ALLOWED_MANIFEST_ROUTES = new Set<string>([...REQUIRED_MANIFEST_ROUTES, ...OPTIONAL_MANIFEST_ROUTES]);

const REQUIRED_MANIFEST_CAPABILITIES = [
  "canReadState",
  "canSubmitGameCommand",
  "canResolveSeason",
  "canReadReport"
] as const satisfies readonly IocalcSafeCapabilityName[];

const SAFE_MANIFEST_SIDE_EFFECTS = new Set([
  "none",
  "audit-read-event-only",
  "sandbox-pending-command-only",
  "sandbox-season-state-only",
  "sandbox-trial-state-only"
]);

const MANIFEST_ROUTE_SIDE_EFFECTS = new Map<string, string>([
  ["GET /api/game/manifest", "none"],
  ["GET /api/game/capabilities", "none"],
  ["GET /api/game/state", "audit-read-event-only"],
  ["POST /api/game/command", "sandbox-pending-command-only"],
  ["POST /api/game/resolve", "sandbox-season-state-only"],
  ["GET /api/game/report", "audit-read-event-only"],
  ["GET /api/game/log", "audit-read-event-only"],
  ["GET /api/game/match-history", "audit-read-event-only"],
  ["POST /api/game/agent-trial", "sandbox-trial-state-only"]
]);

const ROUTES_WITH_SANDBOX_QUERY = new Set([
  "GET /api/game/state",
  "GET /api/game/report",
  "GET /api/game/log",
  "GET /api/game/match-history"
]);

const SAFE_MANIFEST_TEXT = /^[A-Za-z0-9 .,:;!?'"()_\/&+-]+$/;
const UNSAFE_MANIFEST_TEXT =
  /\b(?:api[_ -]?keys?|private[_ -]?keys?|seed phrases?|mnemonics?|passwords?|bearer|access[_ -]?tokens?|auth[_ -]?tokens?|oauth|refresh[_ -]?tokens?|tokens?|secrets?|credentials?|wallets?|transactions?|payments?|payouts?|withdraw(?:al|als|s|ing)?|accounts?|sessions?|production|deploy(?:ment|ments|s|ed|ing)?|financial|shell|execute|execution|eval|code)\b/i;
const UNSAFE_MANIFEST_COMPACT_TERMS = [
  "apikey",
  "auth",
  "privatekey",
  "seedphrase",
  "mnemonic",
  "password",
  "bearer",
  "cookie",
  "accesstoken",
  "authtoken",
  "oauthtoken",
  "refreshtoken",
  "login",
  "token",
  "secret",
  "credential",
  "wallet",
  "transaction",
  "url",
  "fetch",
  "feedback",
  "trust",
  "payment",
  "payout",
  "withdraw",
  "account",
  "session",
  "production",
  "deploy",
  "financial",
  "shell",
  "execute",
  "execution",
  "eval",
  "code"
];

const SAFE_MANIFEST_OUT_OF_SCOPE = new Set([
  "wallet actions",
  "private-key handling",
  "secrets access",
  "feedback-to-gameplay mutation",
  "arbitrary URL fetching",
  "arbitrary code execution",
  "deployment or production mutation",
  "accounts or sessions",
  "financial functionality or advice"
]);

const MANIFEST_KEYS = new Set([
  "project",
  "publicBrand",
  "mode",
  "description",
  "version",
  "protocol",
  "routes",
  "responses",
  "commandRequest",
  "agentTrialRequest",
  "selectors",
  "safeCapabilities",
  "blockedCapabilities",
  "inputPolicy",
  "outOfScope",
  "boundary"
]);
const MANIFEST_PROTOCOL_KEYS = new Set([
  "name",
  "compatibleWith",
  "agentEnvRepository",
  "agentEnvCompatibilityCommit",
  "stateScope",
  "sandboxIdSupported",
  "sandboxIdIsAccountOrSession",
  "maxInMemorySandboxes",
  "sandboxTtlSeconds"
]);
const MANIFEST_ROUTE_KEYS = new Set(["method", "path", "purpose", "body", "query", "contentType", "maxBytes", "sideEffects"]);
const MANIFEST_RESPONSE_KEYS = new Set(["description", "fields", "optionalFields"]);
const MANIFEST_INPUT_POLICY_KEYS = new Set([
  "asciiOnly",
  "noLinks",
  "noCodeOrExecutableSchemes",
  "noSecrets",
  "noWalletOrFinancialAuthority",
  "submittedTextIsUntrusted",
  "submittedTextIsExecuted",
  "feedbackCanMutateGameplay"
]);
const MANIFEST_BOUNDARY_KEYS = new Set([
  "action",
  "allowed",
  "sandboxOnly",
  "policy",
  "reason",
  "blockedCapabilities",
  "reviewedBy",
  "at"
]);
const COMMAND_REQUEST_KEYS = new Set(["contentType", "fields", "allowedCommandVocabulary", "maxCommandChars"]);
const COMMAND_REQUEST_FIELD_KEYS = new Set(["sandboxId", "mode", "agentName", "command", "seed"]);
const AGENT_TRIAL_REQUEST_KEYS = new Set(["contentType", "fields"]);
const AGENT_TRIAL_REQUEST_FIELD_KEYS = new Set(["sandboxId", "agentA", "agentB", "seasons", "seed"]);
const SAFE_RESPONSE_FIELD_PATH = /^[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)*$/;
const PROTOTYPE_PATH_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

const FORBIDDEN_CAPABILITIES = [
  "walletActionsEnabled",
  "feedbackCanMutateGameplay",
  "externalUrlFetchEnabled",
  "codeExecutionEnabled",
  "secretsAccessEnabled",
  "productionMutationEnabled"
] as const satisfies readonly IocalcForbiddenCapabilityName[];

const BOUNDARY_ACTIONS = [
  "read_manifest",
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

export function assertSandboxGameApiManifest(manifest: IocalcGameApiManifest): void {
  if (!manifest || typeof manifest !== "object") {
    throw new Error("Unsafe game API manifest: expected object");
  }
  assertKnownObjectKeys(manifest, MANIFEST_KEYS, "manifest");
  if (manifest.project !== "IOCALC") {
    throw new Error("Unsafe game API manifest: project must be IOCALC");
  }
  assertSafeManifestMetadataText(manifest.publicBrand, "publicBrand", 120);
  assertSafeManifestMetadataText(manifest.mode, "mode", 80);
  assertSafeManifestMetadataText(manifest.description, "description", 400);
  assertSafeManifestMetadataText(manifest.version, "version", 40);
  if (!manifest.protocol || typeof manifest.protocol !== "object") {
    throw new Error("Unsafe game API manifest: missing protocol");
  }
  assertKnownObjectKeys(manifest.protocol, MANIFEST_PROTOCOL_KEYS, "protocol");
  assertSafeManifestMetadataText(manifest.protocol.name, "protocol.name", 120);
  assertSafeManifestMetadataText(manifest.protocol.compatibleWith, "protocol.compatibleWith", 120);
  if (manifest.protocol.agentEnvRepository !== undefined) {
    assertSafeManifestMetadataText(manifest.protocol.agentEnvRepository, "protocol.agentEnvRepository", 120);
  }
  if (
    manifest.protocol.agentEnvCompatibilityCommit !== undefined &&
    !/^[a-f0-9]{40}$/i.test(manifest.protocol.agentEnvCompatibilityCommit)
  ) {
    throw new Error("Unsafe game API manifest: invalid agent environment compatibility commit");
  }
  assertSafeManifestMetadataText(manifest.protocol.stateScope, "protocol.stateScope", 160);
  if (manifest.protocol.sandboxIdIsAccountOrSession !== false) {
    throw new Error("Unsafe game API manifest: sandboxId must not be an account or session");
  }
  if (typeof manifest.protocol.stateScope !== "string" || !/sandbox/i.test(manifest.protocol.stateScope)) {
    throw new Error("Unsafe game API manifest: state scope must be sandbox-only");
  }
  if (manifest.commandRequest !== undefined) {
    assertSafeManifestRequestRecord(manifest.commandRequest, "commandRequest", COMMAND_REQUEST_KEYS, COMMAND_REQUEST_FIELD_KEYS);
  }
  if (manifest.selectors !== undefined) {
    assertSafeManifestSelectors(manifest.selectors);
  }
  if (manifest.outOfScope !== undefined) {
    assertSafeManifestOutOfScope(manifest.outOfScope);
  }
  if (!Array.isArray(manifest.routes)) {
    throw new Error("Unsafe game API manifest: routes must be an array");
  }
  for (const route of manifest.routes) {
    if (!route || typeof route !== "object" || Array.isArray(route)) {
      throw new Error("Unsafe game API manifest: route must be an object");
    }
    assertKnownObjectKeys(route, MANIFEST_ROUTE_KEYS, "route");
  }
  const routes = new Set(manifest.routes.map((route) => `${route.method} ${route.path}`));
  if (routes.size !== manifest.routes.length) {
    throw new Error("Unsafe game API manifest: routes must not contain duplicates");
  }
  for (const route of REQUIRED_MANIFEST_ROUTES) {
    if (!routes.has(route)) {
      throw new Error(`Unsafe game API manifest: missing route ${route}`);
    }
  }
  for (const route of manifest.routes) {
    const routeKey = `${route.method} ${route.path}`;
    if (!ALLOWED_MANIFEST_ROUTES.has(routeKey)) {
      throw new Error("Unsafe game API manifest: unsupported route");
    }
    if (!SAFE_MANIFEST_SIDE_EFFECTS.has(route.sideEffects) || route.sideEffects !== MANIFEST_ROUTE_SIDE_EFFECTS.get(routeKey)) {
      throw new Error("Unsafe game API manifest: route side effect does not match route contract");
    }
    assertSafeManifestMetadataText(route.purpose, "route.purpose", 240);
    if (route.body !== undefined) {
      assertSafeManifestMetadataText(route.body, "route.body", 80);
    }
    if (route.query !== undefined) {
      if (!ROUTES_WITH_SANDBOX_QUERY.has(routeKey) || route.query.length !== 1 || route.query[0] !== "sandboxId") {
        throw new Error("Unsafe game API manifest: unsupported query fields");
      }
    }
    if (route.method === "POST" && route.contentType !== "application/json") {
      throw new Error(`Unsafe game API manifest: POST route ${route.path} must use application/json`);
    }
    if (route.maxBytes !== undefined && (!Number.isInteger(route.maxBytes) || route.maxBytes < 1 || route.maxBytes > 8192)) {
      throw new Error(`Unsafe game API manifest: route ${route.path} has unsafe maxBytes`);
    }
  }
  if (manifest.responses !== undefined) {
    assertSafeManifestResponses(manifest.responses, routes);
  }
  if (!Array.isArray(manifest.safeCapabilities)) {
    throw new Error("Unsafe game API manifest: safeCapabilities must be an array");
  }
  const safeCapabilities = new Set(manifest.safeCapabilities);
  for (const capability of REQUIRED_MANIFEST_CAPABILITIES) {
    if (!safeCapabilities.has(capability)) {
      throw new Error(`Unsafe game API manifest: missing safe capability ${capability}`);
    }
  }
  for (const capability of safeCapabilities) {
    if (!SAFE_CAPABILITIES.includes(capability)) {
      throw new Error("Unsafe game API manifest: unsupported safe capability");
    }
  }
  if (safeCapabilities.size !== manifest.safeCapabilities.length) {
    throw new Error("Unsafe game API manifest: safeCapabilities must not contain duplicates");
  }
  const hasAgentTrialRoute = routes.has("POST /api/game/agent-trial");
  const hasAgentTrialCapability = safeCapabilities.has("canRunAgentTrial");
  if (hasAgentTrialRoute !== hasAgentTrialCapability) {
    throw new Error("Unsafe game API manifest: agent trial route and capability must agree");
  }
  if (hasAgentTrialRoute) {
    if (manifest.agentTrialRequest === undefined) {
      throw new Error("Unsafe game API manifest: agent trial route requires agentTrialRequest");
    }
    assertSafeManifestRequestRecord(manifest.agentTrialRequest, "agentTrialRequest", AGENT_TRIAL_REQUEST_KEYS, AGENT_TRIAL_REQUEST_FIELD_KEYS);
  } else if (manifest.agentTrialRequest !== undefined) {
    throw new Error("Unsafe game API manifest: agentTrialRequest requires agent trial support");
  }
  if (!Array.isArray(manifest.blockedCapabilities)) {
    throw new Error("Unsafe game API manifest: blockedCapabilities must be an array");
  }
  const blockedCapabilities = new Set(manifest.blockedCapabilities);
  if (
    manifest.blockedCapabilities.length !== FORBIDDEN_CAPABILITIES.length ||
    blockedCapabilities.size !== FORBIDDEN_CAPABILITIES.length
  ) {
    throw new Error("Unsafe game API manifest: blockedCapabilities must match the forbidden set");
  }
  for (const capability of FORBIDDEN_CAPABILITIES) {
    if (!blockedCapabilities.has(capability)) {
      throw new Error(`Unsafe game API manifest: missing blocked capability ${capability}`);
    }
  }
  if (!manifest.inputPolicy || typeof manifest.inputPolicy !== "object") {
    throw new Error("Unsafe game API manifest: missing inputPolicy");
  }
  assertKnownObjectKeys(manifest.inputPolicy, MANIFEST_INPUT_POLICY_KEYS, "inputPolicy");
  if (manifest.inputPolicy.noLinks !== true) {
    throw new Error("Unsafe game API manifest: links must be prohibited");
  }
  if (manifest.inputPolicy.noCodeOrExecutableSchemes !== true) {
    throw new Error("Unsafe game API manifest: code and executable schemes must be prohibited");
  }
  if (manifest.inputPolicy.noSecrets !== true) {
    throw new Error("Unsafe game API manifest: secrets must be prohibited");
  }
  if (manifest.inputPolicy.noWalletOrFinancialAuthority !== true) {
    throw new Error("Unsafe game API manifest: wallet and financial authority must be prohibited");
  }
  if (manifest.inputPolicy.submittedTextIsUntrusted !== true) {
    throw new Error("Unsafe game API manifest: submitted text must be untrusted");
  }
  if (manifest.inputPolicy.submittedTextIsExecuted !== false) {
    throw new Error("Unsafe game API manifest: submitted text must not execute");
  }
  if (manifest.inputPolicy.feedbackCanMutateGameplay !== false) {
    throw new Error("Unsafe game API manifest: feedback must not mutate gameplay");
  }
  if (manifest.boundary) {
    assertSandboxBoundaryDecision(manifest.boundary);
    assertSafeManifestBoundaryDecision(manifest.boundary);
  }
}

function assertKnownObjectKeys(value: object, allowedKeys: Set<string>, field: string): void {
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !allowedKeys.has(key)) {
      throw new Error(`Unsafe game API manifest: ${field} contains unsupported key`);
    }
  }
}

function assertSafeManifestMetadataText(value: unknown, field: string, maxLength: number): void {
  if (typeof value !== "string" || value.length < 1 || value.length > maxLength) {
    throw new Error(`Unsafe game API manifest: ${field} must be bounded text`);
  }
  if (!SAFE_MANIFEST_TEXT.test(value) || hasUnsafeManifestText(value)) {
    throw new Error(`Unsafe game API manifest: ${field} contains unsafe text`);
  }
}

function hasUnsafeManifestText(value: string): boolean {
  if (UNSAFE_MANIFEST_TEXT.test(value)) return true;
  const compact = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return UNSAFE_MANIFEST_COMPACT_TERMS.some((term) => compact.includes(term));
}

function assertSafeManifestSelectors(value: unknown): void {
  if (!Array.isArray(value)) {
    throw new Error("Unsafe game API manifest: selectors must be an array");
  }
  const selectors = new Set<string>();
  for (const selector of value) {
    if (typeof selector !== "string" || !/^data-testid="[A-Za-z0-9_-]+"$/.test(selector) || hasUnsafeManifestText(selector)) {
      throw new Error("Unsafe game API manifest: unsafe selector");
    }
    selectors.add(selector);
  }
  if (selectors.size !== value.length) {
    throw new Error("Unsafe game API manifest: selectors must not contain duplicates");
  }
}

function assertSafeManifestResponses(value: unknown, routes: Set<string>): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Unsafe game API manifest: responses must be an object");
  }
  const allowedResponseKeys = new Set(Array.from(routes).filter((route) => ALLOWED_MANIFEST_ROUTES.has(route)));
  assertKnownObjectKeys(value, allowedResponseKeys, "responses");
  for (const routeKey of Reflect.ownKeys(value)) {
    if (typeof routeKey !== "string") {
      throw new Error("Unsafe game API manifest: responses contains unsupported key");
    }
    const route = routeKey;
    const spec = (value as Record<string, unknown>)[route];
    if (!routes.has(route) || !ALLOWED_MANIFEST_ROUTES.has(route)) {
      throw new Error("Unsafe game API manifest: response route is unsupported");
    }
    if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
      throw new Error("Unsafe game API manifest: response spec must be an object");
    }
    const record = spec as { description?: unknown; fields?: unknown; optionalFields?: unknown };
    assertKnownObjectKeys(record, MANIFEST_RESPONSE_KEYS, "response");
    if (record.description !== undefined) {
      assertSafeManifestMetadataText(record.description, "response.description", 240);
    }
    assertSafeResponseFieldList(record.fields, "response.fields");
    if (record.optionalFields !== undefined) {
      assertSafeResponseFieldList(record.optionalFields, "response.optionalFields");
    }
  }
}

function assertSafeResponseFieldList(value: unknown, field: string): void {
  if (!Array.isArray(value) || value.length < 1 || value.length > 80) {
    throw new Error(`Unsafe game API manifest: ${field} must be a bounded non-empty array`);
  }
  const entries = new Set<string>();
  for (const entry of value) {
    if (
      typeof entry !== "string" ||
      entry.length < 1 ||
      entry.length > 80 ||
      !SAFE_RESPONSE_FIELD_PATH.test(entry) ||
      entry.split(".").some((segment) => PROTOTYPE_PATH_SEGMENTS.has(segment))
    ) {
      throw new Error(`Unsafe game API manifest: ${field} contains unsafe field path`);
    }
    assertSafeManifestMetadataText(entry, field, 80);
    entries.add(entry);
  }
  if (entries.size !== value.length) {
    throw new Error(`Unsafe game API manifest: ${field} must not contain duplicates`);
  }
}

function assertSafeManifestOutOfScope(value: unknown): void {
  if (!Array.isArray(value)) {
    throw new Error("Unsafe game API manifest: outOfScope must be an array");
  }
  const entries = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string" || !SAFE_MANIFEST_OUT_OF_SCOPE.has(entry)) {
      throw new Error("Unsafe game API manifest: unsupported outOfScope entry");
    }
    entries.add(entry);
  }
  if (entries.size !== value.length) {
    throw new Error("Unsafe game API manifest: outOfScope must not contain duplicates");
  }
}

function assertSafeManifestRequestRecord(
  value: unknown,
  field: string,
  allowedKeys: Set<string>,
  allowedFieldKeys: Set<string>
): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Unsafe game API manifest: ${field} must be an object`);
  }
  const record = value as Record<string, unknown>;
  assertKnownObjectKeys(record, allowedKeys, field);
  if ("contentType" in record && record.contentType !== "application/json") {
    throw new Error(`Unsafe game API manifest: ${field}.contentType must be application/json`);
  }
  if ("maxCommandChars" in record) {
    const maxCommandChars = record.maxCommandChars;
    if (!Number.isInteger(maxCommandChars) || (maxCommandChars as number) < 1 || (maxCommandChars as number) > 1200) {
      throw new Error(`Unsafe game API manifest: ${field}.maxCommandChars is unsafe`);
    }
  }
  if ("allowedCommandVocabulary" in record) {
    assertSafeManifestRequestText(record.allowedCommandVocabulary, `${field}.allowedCommandVocabulary`, 160);
  }
  if (!("fields" in record) || !record.fields || typeof record.fields !== "object" || Array.isArray(record.fields)) {
    throw new Error(`Unsafe game API manifest: ${field}.fields must be an object`);
  }
  const fields = record.fields as Record<string, unknown>;
  for (const key of Reflect.ownKeys(fields)) {
    if (typeof key !== "string" || !allowedFieldKeys.has(key)) {
      throw new Error(`Unsafe game API manifest: ${field}.fields contains unsupported key`);
    }
    assertSafeManifestRequestText(fields[key], `${field}.fields.${key}`, 240);
  }
}

function assertSafeManifestRequestText(value: unknown, field: string, maxLength: number): void {
  if (typeof value !== "string" || value.length < 1 || value.length > maxLength || !SAFE_MANIFEST_TEXT.test(value)) {
    throw new Error(`Unsafe game API manifest: ${field} must be bounded text`);
  }
  const normalized = value.replace(/\bnot an account or session\b/gi, "not a sandbox grant");
  if (hasUnsafeManifestText(normalized)) {
    throw new Error(`Unsafe game API manifest: ${field} contains unsafe text`);
  }
}

function assertSafeManifestBoundaryDecision(decision: IocalcBoundaryDecision): void {
  assertKnownObjectKeys(decision, MANIFEST_BOUNDARY_KEYS, "boundary");
  assertSafeManifestMetadataText(decision.reason, "boundary.reason", 240);
  if (decision.reviewedBy !== undefined) {
    assertSafeManifestMetadataText(decision.reviewedBy, "boundary.reviewedBy", 80);
  }
  if (decision.at !== undefined) {
    assertSafeManifestMetadataText(decision.at, "boundary.at", 80);
  }
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
    throw new Error("Unsafe boundary action");
  }
  if (typeof decision.allowed !== "boolean") {
    throw new Error("Unsafe boundary decision: allowed must be boolean");
  }
  if (decision.policy !== "sandbox-gameplay-only") {
    throw new Error("Unsafe boundary policy");
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
    throw new Error("Unsafe audit event type");
  }
  if (!BOUNDARY_ACTIONS.includes(event.action)) {
    throw new Error("Unsafe audit event action");
  }
  assertSandboxBoundaryDecision(event.boundary);
  if (event.boundary.action !== event.action) {
    throw new Error("Unsafe audit event: action must match boundary action");
  }
  if (typeof event.summary !== "string" || event.summary.trim().length === 0) {
    throw new Error("Unsafe audit event: summary must be non-empty text");
  }
}
