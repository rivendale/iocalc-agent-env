import type {
  IocalcBoundaryDecision,
  IocalcCommandSource,
  IocalcControllerType,
  IocalcForbiddenCapabilityName,
  IocalcSafeCapabilityName,
  IocalcTransport
} from "./types.js";
import { IOCALC_COMMAND_SOURCES, IOCALC_CONTROLLER_TYPES } from "./types.js";
import { assertSandboxBoundaryDecision, IOCALC_FORBIDDEN_CAPABILITIES } from "./capabilities.js";

export const IOCALC_AGENT_GOVERNANCE_SCHEMA_VERSION = "iocalc-agent-governance-v1" as const;

export const IOCALC_GAME_SCENARIO_SETUP_VERSION = "iocalc-game-scenario-setup-v1" as const;

export interface IocalcGameScenarioRecord {
  id: string;
  label: string;
  setupVersion: typeof IOCALC_GAME_SCENARIO_SETUP_VERSION;
  sandboxOnly: true;
  notFinancialAdvice: true;
  notInvestmentProduct: true;
  publicRoutesCanSpendCredits: false;
  wiredIntoResolver: true;
  setupText: string;
}

export type IocalcAgentGovernanceEventType =
  | "session-started"
  | "session-ended"
  | "session-revoked"
  | "tool-call"
  | "command-submitted"
  | "fallback-used"
  | "timeout"
  | "failure-state"
  | "contamination-signal"
  | "risk-band"
  | "conformance-check"
  | "adversarial-review"
  | "pr-merged"
  | "request-rejected";

export type IocalcAgentGovernanceVerdict = "allow" | "block" | "quarantine" | "review";

export type IocalcAgentGovernanceFailureKind =
  | "missing-context"
  | "query-evidence-mismatch"
  | "ambiguous-command"
  | "stalled-loop"
  | "unsafe-request"
  | "contamination-signal"
  | "irreducible";

export type IocalcAgentGovernanceFailureRoute =
  | "rewrite"
  | "decompose"
  | "focus"
  | "exit"
  | "referee-review"
  | "fallback";

export interface IocalcAgentGovernancePolicy {
  sandboxOnly: true;
  submittedTextIsUntrusted: true;
  noWalletAuthority: true;
  noSecretsAccess: true;
  noProductionMutation: true;
  noExternalUrlFetch: true;
  noCodeExecution: true;
  noFeedbackTrustMutation: true;
  noFinancialFunctionality: true;
  humanReviewRequiredForAuthorityChanges: true;
}

export interface IocalcAgentGovernanceSession {
  sessionId: string;
  canonicalAgentId: string;
  displayName?: string;
  controllerType: IocalcControllerType;
  commandSource: IocalcCommandSource;
  transport: IocalcTransport;
  sandboxId?: string;
  owner?: "human" | "local-script" | "local-test" | "unknown";
  status: "active" | "completed" | "expired" | "revoked";
  startedAt: string;
  expiresAt?: string;
  endedAt?: string;
  capabilityScope: IocalcSafeCapabilityName[];
  blockedCapabilities: IocalcForbiddenCapabilityName[];
  policy: IocalcAgentGovernancePolicy;
}

export interface IocalcAgentGovernanceFailureState {
  kind: IocalcAgentGovernanceFailureKind;
  route: IocalcAgentGovernanceFailureRoute;
  confidence: number;
  notes: string;
}

export interface IocalcAgentGovernanceContaminationSignal {
  sourceSessionId?: string;
  sourceAgentId?: string;
  topologyHop: number;
  signal: "none" | "low" | "medium" | "high";
  quarantineRecommended: boolean;
  notes: string;
}

export interface IocalcAgentGovernanceRiskBand {
  method: "scenario-resample" | "monte-carlo-resample" | "deterministic-estimate";
  samples: number;
  p05: number;
  p50: number;
  p95: number;
  metric: string;
  notes: string;
}

export interface IocalcAgentGovernanceEvidence {
  previousDigest?: string;
  payloadDigest: string;
  entryDigest: string;
  canonicalization: "iocalc-stable-json-v1";
  digestAlgorithm: "fnv1a64-noncryptographic";
}

export interface IocalcAgentGovernanceLedgerEntry {
  sequence: number;
  id: string;
  at: string;
  eventType: IocalcAgentGovernanceEventType;
  sessionId?: string;
  actor: {
    canonicalAgentId: string;
    displayName?: string;
    controllerType: IocalcControllerType;
    commandSource?: IocalcCommandSource;
  };
  transport?: IocalcTransport;
  sandboxId?: string;
  action: string;
  summary: string;
  verdict: IocalcAgentGovernanceVerdict;
  verdictWeight: number;
  boundary: IocalcBoundaryDecision;
  failureState?: IocalcAgentGovernanceFailureState;
  contamination?: IocalcAgentGovernanceContaminationSignal;
  riskBand?: IocalcAgentGovernanceRiskBand;
  evidence: IocalcAgentGovernanceEvidence;
  metadata?: Record<string, unknown>;
}

export interface IocalcAgentGovernanceLedger {
  schemaVersion: typeof IOCALC_AGENT_GOVERNANCE_SCHEMA_VERSION;
  project: "IOCALC";
  ledgerId: string;
  generatedAt: string;
  scenarioId?: string;
  scenario?: IocalcGameScenarioRecord | null;
  policy: IocalcAgentGovernancePolicy;
  sessions: IocalcAgentGovernanceSession[];
  entries: IocalcAgentGovernanceLedgerEntry[];
  latestDigest?: string;
}

const SAFE_TEXT = /^[A-Za-z0-9 .,:;!?'"()_\/&+-]+$/;
const SAFE_ID = /^[A-Za-z0-9](?:[A-Za-z0-9_.:-]{0,118}[A-Za-z0-9])?$/;
const CANONICAL_AGENT_ID = /^iocalc-(?:agent|guide|runner|referee)-[0-9]{4}$/;
const DIGEST_PATTERN = /^fnv1a64:[a-f0-9]{16}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const CONTROLLER_TYPES = new Set<IocalcControllerType>(IOCALC_CONTROLLER_TYPES);
const COMMAND_SOURCES = new Set<IocalcCommandSource>(IOCALC_COMMAND_SOURCES);
const TRANSPORTS = new Set<IocalcTransport>(["manual", "browser", "http", "mcp", "local-core"]);
const SESSION_STATUS = new Set(["active", "completed", "expired", "revoked"]);
const EVENT_TYPES = new Set<IocalcAgentGovernanceEventType>([
  "session-started",
  "session-ended",
  "session-revoked",
  "tool-call",
  "command-submitted",
  "fallback-used",
  "timeout",
  "failure-state",
  "contamination-signal",
  "risk-band",
  "conformance-check",
  "adversarial-review",
  "pr-merged",
  "request-rejected"
]);
const VERDICTS = new Set<IocalcAgentGovernanceVerdict>(["allow", "block", "quarantine", "review"]);
const FAILURE_KINDS = new Set<IocalcAgentGovernanceFailureKind>([
  "missing-context",
  "query-evidence-mismatch",
  "ambiguous-command",
  "stalled-loop",
  "unsafe-request",
  "contamination-signal",
  "irreducible"
]);
const FAILURE_ROUTES = new Set<IocalcAgentGovernanceFailureRoute>([
  "rewrite",
  "decompose",
  "focus",
  "exit",
  "referee-review",
  "fallback"
]);
const CONTAMINATION_SIGNALS = new Set(["none", "low", "medium", "high"]);
const RISK_BAND_METHODS = new Set(["scenario-resample", "monte-carlo-resample", "deterministic-estimate"]);
const SAFE_CAPABILITIES = new Set<IocalcSafeCapabilityName>([
  "canReadState",
  "canSubmitGameCommand",
  "canResolveSeason",
  "canReadReport",
  "canRunAgentTrial"
]);
const FORBIDDEN_CAPABILITIES = new Set<IocalcForbiddenCapabilityName>(IOCALC_FORBIDDEN_CAPABILITIES);
const FORBIDDEN_TEXT =
  /\b(?:api[_ -]?keys?|private[_ -]?keys?|seed phrases?|mnemonics?|passwords?|bearer|access[_ -]?tokens?|auth(?:orization|orizations|orize|orizes|orized|orizing)?|auth[_ -]?tokens?|oauth|refresh[_ -]?tokens?|tokens?|secrets?|credentials?|wallets?|transactions?|payments?|payouts?|withdraw(?:al|als|s|ing)?|accounts?|sessions?|production|deploy(?:ment|ments|s|ed|ing)?|permissions?|permits?|admins?|administrators?|logins?|logged[_ -]?in|financial|shell|execute|execution|eval|code|coinbase|venice|base)\b/i;
const FORBIDDEN_COMPACT_TERMS = [
  "apikey",
  "privatekey",
  "seedphrase",
  "mnemonic",
  "password",
  "bearer",
  "auth",
  "authorization",
  "authorize",
  "accesstoken",
  "authtoken",
  "oauthtoken",
  "refreshtoken",
  "token",
  "secret",
  "credential",
  "wallet",
  "transaction",
  "payment",
  "payout",
  "withdraw",
  "account",
  "session",
  "production",
  "deploy",
  "permission",
  "permit",
  "admin",
  "login",
  "financial",
  "shell",
  "execute",
  "execution",
  "eval",
  "code",
  "coinbase",
  "venice"
];
const URL_OR_SCHEME = /\b(?:[a-z][a-z0-9+.-]*:(?:\/\/)?|www\.)\S*/i;
const EXECUTABLE_TEXT = /```|<script\b|<\/script>|(?:^|\s)(?:sudo|bash|sh|python|node)\s+-/i;
const LEDGER_KEYS = new Set([
  "schemaVersion",
  "project",
  "ledgerId",
  "generatedAt",
  "scenarioId",
  "scenario",
  "policy",
  "sessions",
  "entries",
  "latestDigest"
]);
const SCENARIO_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SCENARIO_KEYS = new Set([
  "id",
  "label",
  "setupVersion",
  "sandboxOnly",
  "notFinancialAdvice",
  "notInvestmentProduct",
  "publicRoutesCanSpendCredits",
  "wiredIntoResolver",
  "setupText"
]);
const POLICY_KEYS = new Set([
  "sandboxOnly",
  "submittedTextIsUntrusted",
  "noWalletAuthority",
  "noSecretsAccess",
  "noProductionMutation",
  "noExternalUrlFetch",
  "noCodeExecution",
  "noFeedbackTrustMutation",
  "noFinancialFunctionality",
  "humanReviewRequiredForAuthorityChanges"
]);
const SESSION_KEYS = new Set([
  "sessionId",
  "canonicalAgentId",
  "displayName",
  "controllerType",
  "commandSource",
  "transport",
  "sandboxId",
  "owner",
  "status",
  "startedAt",
  "expiresAt",
  "endedAt",
  "capabilityScope",
  "blockedCapabilities",
  "policy"
]);
const ENTRY_KEYS = new Set([
  "sequence",
  "id",
  "at",
  "eventType",
  "sessionId",
  "actor",
  "transport",
  "sandboxId",
  "action",
  "summary",
  "verdict",
  "verdictWeight",
  "boundary",
  "failureState",
  "contamination",
  "riskBand",
  "evidence",
  "metadata"
]);
const ACTOR_KEYS = new Set(["canonicalAgentId", "displayName", "controllerType", "commandSource"]);
const FAILURE_STATE_KEYS = new Set(["kind", "route", "confidence", "notes"]);
const CONTAMINATION_KEYS = new Set(["sourceSessionId", "sourceAgentId", "topologyHop", "signal", "quarantineRecommended", "notes"]);
const RISK_BAND_KEYS = new Set(["method", "samples", "p05", "p50", "p95", "metric", "notes"]);
const EVIDENCE_KEYS = new Set(["previousDigest", "payloadDigest", "entryDigest", "canonicalization", "digestAlgorithm"]);
const BOUNDARY_KEYS = new Set(["action", "allowed", "sandboxOnly", "policy", "reason", "blockedCapabilities", "reviewedBy", "at"]);

export const DEFAULT_AGENT_GOVERNANCE_POLICY: IocalcAgentGovernancePolicy = Object.freeze({
  sandboxOnly: true,
  submittedTextIsUntrusted: true,
  noWalletAuthority: true,
  noSecretsAccess: true,
  noProductionMutation: true,
  noExternalUrlFetch: true,
  noCodeExecution: true,
  noFeedbackTrustMutation: true,
  noFinancialFunctionality: true,
  humanReviewRequiredForAuthorityChanges: true
});

export function makeAgentGovernanceEvidence(
  payload: unknown,
  previousDigest?: string
): IocalcAgentGovernanceEvidence {
  const payloadDigest = makeIocalcGovernanceDigest(payload);
  const entryDigest = makeIocalcGovernanceDigest({
    previousDigest,
    payloadDigest,
    canonicalization: "iocalc-stable-json-v1",
    digestAlgorithm: "fnv1a64-noncryptographic"
  });
  return {
    previousDigest,
    payloadDigest,
    entryDigest,
    canonicalization: "iocalc-stable-json-v1",
    digestAlgorithm: "fnv1a64-noncryptographic"
  };
}

export function makeAgentGovernanceEntryEvidence(
  entry: Omit<IocalcAgentGovernanceLedgerEntry, "evidence">,
  previousDigest?: string
): IocalcAgentGovernanceEvidence {
  return makeAgentGovernanceEvidence(entry, previousDigest);
}

export function makeIocalcGovernanceDigest(payload: unknown): string {
  return `fnv1a64:${fnv1a64(stableJson(payload))}`;
}

export function stableJson(value: unknown): string {
  return stableJsonValue(value, new WeakSet<object>());
}

function stableJsonValue(value: unknown, seen: WeakSet<object>): string {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error("Unsafe agent governance digest: non-finite number.");
    }
    return JSON.stringify(value);
  }
  if (typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") {
    throw new Error("Unsafe agent governance digest: unsupported value.");
  }
  if (!value || typeof value !== "object") {
    return JSON.stringify(null);
  }
  if (seen.has(value)) {
    throw new Error("Unsafe agent governance digest: cyclic object.");
  }
  seen.add(value);
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      throw new Error("Unsafe agent governance digest: unsupported array prototype.");
    }
    const items: string[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !("value" in descriptor)) {
        throw new Error("Unsafe agent governance digest: accessor or sparse array value.");
      }
      items.push(stableJsonValue(descriptor.value, seen));
    }
    for (const key of Reflect.ownKeys(value)) {
      if (key !== "length" && (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/.test(key))) {
        throw new Error("Unsafe agent governance digest: unsupported array key.");
      }
    }
    seen.delete(value);
    return `[${items.join(",")}]`;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error("Unsafe agent governance digest: unsupported object prototype.");
  }
  const entries: Array<[string, unknown]> = [];
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") {
      throw new Error("Unsafe agent governance digest: unsupported key.");
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor)) {
      throw new Error("Unsafe agent governance digest: accessor property.");
    }
    if (descriptor.value !== undefined) {
      entries.push([key, descriptor.value]);
    }
  }
  entries.sort(([left], [right]) => left.localeCompare(right));
  const output = `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableJsonValue(entryValue, seen)}`).join(",")}}`;
  seen.delete(value);
  return output;
}

export function assertAgentGovernanceLedger(ledger: IocalcAgentGovernanceLedger): void {
  assertDataOnlyGovernanceGraph(ledger);
  assertKnownGovernanceKeys(ledger, LEDGER_KEYS, "ledger");
  if (ledger.schemaVersion !== IOCALC_AGENT_GOVERNANCE_SCHEMA_VERSION || ledger.project !== "IOCALC") {
    throw new Error("Unsafe agent governance ledger: invalid schema or project.");
  }
  assertSafeGovernanceId(ledger.ledgerId, "ledgerId");
  assertIsoDate(ledger.generatedAt, "generatedAt");
  assertLedgerScenario(ledger.scenarioId, ledger.scenario);
  assertAgentGovernancePolicy(ledger.policy);
  if (!Array.isArray(ledger.sessions) || ledger.sessions.length > 100) {
    throw new Error("Unsafe agent governance ledger: sessions must be bounded.");
  }
  if (!Array.isArray(ledger.entries) || ledger.entries.length > 1000) {
    throw new Error("Unsafe agent governance ledger: entries must be bounded.");
  }
  const sessionIds = new Set<string>();
  for (const session of ledger.sessions) {
    assertAgentGovernanceSession(session);
    if (sessionIds.has(session.sessionId)) {
      throw new Error("Unsafe agent governance ledger: duplicate session.");
    }
    sessionIds.add(session.sessionId);
  }
  let previousSequence = 0;
  let previousDigest: string | undefined;
  const entryIds = new Set<string>();
  for (const entry of ledger.entries) {
    assertAgentGovernanceLedgerEntry(entry);
    if (entryIds.has(entry.id)) {
      throw new Error("Unsafe agent governance ledger: duplicate entry.");
    }
    entryIds.add(entry.id);
    if (entry.sequence !== previousSequence + 1) {
      throw new Error("Unsafe agent governance ledger: non-contiguous sequence.");
    }
    if (entry.sessionId !== undefined && !sessionIds.has(entry.sessionId)) {
      throw new Error("Unsafe agent governance ledger: entry references unknown session.");
    }
    if (entry.evidence.previousDigest !== previousDigest) {
      throw new Error("Unsafe agent governance ledger: digest chain is broken.");
    }
    assertEntryEvidenceMatchesPayload(entry);
    previousSequence = entry.sequence;
    previousDigest = entry.evidence.entryDigest;
  }
  if (ledger.entries.length > 0 && ledger.latestDigest !== previousDigest) {
    throw new Error("Unsafe agent governance ledger: latest digest mismatch.");
  }
  if (ledger.entries.length === 0 && ledger.latestDigest !== undefined) {
    throw new Error("Unsafe agent governance ledger: latest digest mismatch.");
  }
}

export function assertAgentGovernanceSession(session: IocalcAgentGovernanceSession): void {
  assertKnownGovernanceKeys(session, SESSION_KEYS, "session");
  assertSafeGovernanceId(session.sessionId, "sessionId");
  assertCanonicalAgentId(session.canonicalAgentId);
  assertSafeGovernanceText(session.displayName, "displayName", 80, true);
  if (!CONTROLLER_TYPES.has(session.controllerType)) {
    throw new Error("Unsafe agent governance session: unsupported controller type.");
  }
  if (!COMMAND_SOURCES.has(session.commandSource)) {
    throw new Error("Unsafe agent governance session: unsupported command source.");
  }
  if (!TRANSPORTS.has(session.transport)) {
    throw new Error("Unsafe agent governance session: unsupported transport.");
  }
  if (!SESSION_STATUS.has(session.status)) {
    throw new Error("Unsafe agent governance session: unsupported status.");
  }
  assertSafeGovernanceId(session.sandboxId, "sandboxId", true);
  assertIsoDate(session.startedAt, "startedAt");
  if (session.expiresAt !== undefined) assertIsoDate(session.expiresAt, "expiresAt");
  if (session.endedAt !== undefined) assertIsoDate(session.endedAt, "endedAt");
  assertCapabilityScope(session.capabilityScope);
  assertBlockedCapabilities(session.blockedCapabilities);
  assertAgentGovernancePolicy(session.policy);
  if (!["human", "local-script", "local-test", "unknown", undefined].includes(session.owner)) {
    throw new Error("Unsafe agent governance session: unsupported owner.");
  }
}

export function assertAgentGovernanceLedgerEntry(entry: IocalcAgentGovernanceLedgerEntry): void {
  assertKnownGovernanceKeys(entry, ENTRY_KEYS, "entry");
  if (!Number.isInteger(entry.sequence) || entry.sequence < 1 || entry.sequence > 1000000) {
    throw new Error("Unsafe agent governance entry: invalid sequence.");
  }
  assertSafeGovernanceId(entry.id, "entry.id");
  assertIsoDate(entry.at, "entry.at");
  if (!EVENT_TYPES.has(entry.eventType)) {
    throw new Error("Unsafe agent governance entry: unsupported event type.");
  }
  if (entry.sessionId !== undefined) assertSafeGovernanceId(entry.sessionId, "entry.sessionId");
  assertKnownGovernanceKeys(entry.actor, ACTOR_KEYS, "entry.actor");
  assertCanonicalAgentId(entry.actor.canonicalAgentId);
  assertSafeGovernanceText(entry.actor.displayName, "actor.displayName", 80, true);
  if (!CONTROLLER_TYPES.has(entry.actor.controllerType)) {
    throw new Error("Unsafe agent governance entry: unsupported actor controller type.");
  }
  if (entry.actor.commandSource !== undefined && !COMMAND_SOURCES.has(entry.actor.commandSource)) {
    throw new Error("Unsafe agent governance entry: unsupported actor command source.");
  }
  if (entry.transport !== undefined && !TRANSPORTS.has(entry.transport)) {
    throw new Error("Unsafe agent governance entry: unsupported transport.");
  }
  assertSafeGovernanceId(entry.sandboxId, "entry.sandboxId", true);
  assertSafeGovernanceText(entry.action, "entry.action", 80);
  assertSafeGovernanceText(entry.summary, "entry.summary", 240);
  if (!VERDICTS.has(entry.verdict)) {
    throw new Error("Unsafe agent governance entry: unsupported verdict.");
  }
  if (!Number.isFinite(entry.verdictWeight) || entry.verdictWeight < 0 || entry.verdictWeight > 1) {
    throw new Error("Unsafe agent governance entry: invalid verdict weight.");
  }
  assertSandboxBoundaryDecision(entry.boundary);
  if (entry.boundary.sandboxOnly !== true || entry.boundary.policy !== "sandbox-gameplay-only") {
    throw new Error("Unsafe agent governance entry: boundary must remain sandbox-only.");
  }
  assertGovernanceBoundaryDecision(entry.boundary);
  if (entry.failureState !== undefined) assertFailureState(entry.failureState);
  if (entry.contamination !== undefined) assertContaminationSignal(entry.contamination);
  if (entry.riskBand !== undefined) assertRiskBand(entry.riskBand);
  assertEvidence(entry.evidence);
  if (entry.metadata !== undefined) assertSafeMetadata(entry.metadata);
}

function assertAgentGovernancePolicy(policy: IocalcAgentGovernancePolicy): void {
  assertKnownGovernanceKeys(policy, POLICY_KEYS, "policy");
  if (
    policy.sandboxOnly !== true ||
    policy.submittedTextIsUntrusted !== true ||
    policy.noWalletAuthority !== true ||
    policy.noSecretsAccess !== true ||
    policy.noProductionMutation !== true ||
    policy.noExternalUrlFetch !== true ||
    policy.noCodeExecution !== true ||
    policy.noFeedbackTrustMutation !== true ||
    policy.noFinancialFunctionality !== true ||
    policy.humanReviewRequiredForAuthorityChanges !== true
  ) {
    throw new Error("Unsafe agent governance policy: required safety boundary is disabled.");
  }
}

function assertLedgerScenario(scenarioId: unknown, scenario: unknown): void {
  if (scenarioId !== undefined && scenarioId !== "") {
    if (typeof scenarioId !== "string" || scenarioId.length > 80 || !SCENARIO_ID_PATTERN.test(scenarioId)) {
      throw new Error("Unsafe agent governance ledger: scenarioId must be a scenario seed slug.");
    }
  }
  if (scenario === undefined || scenario === null) {
    if (typeof scenarioId === "string" && scenarioId !== "") {
      throw new Error("Unsafe agent governance ledger: scenarioId requires a matching scenario record.");
    }
    return;
  }
  if (typeof scenario !== "object" || Array.isArray(scenario)) {
    throw new Error("Unsafe agent governance ledger: scenario must be a scenario record.");
  }
  assertKnownGovernanceKeys(scenario, SCENARIO_KEYS, "scenario");
  const record = scenario as IocalcGameScenarioRecord;
  if (record.setupVersion !== IOCALC_GAME_SCENARIO_SETUP_VERSION) {
    throw new Error("Unsafe agent governance ledger: unsupported scenario setup version.");
  }
  if (
    record.sandboxOnly !== true ||
    record.notFinancialAdvice !== true ||
    record.notInvestmentProduct !== true ||
    record.publicRoutesCanSpendCredits !== false ||
    record.wiredIntoResolver !== true
  ) {
    throw new Error("Unsafe agent governance ledger: scenario record weakens sandbox safety declarations.");
  }
  if (typeof record.id !== "string" || record.id.length < 1 || record.id.length > 80 || !SCENARIO_ID_PATTERN.test(record.id)) {
    throw new Error("Unsafe agent governance ledger: scenario.id must be a scenario seed slug.");
  }
  if (scenarioId !== record.id) {
    throw new Error("Unsafe agent governance ledger: scenario.id must match scenarioId.");
  }
  assertScenarioCatalogText(record.label, "scenario.label", 80);
  assertScenarioCatalogText(record.setupText, "scenario.setupText", 240);
}

// Exact server-authored scenario-catalog strings that legitimately trip the
// forbidden-vocabulary filter with benign English words: "Code governance
// fault" matches \bcode\b, and the policy-uncertainty setupText matches \bbase\b
// ("base/downside comparison"). These pinned constants are the ONLY scenario
// text exempt from the term filter; every other scenario.label/setupText must
// still pass the same hasUnsafeGovernanceText check as all other ledger text,
// so wallet/secret/authority-expansion prose stays blocked. Keep this list in
// lockstep with the server catalog (iso-ai-game GAME_SCENARIO_SETUPS): a new
// scenario whose text trips the filter fails conformance loudly until its exact
// string is reviewed and added here.
const SCENARIO_CATALOG_TEXT_ALLOWLIST = new Set<string>([
  "Code governance fault",
  "Pressure and rules feel unsettled, rewarding assumption updates and base/downside comparison."
]);

function assertScenarioCatalogText(value: unknown, field: string, maxLength: number): void {
  if (typeof value !== "string" || value.length < 1 || value.length > maxLength) {
    throw new Error(`Unsafe agent governance ledger: ${field} must be bounded text.`);
  }
  if (!SAFE_TEXT.test(value) || URL_OR_SCHEME.test(value) || EXECUTABLE_TEXT.test(value)) {
    throw new Error(`Unsafe agent governance ledger: ${field} contains unsafe text.`);
  }
  if (SCENARIO_CATALOG_TEXT_ALLOWLIST.has(value)) {
    return;
  }
  if (hasUnsafeGovernanceText(value)) {
    throw new Error(`Unsafe agent governance ledger: ${field} contains unsafe text.`);
  }
}

function assertCapabilityScope(capabilities: unknown): void {
  if (!Array.isArray(capabilities) || capabilities.length > SAFE_CAPABILITIES.size) {
    throw new Error("Unsafe agent governance session: invalid capability scope.");
  }
  const seen = new Set<string>();
  for (const capability of capabilities) {
    if (!SAFE_CAPABILITIES.has(capability as IocalcSafeCapabilityName) || seen.has(String(capability))) {
      throw new Error("Unsafe agent governance session: unsupported capability.");
    }
    seen.add(String(capability));
  }
}

function assertBlockedCapabilities(capabilities: unknown): void {
  if (!Array.isArray(capabilities) || capabilities.length !== FORBIDDEN_CAPABILITIES.size) {
    throw new Error("Unsafe agent governance session: blocked capabilities must match the forbidden set.");
  }
  const seen = new Set<string>();
  for (const capability of capabilities) {
    if (!FORBIDDEN_CAPABILITIES.has(capability as IocalcForbiddenCapabilityName) || seen.has(String(capability))) {
      throw new Error("Unsafe agent governance session: unsupported blocked capability.");
    }
    seen.add(String(capability));
  }
}

function assertFailureState(failureState: IocalcAgentGovernanceFailureState): void {
  assertKnownGovernanceKeys(failureState, FAILURE_STATE_KEYS, "failureState");
  if (!FAILURE_KINDS.has(failureState.kind) || !FAILURE_ROUTES.has(failureState.route)) {
    throw new Error("Unsafe agent governance failure state: unsupported type.");
  }
  if (!Number.isFinite(failureState.confidence) || failureState.confidence < 0 || failureState.confidence > 1) {
    throw new Error("Unsafe agent governance failure state: invalid confidence.");
  }
  assertSafeGovernanceText(failureState.notes, "failureState.notes", 160);
}

function assertContaminationSignal(signal: IocalcAgentGovernanceContaminationSignal): void {
  assertKnownGovernanceKeys(signal, CONTAMINATION_KEYS, "contamination");
  assertSafeGovernanceId(signal.sourceSessionId, "contamination.sourceSessionId", true);
  if (signal.sourceAgentId !== undefined) assertCanonicalAgentId(signal.sourceAgentId);
  if (!Number.isInteger(signal.topologyHop) || signal.topologyHop < 0 || signal.topologyHop > 32) {
    throw new Error("Unsafe agent governance contamination signal: invalid topology hop.");
  }
  if (!CONTAMINATION_SIGNALS.has(signal.signal)) {
    throw new Error("Unsafe agent governance contamination signal: unsupported signal.");
  }
  if (typeof signal.quarantineRecommended !== "boolean") {
    throw new Error("Unsafe agent governance contamination signal: invalid quarantine flag.");
  }
  assertSafeGovernanceText(signal.notes, "contamination.notes", 160);
}

function assertRiskBand(riskBand: IocalcAgentGovernanceRiskBand): void {
  assertKnownGovernanceKeys(riskBand, RISK_BAND_KEYS, "riskBand");
  if (!RISK_BAND_METHODS.has(riskBand.method)) {
    throw new Error("Unsafe agent governance risk band: unsupported method.");
  }
  if (!Number.isInteger(riskBand.samples) || riskBand.samples < 1 || riskBand.samples > 100000) {
    throw new Error("Unsafe agent governance risk band: invalid sample count.");
  }
  for (const key of ["p05", "p50", "p95"] as const) {
    if (!Number.isFinite(riskBand[key])) {
      throw new Error("Unsafe agent governance risk band: percentile must be numeric.");
    }
  }
  if (riskBand.p05 > riskBand.p50 || riskBand.p50 > riskBand.p95) {
    throw new Error("Unsafe agent governance risk band: percentiles must be ordered.");
  }
  assertSafeGovernanceText(riskBand.metric, "riskBand.metric", 80);
  assertSafeGovernanceText(riskBand.notes, "riskBand.notes", 160);
}

function assertEvidence(evidence: IocalcAgentGovernanceEvidence): void {
  assertKnownGovernanceKeys(evidence, EVIDENCE_KEYS, "evidence");
  if (evidence.previousDigest !== undefined && !DIGEST_PATTERN.test(evidence.previousDigest)) {
    throw new Error("Unsafe agent governance evidence: invalid previous digest.");
  }
  if (!DIGEST_PATTERN.test(evidence.payloadDigest)) {
    throw new Error("Unsafe agent governance evidence: invalid payload digest.");
  }
  if (!DIGEST_PATTERN.test(evidence.entryDigest)) {
    throw new Error("Unsafe agent governance evidence: invalid entry digest.");
  }
  if (evidence.canonicalization !== "iocalc-stable-json-v1" || evidence.digestAlgorithm !== "fnv1a64-noncryptographic") {
    throw new Error("Unsafe agent governance evidence: unsupported evidence format.");
  }
  const expectedEntryDigest = makeIocalcGovernanceDigest({
    previousDigest: evidence.previousDigest,
    payloadDigest: evidence.payloadDigest,
    canonicalization: evidence.canonicalization,
    digestAlgorithm: evidence.digestAlgorithm
  });
  if (evidence.entryDigest !== expectedEntryDigest) {
    throw new Error("Unsafe agent governance evidence: entry digest mismatch.");
  }
}

function assertEntryEvidenceMatchesPayload(entry: IocalcAgentGovernanceLedgerEntry): void {
  const expectedPayloadDigest = makeIocalcGovernanceDigest(governanceEntryPayload(entry));
  if (entry.evidence.payloadDigest !== expectedPayloadDigest) {
    throw new Error("Unsafe agent governance ledger: payload digest mismatch.");
  }
}

function governanceEntryPayload(entry: IocalcAgentGovernanceLedgerEntry): Omit<IocalcAgentGovernanceLedgerEntry, "evidence"> {
  const payload: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(entry)) {
    if (key === "evidence") continue;
    if (typeof key !== "string") {
      throw new Error("Unsafe agent governance ledger: entry contains unsupported key.");
    }
    const descriptor = Object.getOwnPropertyDescriptor(entry, key);
    if (!descriptor || !("value" in descriptor)) {
      throw new Error("Unsafe agent governance ledger: entry contains accessor property.");
    }
    payload[key] = descriptor.value;
  }
  return payload as Omit<IocalcAgentGovernanceLedgerEntry, "evidence">;
}

function assertSafeMetadata(metadata: Record<string, unknown>): void {
  assertDataOnlyGovernanceGraph(metadata);
  const keys = Object.keys(metadata);
  if (keys.length > 20) {
    throw new Error("Unsafe agent governance metadata: too many fields.");
  }
  for (const key of keys) {
    assertSafeGovernanceId(key, "metadata key");
    if (hasUnsafeGovernanceText(key)) {
      throw new Error("Unsafe agent governance metadata: unsafe key.");
    }
    const value = metadata[key];
    if (typeof value === "string") {
      assertSafeGovernanceText(value, "metadata value", 160);
    } else if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new Error("Unsafe agent governance metadata: invalid number.");
    } else if (typeof value !== "boolean" && value !== null) {
      throw new Error("Unsafe agent governance metadata: metadata values must be scalar.");
    }
  }
}

function assertGovernanceBoundaryDecision(boundary: IocalcBoundaryDecision): void {
  assertKnownGovernanceKeys(boundary, BOUNDARY_KEYS, "boundary");
  assertSafeGovernanceText(boundary.reason, "boundary.reason", 240);
  if (boundary.reviewedBy !== undefined) {
    assertSafeGovernanceText(boundary.reviewedBy, "boundary.reviewedBy", 80);
  }
  if (boundary.at !== undefined) {
    assertIsoDate(boundary.at, "boundary.at");
  }
}

function assertCanonicalAgentId(value: unknown): void {
  if (typeof value !== "string" || !CANONICAL_AGENT_ID.test(value)) {
    throw new Error("Unsafe agent governance identity: invalid canonical agent ID.");
  }
}

function assertKnownGovernanceKeys(value: object, allowedKeys: Set<string>, field: string): void {
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !allowedKeys.has(key)) {
      throw new Error(`Unsafe agent governance ledger: ${field} contains unsupported key.`);
    }
  }
}

function assertIsoDate(value: string, field: string): void {
  if (!ISO_DATE_PATTERN.test(value)) {
    throw new Error(`Unsafe agent governance ledger: ${field} must be an ISO timestamp.`);
  }
}

function assertSafeGovernanceId(value: unknown, field: string, optional = false): void {
  if (optional && value === undefined) return;
  if (typeof value !== "string" || value.length < 1 || value.length > 120 || !SAFE_ID.test(value)) {
    throw new Error(`Unsafe agent governance ledger: ${field} must be a safe identifier.`);
  }
  if (hasUnsafeGovernanceText(value) || URL_OR_SCHEME.test(value)) {
    throw new Error(`Unsafe agent governance ledger: ${field} contains unsafe text.`);
  }
}

function assertSafeGovernanceText(value: unknown, field: string, maxLength: number, optional = false): void {
  if (optional && value === undefined) return;
  if (typeof value !== "string" || value.length < 1 || value.length > maxLength) {
    throw new Error(`Unsafe agent governance ledger: ${field} must be bounded text.`);
  }
  if (!SAFE_TEXT.test(value) || hasUnsafeGovernanceText(value) || URL_OR_SCHEME.test(value) || EXECUTABLE_TEXT.test(value)) {
    throw new Error(`Unsafe agent governance ledger: ${field} contains unsafe text.`);
  }
}

function hasUnsafeGovernanceText(value: string): boolean {
  if (FORBIDDEN_TEXT.test(value)) return true;
  const compact = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return FORBIDDEN_COMPACT_TERMS.some((term) => compact.includes(term));
}

function assertDataOnlyGovernanceGraph(value: unknown, seen = new WeakSet<object>()): void {
  if (typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") {
    throw new Error("Unsafe agent governance ledger: contains executable or unsupported value.");
  }
  if (!value || typeof value !== "object") {
    return;
  }
  if (seen.has(value)) {
    return;
  }
  seen.add(value);
  const prototype = Object.getPrototypeOf(value);
  if (Array.isArray(value)) {
    if (prototype !== Array.prototype) {
      throw new Error("Unsafe agent governance ledger: contains unsupported array prototype.");
    }
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !("value" in descriptor)) {
        throw new Error("Unsafe agent governance ledger: contains accessor property.");
      }
      assertDataOnlyGovernanceGraph(descriptor.value, seen);
    }
    for (const key of Reflect.ownKeys(value)) {
      if (key !== "length" && (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/.test(key))) {
        throw new Error("Unsafe agent governance ledger: contains unsupported array key.");
      }
    }
    return;
  }
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error("Unsafe agent governance ledger: contains unsupported prototype.");
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") {
      throw new Error("Unsafe agent governance ledger: contains unsupported key.");
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor)) {
      throw new Error("Unsafe agent governance ledger: contains accessor property.");
    }
    if (!descriptor.enumerable) {
      throw new Error("Unsafe agent governance ledger: contains non-enumerable property.");
    }
    assertDataOnlyGovernanceGraph(descriptor.value, seen);
  }
}

function fnv1a64(input: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= BigInt(input.charCodeAt(index));
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, "0");
}
