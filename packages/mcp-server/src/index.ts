import { HttpIocalcAdapter, type HttpIocalcAdapterOptions } from "@iocalc/adapters";
import {
  DEFAULT_SAFE_CAPABILITIES,
  assertAgentGovernanceLedger,
  assertSafeCapabilities,
  assertSandboxGameApiManifest,
  normalizeGameCommand,
  type AgentTrialResult,
  type IocalcAgentGovernanceLedger,
  type IocalcCapabilities,
  type IocalcGameApiManifest,
  type IocalcGameApiManifestResponseSpec,
  type IocalcGameApiManifestRoute,
  type IocalcGameState,
  type IocalcMatchHistory,
  type IocalcMode,
  type IocalcPlayerAdapter,
  type IocalcSeasonReport,
  type IocalcSystemLog,
  type ResolveSeasonInput,
  type RunAgentTrialInput,
  type SeasonResolution,
  type SubmitCommandInput,
  type SubmitCommandResult
} from "@iocalc/protocol";

export * from "./conformance.js";

export interface IocalcMcpToolSpec {
  name: IocalcMcpToolName;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties: false;
  };
}

export type IocalcMcpToolName =
  | "iocalc.get_manifest"
  | "iocalc.get_capabilities"
  | "iocalc.get_state"
  | "iocalc.submit_command"
  | "iocalc.resolve_season"
  | "iocalc.get_report"
  | "iocalc.get_log"
  | "iocalc.get_match_history"
  | "iocalc.get_governance_ledger"
  | "iocalc.run_agent_trial";

export interface IocalcMcpTextContent {
  type: "text";
  text: string;
}

export interface IocalcMcpToolResult {
  content: IocalcMcpTextContent[];
  structuredContent?: unknown;
  isError?: boolean;
}

export interface IocalcMcpToolBridge {
  tools: IocalcMcpToolSpec[];
  callTool(name: IocalcMcpToolName | string, args?: unknown): Promise<IocalcMcpToolResult>;
}

const EMPTY_OBJECT_SCHEMA = {
  type: "object",
  properties: {},
  additionalProperties: false
} as const;

const MAX_MCP_COMMAND_LENGTH = 1200;
const MAX_MCP_SHORT_TEXT_LENGTH = 120;

const COMMAND_SCHEMA = {
  type: "string",
  minLength: 1,
  maxLength: MAX_MCP_COMMAND_LENGTH
} as const;

const SHORT_TEXT_SCHEMA = {
  type: "string",
  minLength: 1,
  maxLength: MAX_MCP_SHORT_TEXT_LENGTH
} as const;

const AGENT_ID_SCHEMA = {
  type: "string",
  minLength: 1,
  maxLength: 64,
  pattern: "^iocalc-(?:agent|guide|runner|referee)-[0-9]{4}$"
} as const;

const SANDBOX_ID_SCHEMA = {
  type: "string",
  minLength: 1,
  maxLength: 80,
  pattern: "^[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,78}[A-Za-z0-9])?$"
} as const;

export const IOCALC_MCP_TOOLS: IocalcMcpToolSpec[] = [
  {
    name: "iocalc.get_manifest",
    description: "Read the sandbox IOCALC game API manifest. Descriptive only; grants no wallet, production, account, or financial authority.",
    inputSchema: EMPTY_OBJECT_SCHEMA
  },
  {
    name: "iocalc.get_capabilities",
    description: "Read sandbox IOCALC adapter capabilities. Must report wallet and production actions disabled.",
    inputSchema: EMPTY_OBJECT_SCHEMA
  },
  {
    name: "iocalc.get_state",
    description: "Read sandbox IOCALC game state.",
    inputSchema: EMPTY_OBJECT_SCHEMA
  },
  {
    name: "iocalc.submit_command",
    description: "Submit a sandbox seasonal game command. Does not touch wallets, secrets, feedback trust, or production state.",
    inputSchema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["season_duel", "agent_trials"] },
        command: COMMAND_SCHEMA,
        agentName: SHORT_TEXT_SCHEMA,
        sandboxId: SANDBOX_ID_SCHEMA,
        seed: SHORT_TEXT_SCHEMA
      },
      required: ["mode", "command"],
      additionalProperties: false
    }
  },
  {
    name: "iocalc.resolve_season",
    description: "Resolve a deterministic sandbox IOCALC season.",
    inputSchema: {
      type: "object",
      properties: {
        sandboxId: SANDBOX_ID_SCHEMA,
        seed: SHORT_TEXT_SCHEMA
      },
      additionalProperties: false
    }
  },
  {
    name: "iocalc.get_report",
    description: "Read the current sandbox season report.",
    inputSchema: EMPTY_OBJECT_SCHEMA
  },
  {
    name: "iocalc.get_log",
    description: "Read the sandbox system log.",
    inputSchema: EMPTY_OBJECT_SCHEMA
  },
  {
    name: "iocalc.get_match_history",
    description: "Read sandbox match history.",
    inputSchema: EMPTY_OBJECT_SCHEMA
  },
  {
    name: "iocalc.get_governance_ledger",
    description: "Read sandbox governance ledger evidence. Evidence is read-only and grants no gameplay, wallet, production, or account authority.",
    inputSchema: EMPTY_OBJECT_SCHEMA
  },
  {
    name: "iocalc.run_agent_trial",
    description: "Run a sandbox-only IOCALC agent trial when the target adapter supports it.",
    inputSchema: {
      type: "object",
      properties: {
        agentA: AGENT_ID_SCHEMA,
        agentB: AGENT_ID_SCHEMA,
        seasons: { type: "integer", minimum: 1, maximum: 100 },
        sandboxId: SANDBOX_ID_SCHEMA,
        seed: SHORT_TEXT_SCHEMA
      },
      required: ["agentA", "agentB", "seasons"],
      additionalProperties: false
    }
  }
];

const TOOL_NAMES = new Set<string>(IOCALC_MCP_TOOLS.map((tool) => tool.name));
const SAFE_CAPABILITY_KEYS = new Set([
  "canReadState",
  "canSubmitGameCommand",
  "canResolveSeason",
  "canReadReport",
  "canRunAgentTrial"
]);
const SAFE_MANIFEST_ROUTES = new Set([
  "GET /api/game/manifest",
  "GET /api/game/capabilities",
  "GET /api/game/state",
  "POST /api/game/command",
  "POST /api/game/resolve",
  "GET /api/game/report",
  "GET /api/game/log",
  "GET /api/game/match-history",
  "GET /api/game/governance-ledger",
  "POST /api/game/agent-trial"
]);
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
  ["GET /api/game/governance-ledger", "none"],
  ["POST /api/game/agent-trial", "sandbox-trial-state-only"]
]);
const CONTROLLER_TYPES = new Set(["human", "advisor-fallback", "local-heuristic-ai", "scripted-agent", "future-remote-agent"]);
const COMMAND_SOURCES = new Set(["human", "ai", "fallback", "scripted", "manual", "browser", "http", "mcp", "local-core"]);
const TRANSPORTS = new Set(["manual", "browser", "http", "mcp", "local-core"]);
const TRANSCRIPT_EVENT_TYPES = new Set(["state", "command", "resolution", "report", "log", "error"]);
const FORBIDDEN_MCP_TEXT =
  /\b(?:accounts?|api[_ -]?key|auth|bearer|broker|coinbase|contracts?|cookies?|crypto|deploy|deployment|eval|execute|financial|login|mnemonic|oauth|password|private[_ -]?key|production|secrets?|seed phrase|sessions?|shell|sudo|tokens?|transactions?|transfers?|wallets?|withdraw(?:al)?)\b/i;
const FORBIDDEN_MCP_TEXT_GLOBAL = new RegExp(FORBIDDEN_MCP_TEXT.source, "gi");
const SENSITIVE_RESULT_KEY =
  /(?:account|api.*key|auth|bearer|cookie|credential|deploy|feedback|fetch|financial|key|login|mnemonic|oauth|password|permission|private|production|secret|session|token|transaction|trust|url|wallet|withdraw)/i;
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
const OFFICIAL_HTTP_HOSTS = new Set(["iocalc.com", "play.iocalc.com"]);
const LOCAL_HTTP_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const CANONICAL_AGENT_ID_PATTERN = /^iocalc-(?:agent|guide|runner|referee)-[0-9]{4}$/;
const SANDBOX_ID_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,78}[A-Za-z0-9])?$/;
const SECRET_SANDBOX_PATTERN =
  /(?:api[._-]*key|private[._-]*key|seed[._-]*phrase|mnemonic|password|(?:access|auth|bearer|oauth|refresh)[._-]*token|token|secret|credential|passwd)/i;
const COMMAND_REQUEST_FIELD_KEYS = ["sandboxId", "mode", "agentName", "command", "seed"];
const AGENT_TRIAL_REQUEST_FIELD_KEYS = ["sandboxId", "agentA", "agentB", "seasons", "seed"];
const PROTOTYPE_RESULT_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const SAFE_RESPONSE_FIELD_PATH = /^[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)*$/;

export function createIocalcMcpToolBridge(adapter: IocalcPlayerAdapter): IocalcMcpToolBridge {
  return {
    tools: IOCALC_MCP_TOOLS,
    async callTool(name: IocalcMcpToolName | string, args?: unknown): Promise<IocalcMcpToolResult> {
      if (!TOOL_NAMES.has(name)) {
        return errorResult("Unknown IOCALC MCP tool.");
      }

      try {
        switch (name) {
          case "iocalc.get_manifest": {
            assertNoArgs(args);
            await getSafeCapabilities(adapter);
            if (!adapter.getManifest) {
              return errorResult("Adapter does not expose a sandbox game API manifest.");
            }
            return okResult(sanitizeGameApiManifest(await adapter.getManifest()));
          }
          case "iocalc.get_capabilities":
            assertNoArgs(args);
            return okResult(await getSafeCapabilities(adapter));
          case "iocalc.get_state": {
            assertNoArgs(args);
            assertToolCapability(await getSafeCapabilities(adapter), "canReadState", name);
            return okResult(sanitizeGameState(await adapter.getState()));
          }
          case "iocalc.submit_command": {
            const input = parseSubmitCommandInput(args);
            assertToolCapability(await getSafeCapabilities(adapter), "canSubmitGameCommand", name);
            return okResult(sanitizeSubmitCommandResult(await adapter.submitCommand(input)));
          }
          case "iocalc.resolve_season": {
            const input = parseResolveSeasonInput(args);
            assertToolCapability(await getSafeCapabilities(adapter), "canResolveSeason", name);
            return okResult(sanitizeSeasonResolution(await adapter.resolveSeason(input)));
          }
          case "iocalc.get_report": {
            assertNoArgs(args);
            assertToolCapability(await getSafeCapabilities(adapter), "canReadReport", name);
            return okResult(sanitizeSeasonReport(await adapter.getReport()));
          }
          case "iocalc.get_log": {
            assertNoArgs(args);
            assertToolCapability(await getSafeCapabilities(adapter), "canReadState", name);
            return okResult(sanitizeSystemLog(await adapter.getLog()));
          }
          case "iocalc.get_match_history": {
            assertNoArgs(args);
            assertToolCapability(await getSafeCapabilities(adapter), "canReadState", name);
            return okResult(sanitizeMatchHistory(await adapter.getMatchHistory()));
          }
          case "iocalc.get_governance_ledger": {
            assertNoArgs(args);
            assertToolCapability(await getSafeCapabilities(adapter), "canReadState", name);
            if (!adapter.getGovernanceLedger) {
              return errorResult("Adapter does not expose a sandbox governance ledger.");
            }
            return okResult(sanitizeGovernanceLedger(await adapter.getGovernanceLedger()));
          }
          case "iocalc.run_agent_trial": {
            const input = parseRunAgentTrialInput(args);
            const capabilities = await getSafeCapabilities(adapter);
            assertToolCapability(capabilities, "canRunAgentTrial", name);
            if (!adapter.runAgentTrial) {
              return errorResult("Adapter does not support sandbox agent trials.");
            }
            return okResult(sanitizeAgentTrialResult(await adapter.runAgentTrial(input)));
          }
          /*
           * The default branch is unreachable after TOOL_NAMES validation, but
           * stays here so adding a new tool name cannot accidentally fall
           * through to an adapter method.
           */
          default:
            return errorResult("Unknown IOCALC MCP tool.");
        }
      } catch (error) {
        return errorResult(safeErrorMessage(error));
      }
    }
  };
}

async function getSafeCapabilities(adapter: IocalcPlayerAdapter): Promise<IocalcCapabilities> {
  const capabilities = await adapter.getCapabilities();
  assertSafeCapabilities(capabilities);
  return sanitizeCapabilities(capabilities);
}

function assertToolCapability(
  capabilities: IocalcCapabilities,
  capability: "canReadState" | "canSubmitGameCommand" | "canResolveSeason" | "canReadReport" | "canRunAgentTrial",
  toolName: string
): void {
  if (!capabilities[capability]) {
    throw new Error(`${toolName} is disabled by adapter capabilities.`);
  }
}

export function createIocalcHttpMcpToolBridge(options: HttpIocalcAdapterOptions): IocalcMcpToolBridge {
  return createIocalcMcpToolBridge(new HttpIocalcAdapter(sanitizeHttpAdapterOptions(options)));
}

export function createIocalcMcpServerScaffold(adapter: IocalcPlayerAdapter) {
  return {
    status: "sdk-adapter-ready",
    tools: IOCALC_MCP_TOOLS,
    bridge: createIocalcMcpToolBridge(adapter),
    note: "Wire this bridge to an MCP SDK transport or the opt-in stdio wrapper. Keep all tools sandbox-only."
  };
}

function sanitizeHttpAdapterOptions(options: HttpIocalcAdapterOptions): HttpIocalcAdapterOptions {
  const url = new URL(options.baseUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("MCP HTTP bridge baseUrl must use http or https.");
  }
  if (url.username || url.password) {
    throw new Error("MCP HTTP bridge baseUrl must not include credentials.");
  }
  if (url.search || url.hash) {
    throw new Error("MCP HTTP bridge baseUrl must not include query or hash values.");
  }
  const host = url.hostname.toLowerCase();
  const isLocal = LOCAL_HTTP_HOSTS.has(host);
  if (!isLocal && !OFFICIAL_HTTP_HOSTS.has(host)) {
    throw new Error("MCP HTTP bridge baseUrl must target localhost or an approved IOCALC host.");
  }
  if (!isLocal && url.protocol !== "https:") {
    throw new Error("MCP HTTP bridge baseUrl must use https for approved IOCALC hosts.");
  }
  if (url.pathname !== "/" && url.pathname !== "") {
    throw new Error("MCP HTTP bridge baseUrl must target the host root.");
  }
  const sandboxId = options.sandboxId === undefined ? undefined : optionalSandboxId({ sandboxId: options.sandboxId });
  return {
    ...options,
    baseUrl: url.toString().replace(/\/$/, ""),
    sandboxId
  };
}

function sanitizeCapabilities(capabilities: IocalcCapabilities): IocalcCapabilities {
  return {
    ...DEFAULT_SAFE_CAPABILITIES,
    canReadState: Boolean(capabilities.canReadState),
    canSubmitGameCommand: Boolean(capabilities.canSubmitGameCommand),
    canResolveSeason: Boolean(capabilities.canResolveSeason),
    canReadReport: Boolean(capabilities.canReadReport),
    canRunAgentTrial: Boolean(capabilities.canRunAgentTrial)
  };
}

function sanitizeGameApiManifest(manifest: IocalcGameApiManifest): IocalcGameApiManifest {
  assertSandboxGameApiManifest(manifest);
  return dropUndefined({
    project: "IOCALC",
    publicBrand: sanitizeManifestText(manifest.publicBrand) ?? "IOCALC: Agent Trials",
    mode: sanitizeManifestText(manifest.mode) ?? "Season Duel",
    description: sanitizeManifestText(manifest.description, 400) ?? "",
    version: sanitizeManifestText(manifest.version, 40) ?? "",
    protocol: dropUndefined({
      name: sanitizeManifestText(manifest.protocol.name) ?? "IOCALC Agent Env HTTP",
      compatibleWith: sanitizeManifestText(manifest.protocol.compatibleWith) ?? "iocalc-agent-env",
      agentEnvRepository: manifest.protocol.agentEnvRepository === "rivendale/iocalc-agent-env" ? manifest.protocol.agentEnvRepository : undefined,
      agentEnvCompatibilityCommit:
        typeof manifest.protocol.agentEnvCompatibilityCommit === "string" &&
        /^[a-f0-9]{40}$/i.test(manifest.protocol.agentEnvCompatibilityCommit)
          ? manifest.protocol.agentEnvCompatibilityCommit
          : undefined,
      stateScope: sanitizeManifestText(manifest.protocol.stateScope, 160) ?? "isolated in-memory server sandbox only",
      sandboxIdSupported: Boolean(manifest.protocol.sandboxIdSupported),
      sandboxIdIsAccountOrSession: false,
      maxInMemorySandboxes: sanitizeOptionalNumber(manifest.protocol.maxInMemorySandboxes),
      sandboxTtlSeconds: sanitizeOptionalNumber(manifest.protocol.sandboxTtlSeconds)
    }),
    routes: manifest.routes.map(sanitizeManifestRoute).filter((route): route is IocalcGameApiManifestRoute => Boolean(route)),
    responses: cloneManifestResponses(manifest.responses),
    commandRequest: cloneManifestRequestRecord(manifest.commandRequest, COMMAND_REQUEST_FIELD_KEYS),
    agentTrialRequest: cloneManifestRequestRecord(manifest.agentTrialRequest, AGENT_TRIAL_REQUEST_FIELD_KEYS),
    selectors: manifest.selectors
      ?.map((selector) => sanitizeManifestSelector(selector))
      .filter((selector): selector is string => Boolean(selector)),
    safeCapabilities: manifest.safeCapabilities.filter((capability) => SAFE_CAPABILITY_KEYS.has(capability)),
    blockedCapabilities: manifest.blockedCapabilities.filter((capability) =>
      DEFAULT_SAFE_CAPABILITIES[capability as keyof IocalcCapabilities] === false
    ),
    inputPolicy: {
      asciiOnly: Boolean(manifest.inputPolicy.asciiOnly),
      noLinks: Boolean(manifest.inputPolicy.noLinks),
      noCodeOrExecutableSchemes: Boolean(manifest.inputPolicy.noCodeOrExecutableSchemes),
      noSecrets: Boolean(manifest.inputPolicy.noSecrets),
      noWalletOrFinancialAuthority: Boolean(manifest.inputPolicy.noWalletOrFinancialAuthority),
      submittedTextIsUntrusted: Boolean(manifest.inputPolicy.submittedTextIsUntrusted),
      submittedTextIsExecuted: false,
      feedbackCanMutateGameplay: false
    },
    outOfScope: manifest.outOfScope?.map((item) => sanitizeManifestText(item, 120)).filter((item): item is string => Boolean(item))
  }) as unknown as IocalcGameApiManifest;
}

function cloneManifestResponses(
  responses: IocalcGameApiManifest["responses"] | undefined
): IocalcGameApiManifest["responses"] | undefined {
  if (!responses) return undefined;
  const output: Record<string, IocalcGameApiManifestResponseSpec> = {};
  for (const routeKey of Reflect.ownKeys(responses)) {
    if (typeof routeKey !== "string" || !SAFE_MANIFEST_ROUTES.has(routeKey)) continue;
    const spec = responses[routeKey];
    if (!spec || typeof spec !== "object") continue;
    const fields = sanitizeManifestResponseFields(spec.fields);
    if (fields.length === 0) continue;
    const cloned: IocalcGameApiManifestResponseSpec = { fields };
    const description = sanitizeManifestText(spec.description, 240);
    if (description) cloned.description = description;
    const optionalFields = sanitizeManifestResponseFields(spec.optionalFields);
    if (optionalFields && optionalFields.length > 0) cloned.optionalFields = optionalFields;
    output[routeKey] = cloned;
  }
  return Object.keys(output).length > 0 ? output : undefined;
}

function sanitizeManifestResponseFields(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const output: string[] = [];
  const seen = new Set<string>();
  for (const field of value.slice(0, 80)) {
    if (typeof field !== "string" || field.length < 1 || field.length > 80) continue;
    if (!SAFE_RESPONSE_FIELD_PATH.test(field) || hasUnsafeManifestText(field)) continue;
    if (field.split(".").some((segment) => PROTOTYPE_RESULT_KEYS.has(segment))) continue;
    if (seen.has(field)) continue;
    seen.add(field);
    output.push(field);
  }
  return output;
}

function cloneManifestRequestRecord(
  record: Record<string, unknown> | undefined,
  fieldKeys: readonly string[]
): Record<string, unknown> | undefined {
  if (!record || typeof record !== "object" || !record.fields || typeof record.fields !== "object" || Array.isArray(record.fields)) {
    return undefined;
  }
  const fields: Record<string, string> = {};
  const sourceFields = record.fields as Record<string, unknown>;
  for (const key of fieldKeys) {
    if (typeof sourceFields[key] === "string") {
      fields[key] = sourceFields[key];
    }
  }
  return dropUndefined({
    contentType: record.contentType === "application/json" ? "application/json" : undefined,
    fields,
    allowedCommandVocabulary:
      typeof record.allowedCommandVocabulary === "string" ? record.allowedCommandVocabulary : undefined,
    maxCommandChars: Number.isInteger(record.maxCommandChars) ? record.maxCommandChars : undefined
  });
}

function sanitizeManifestRoute(route: IocalcGameApiManifestRoute): IocalcGameApiManifestRoute | undefined {
  if (route.method !== "GET" && route.method !== "POST") return undefined;
  const routeKey = `${route.method} ${route.path}`;
  if (typeof route.path !== "string" || !SAFE_MANIFEST_ROUTES.has(routeKey)) return undefined;
  const sideEffects = MANIFEST_ROUTE_SIDE_EFFECTS.get(routeKey);
  if (!sideEffects || !SAFE_MANIFEST_SIDE_EFFECTS.has(route.sideEffects) || route.sideEffects !== sideEffects) return undefined;
  return dropUndefined({
    method: route.method,
    path: route.path,
    purpose: sanitizeManifestText(route.purpose, 240) ?? "",
    body: sanitizeManifestText(route.body, 80),
    query: route.query?.map((item) => sanitizeManifestText(item, 40)).filter((item): item is string => Boolean(item)),
    contentType: route.contentType === "application/json" ? "application/json" : undefined,
    maxBytes: sanitizeOptionalNumber(route.maxBytes),
    sideEffects
  }) as unknown as IocalcGameApiManifestRoute;
}

function sanitizeManifestSelector(selector: unknown): string | undefined {
  if (typeof selector !== "string") return undefined;
  return /^data-testid="[A-Za-z0-9_-]+"$/.test(selector) ? selector : undefined;
}

function sanitizeGameState(state: IocalcGameState): IocalcGameState {
  return dropUndefined({
    sandboxId: sanitizeOptionalSandboxValue(state.sandboxId),
    mode: state.mode === "agent_trials" ? "agent_trials" : "season_duel",
    season: sanitizeNumber(state.season, 0),
    seed: sanitizeShortText(state.seed),
    agents: state.agents?.map((agent) =>
      dropUndefined({
        canonicalAgentId: sanitizeAgentId(agent.canonicalAgentId),
        controllerType: sanitizeEnum(agent.controllerType, CONTROLLER_TYPES),
        capabilityScope: agent.capabilityScope?.filter((capability) => SAFE_CAPABILITY_KEYS.has(capability)),
        displayName: sanitizeShortText(agent.displayName),
        commandSource: sanitizeEnum(agent.commandSource, COMMAND_SOURCES),
        timeoutFallbackEvents: agent.timeoutFallbackEvents?.map((event) =>
          dropUndefined({
            season: sanitizeOptionalNumber(event.season),
            reason: sanitizeShortText(event.reason),
            at: sanitizeShortText(event.at)
          })
        ),
        reviewNotes: agent.reviewNotes?.map((note) => sanitizeShortText(note)).filter((note): note is string => Boolean(note))
      })
    ),
    settings: sanitizeRecord(state.settings),
    settingsSummary: sanitizeShortText(state.settingsSummary),
    settingEffects: sanitizeRecord(state.settingEffects),
    settlement: sanitizeRecord(state.settlement),
    resources: sanitizeNumberRecord(state.resources),
    risk: sanitizeNumberRecord(state.risk),
    visibleText: sanitizeVisibleText(state.visibleText)
  }) as unknown as IocalcGameState;
}

function sanitizeSubmitCommandResult(result: SubmitCommandResult): SubmitCommandResult {
  return dropUndefined({
    accepted: Boolean(result.accepted),
    command: sanitizeVisibleText(result.command) ?? "",
    sandboxId: sanitizeOptionalSandboxValue(result.sandboxId),
    rejectedReason: sanitizeVisibleText(result.rejectedReason),
    warnings: result.warnings?.map((warning) => sanitizeVisibleText(warning)).filter((warning): warning is string => Boolean(warning))
  }) as unknown as SubmitCommandResult;
}

function sanitizeSeasonResolution(result: SeasonResolution): SeasonResolution {
  return dropUndefined({
    resolved: Boolean(result.resolved),
    sandboxId: sanitizeOptionalSandboxValue(result.sandboxId),
    season: sanitizeNumber(result.season, 0),
    score: sanitizeOptionalNumber(result.score),
    changes: sanitizeRecord(result.changes),
    settings: sanitizeRecord(result.settings),
    settingsSummary: sanitizeShortText(result.settingsSummary),
    settingEffects: sanitizeRecord(result.settingEffects),
    visibleText: sanitizeVisibleText(result.visibleText)
  }) as unknown as SeasonResolution;
}

function sanitizeSeasonReport(report: IocalcSeasonReport): IocalcSeasonReport {
  return dropUndefined({
    sandboxId: sanitizeOptionalSandboxValue(report.sandboxId),
    text: sanitizeVisibleText(report.text) ?? "",
    settings: sanitizeRecord(report.settings),
    settingsSummary: sanitizeShortText(report.settingsSummary),
    settingEffects: sanitizeRecord(report.settingEffects),
    structured: sanitizeRecord(report.structured)
  }) as unknown as IocalcSeasonReport;
}

function sanitizeSystemLog(log: IocalcSystemLog): IocalcSystemLog {
  const entries = Array.isArray(log.entries) ? log.entries : [];
  return dropUndefined({
    sandboxId: sanitizeOptionalSandboxValue(log.sandboxId),
    entries: entries.map((entry) => sanitizeVisibleText(entry)).filter((entry): entry is string => Boolean(entry)),
    text: sanitizeVisibleText(log.text)
  }) as unknown as IocalcSystemLog;
}

function sanitizeMatchHistory(history: IocalcMatchHistory): IocalcMatchHistory {
  return dropUndefined({
    sandboxId: sanitizeOptionalSandboxValue(history.sandboxId),
    matches: history.matches.map((match) => sanitizeRecord(match)).filter((match): match is Record<string, unknown> => Boolean(match))
  }) as unknown as IocalcMatchHistory;
}

function sanitizeGovernanceLedger(ledger: IocalcAgentGovernanceLedger): IocalcAgentGovernanceLedger {
  assertAgentGovernanceLedger(ledger);
  return ledger;
}

function sanitizeAgentTrialResult(result: AgentTrialResult): AgentTrialResult {
  return dropUndefined({
    sandboxId: sanitizeOptionalSandboxValue(result.sandboxId),
    winner: sanitizeAgentId(result.winner),
    scorecard: sanitizeRecord(result.scorecard) ?? {},
    transcript: result.transcript
      ? {
          transport: sanitizeEnum(result.transcript.transport, TRANSPORTS) ?? "mcp",
          startedAt: sanitizeShortText(result.transcript.startedAt) ?? "",
          completedAt: sanitizeShortText(result.transcript.completedAt),
          events: result.transcript.events.map((event) =>
            dropUndefined({
              type: sanitizeEnum(event.type, TRANSCRIPT_EVENT_TYPES) ?? "error",
              at: sanitizeShortText(event.at) ?? "",
              data: sanitizeRecord(event.data)
            })
          )
        }
      : { transport: "mcp", startedAt: "", events: [] }
  }) as unknown as AgentTrialResult;
}

function okResult(payload: unknown): IocalcMcpToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2)
      }
    ],
    structuredContent: payload
  };
}

function errorResult(message: string): IocalcMcpToolResult {
  const safeMessage = sanitizeVisibleText(message, 400) ?? "MCP tool request was rejected inside the sandbox boundary.";
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: safeMessage
      }
    ],
    structuredContent: { error: safeMessage }
  };
}

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return sanitizeVisibleText(message) ?? "MCP tool request was rejected inside the sandbox boundary.";
}

function dropUndefined<T extends Record<string, unknown>>(record: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}

function sanitizeOptionalSandboxValue(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return undefined;
  if (!SANDBOX_ID_PATTERN.test(value) || SECRET_SANDBOX_PATTERN.test(value)) return undefined;
  return value;
}

function sanitizeAgentId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!CANONICAL_AGENT_ID_PATTERN.test(trimmed)) return undefined;
  return trimmed;
}

function sanitizeEnum(value: unknown, allowed: Set<string>): string | undefined {
  if (typeof value !== "string") return undefined;
  return allowed.has(value) ? value : undefined;
}

function sanitizeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function sanitizeOptionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function sanitizeVisibleText(value: unknown, maxLength = 4000): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().replace(/\r\n/g, "\n");
  if (!trimmed) return undefined;
  return redactSensitiveText(trimmed.slice(0, maxLength));
}

function sanitizeShortText(value: unknown): string | undefined {
  return sanitizeVisibleText(value, MAX_MCP_SHORT_TEXT_LENGTH);
}

function sanitizeManifestText(value: unknown, maxLength = 160): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, maxLength);
  if (!/^[A-Za-z0-9 .,:;!?'"()_\/&+-]+$/.test(trimmed)) return undefined;
  if (redactSensitiveText(trimmed) !== trimmed || hasUnsafeManifestText(trimmed)) return undefined;
  return trimmed;
}

function hasUnsafeManifestText(value: string): boolean {
  const compact = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return UNSAFE_MANIFEST_COMPACT_TERMS.some((term) => compact.includes(term));
}

function redactSensitiveText(value: string): string {
  return value
    .replace(/\bsandboxId=([^&\s]+)/gi, "sandboxId=[REDACTED]")
    .replace(/\bhttps?:\/\/\S+/gi, "[URL_REDACTED]")
    .replace(/\b(?:api[_ -]?key|private[_ -]?key|password|mnemonic|seed phrase|bearer token|auth token|refresh token|oauth token)\b\s*[:=]\s*\S+/gi, "[REDACTED]")
    .replace(FORBIDDEN_MCP_TEXT_GLOBAL, "[REDACTED]");
}

function sanitizeNumberRecord(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const output: Record<string, number> = {};
  for (const [key, item] of Object.entries(value)) {
    const sanitizedKey = sanitizeRecordKey(key);
    if (!sanitizedKey || typeof item !== "number" || !Number.isFinite(item)) continue;
    output[sanitizedKey] = item;
  }
  return Object.keys(output).length > 0 ? output : undefined;
}

function sanitizeRecord(value: unknown, depth = 0): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value) || depth > 3) return undefined;
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    const sanitizedKey = sanitizeRecordKey(key);
    if (!sanitizedKey) continue;
    const sanitizedValue = sanitizeRecordValue(item, depth + 1);
    if (sanitizedValue !== undefined) {
      output[sanitizedKey] = sanitizedValue;
    }
  }
  return Object.keys(output).length > 0 ? output : undefined;
}

function sanitizeRecordKey(key: string): string | undefined {
  if (!/^[A-Za-z0-9_.-]{1,80}$/.test(key)) return undefined;
  if (PROTOTYPE_RESULT_KEYS.has(key)) return undefined;
  if (SENSITIVE_RESULT_KEY.test(key) || hasUnsafeManifestText(key)) return undefined;
  return key;
}

function sanitizeRecordValue(value: unknown, depth: number): unknown {
  if (value === null) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") return sanitizeVisibleText(value, 1000);
  if (Array.isArray(value)) {
    const array = value
      .slice(0, 50)
      .map((item) => sanitizeRecordValue(item, depth + 1))
      .filter((item) => item !== undefined);
    return array.length > 0 ? array : undefined;
  }
  return sanitizeRecord(value, depth);
}

function assertNoArgs(args: unknown): void {
  const record = optionalRecord(args);
  if (Object.keys(record).length > 0) {
    throw new Error("This IOCALC MCP tool does not accept arguments.");
  }
}

function optionalRecord(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("MCP tool arguments must be an object.");
  }
  return value as Record<string, unknown>;
}

function requiredString(record: Record<string, unknown>, field: string, maxLength = 1200): string {
  const value = record[field];
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string.`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} must not be empty.`);
  }
  if (trimmed.length > maxLength) {
    throw new Error(`${field} exceeds ${maxLength} characters.`);
  }
  if (FORBIDDEN_MCP_TEXT.test(trimmed)) {
    throw new Error(`${field} contains forbidden wallet, secret, account, production, deployment, or financial terms.`);
  }
  return trimmed;
}

function requiredAgentId(record: Record<string, unknown>, field: string): string {
  const value = requiredString(record, field, 64);
  if (!CANONICAL_AGENT_ID_PATTERN.test(value)) {
    throw new Error(`${field} must be a canonical IOCALC agent ID.`);
  }
  return value;
}

function optionalString(record: Record<string, unknown>, field: string, maxLength = 1200): string | undefined {
  if (!(field in record) || record[field] === undefined) return undefined;
  return requiredString(record, field, maxLength);
}

function optionalSandboxId(record: Record<string, unknown>): string | undefined {
  const sandboxId = optionalString(record, "sandboxId", 80);
  if (sandboxId === undefined) return undefined;
  if (!SANDBOX_ID_PATTERN.test(sandboxId) || SECRET_SANDBOX_PATTERN.test(sandboxId)) {
    throw new Error("sandboxId must be a non-secret ASCII sandbox partition key.");
  }
  return sandboxId;
}

function parseMode(value: unknown): IocalcMode {
  if (value === "season_duel" || value === "agent_trials") return value;
  throw new Error("mode must be season_duel or agent_trials.");
}

function assertAllowedFields(record: Record<string, unknown>, fields: string[]): void {
  const allowed = new Set(fields);
  for (const field of Object.keys(record)) {
    if (!allowed.has(field)) {
      throw new Error("Unexpected MCP tool argument.");
    }
  }
}

function parseSubmitCommandInput(args: unknown): SubmitCommandInput {
  const record = optionalRecord(args);
  assertAllowedFields(record, ["mode", "command", "agentName", "sandboxId", "seed"]);
  const normalized = normalizeGameCommand(requiredString(record, "command"));
  if (!normalized.accepted || normalized.warnings.length > 0) {
    throw new Error(normalized.rejectedReason ?? "Command contains link-like, code-like, or secret-like text.");
  }
  return {
    mode: parseMode(record.mode),
    command: normalized.command,
    agentName: optionalString(record, "agentName", 120),
    sandboxId: optionalSandboxId(record),
    seed: optionalString(record, "seed", 120)
  };
}

function parseResolveSeasonInput(args: unknown): ResolveSeasonInput {
  const record = optionalRecord(args);
  assertAllowedFields(record, ["sandboxId", "seed"]);
  return {
    sandboxId: optionalSandboxId(record),
    seed: optionalString(record, "seed", 120)
  };
}

function parseRunAgentTrialInput(args: unknown): RunAgentTrialInput {
  const record = optionalRecord(args);
  assertAllowedFields(record, ["agentA", "agentB", "seasons", "sandboxId", "seed"]);
  const seasons = record.seasons;
  if (!Number.isInteger(seasons) || (seasons as number) < 1 || (seasons as number) > 100) {
    throw new Error("seasons must be an integer from 1 to 100.");
  }
  return {
    agentA: requiredAgentId(record, "agentA"),
    agentB: requiredAgentId(record, "agentB"),
    seasons: seasons as number,
    sandboxId: optionalSandboxId(record),
    seed: optionalString(record, "seed", 120)
  };
}
