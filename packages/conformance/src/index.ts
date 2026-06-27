import {
  assertAgentGovernanceLedger,
  assertSafeCapabilities,
  assertSandboxGameApiManifest,
  assertSandboxAuditEvent,
  assertSandboxBoundaryDecision,
  normalizeGameCommand,
  type IocalcAgentGovernanceLedger,
  type IocalcAuditEvent,
  type IocalcBoundaryDecision,
  type IocalcGameApiManifest,
  type IocalcPlayerAdapter,
  type ResolveSeasonInput,
  type RunAgentTrialInput,
  type SubmitCommandInput
} from "@iocalc/protocol";

export interface ConformanceResult {
  name: string;
  passed: boolean;
  message?: string;
}

type ConformanceErrorScope = "default" | "browser";

export interface BrowserPlayConformanceOptions {
  command?: string;
}

type ResponseContractRoute = "GET /api/game/state" | "POST /api/game/resolve" | "GET /api/game/report";
type ResponseContractPayloads = Partial<Record<ResponseContractRoute, unknown>>;

interface ResponseContractConformanceOptions {
  observedPayloads?: ResponseContractPayloads;
  skipUnobserved?: boolean;
}

function checkBoundary(name: string, boundary: unknown): ConformanceResult {
  try {
    assertSandboxBoundaryDecision(boundary as IocalcBoundaryDecision);
    return { name, passed: true };
  } catch (error) {
    return {
      name,
      passed: false,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

function checkAuditEvent(name: string, event: unknown): ConformanceResult {
  try {
    assertSandboxAuditEvent(event as IocalcAuditEvent);
    return { name, passed: true };
  } catch (error) {
    return {
      name,
      passed: false,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

export function runAgentGovernanceLedgerConformance(ledger: IocalcAgentGovernanceLedger): ConformanceResult[] {
  const results: ConformanceResult[] = [];

  try {
    assertAgentGovernanceLedger(ledger);
    results.push({ name: "agent-governance-ledger", passed: true });
  } catch (error) {
    return [
      {
        name: "agent-governance-ledger",
        passed: false,
        message: error instanceof Error ? error.message : String(error)
      }
    ];
  }

  const unsafeText = JSON.stringify(ledger).toLowerCase();
  const unsafeNeedles = [
    "api_key",
    "private_key",
    "seed phrase",
    "mnemonic",
    "password",
    "hunter2",
    "https://wallet.invalid",
    "ftp://",
    "javascript:",
    "wallet.invalid"
  ];
  const reflected = unsafeNeedles.some((needle) => unsafeText.includes(needle));
  results.push({
    name: "agent-governance-no-unsafe-reflection",
    passed: !reflected,
    message: reflected ? "Agent governance ledger reflected unsafe caller-controlled text." : undefined
  });

  const unsafeScope = ledger.sessions.some(
    (session) =>
      session.policy.sandboxOnly !== true ||
      session.policy.noWalletAuthority !== true ||
      session.policy.noSecretsAccess !== true ||
      session.policy.noProductionMutation !== true ||
      session.policy.noExternalUrlFetch !== true ||
      session.policy.noCodeExecution !== true ||
      session.policy.noFeedbackTrustMutation !== true ||
      session.policy.noFinancialFunctionality !== true
  );
  results.push({
    name: "agent-governance-sandbox-policy",
    passed: !unsafeScope,
    message: unsafeScope ? "Agent governance session policy expanded beyond sandbox authority." : undefined
  });

  const nonSandboxBoundary = ledger.entries.some(
    (entry) => entry.boundary.sandboxOnly !== true || entry.boundary.policy !== "sandbox-gameplay-only"
  );
  results.push({
    name: "agent-governance-boundaries",
    passed: !nonSandboxBoundary,
    message: nonSandboxBoundary ? "Agent governance entry contains non-sandbox boundary metadata." : undefined
  });

  return results;
}

function boundaryResults(name: string, payload: unknown): ConformanceResult[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const results: ConformanceResult[] = [];
  const boundary = readOwnDataProperty(payload, "boundary");
  const audit = readOwnDataProperty(payload, "audit");

  if (boundary.unsafe) {
    results.push({ name: `${name}-boundary`, passed: false, message: "Unsafe payload boundary property." });
  } else if (boundary.present) {
    results.push(checkBoundary(`${name}-boundary`, boundary.value));
  }

  if (audit.unsafe) {
    results.push({ name: `${name}-audit`, passed: false, message: "Unsafe payload audit property." });
  } else if (audit.present) {
    const audits = Array.isArray(audit.value) ? audit.value : [audit.value];
    audits.forEach((audit, index) => {
      results.push(checkAuditEvent(`${name}-audit-${index}`, audit));
    });
  }

  return results;
}

function readOwnDataProperty(payload: object, key: string): { present: boolean; unsafe: boolean; value?: unknown } {
  const descriptor = Object.getOwnPropertyDescriptor(payload, key);
  if (!descriptor) {
    return { present: false, unsafe: false };
  }
  if (!("value" in descriptor)) {
    return { present: true, unsafe: true };
  }
  return { present: true, unsafe: false, value: descriptor.value };
}

function conformanceErrorMessage(error: unknown, scope: ConformanceErrorScope = "default"): string {
  if (scope === "browser") {
    return "Browser conformance operation failed.";
  }
  return error instanceof Error ? error.message : String(error);
}

export async function runSafetyConformance(adapter: IocalcPlayerAdapter): Promise<ConformanceResult[]> {
  const results: ConformanceResult[] = [];

  try {
    const capabilities = await adapter.getCapabilities();
    assertSafeCapabilities(capabilities);
    results.push({ name: "safe-capabilities", passed: true });
    results.push(...boundaryResults("capabilities", capabilities));
  } catch (error) {
    results.push({
      name: "safe-capabilities",
      passed: false,
      message: error instanceof Error ? error.message : String(error)
    });
  }

  return results;
}

export async function runManifestConformance(adapter: IocalcPlayerAdapter): Promise<ConformanceResult[]> {
  if (!adapter.getManifest) {
    return [];
  }

  try {
    const manifest = await adapter.getManifest();
    assertSandboxGameApiManifest(manifest);
    return [
      {
        name: "game-api-manifest",
        passed: true
      },
      ...boundaryResults("game-api-manifest", manifest)
    ];
  } catch (error) {
    return [
      {
        name: "game-api-manifest",
        passed: false,
        message: error instanceof Error ? error.message : String(error)
      }
    ];
  }
}

export async function runReadConformance(
  adapter: IocalcPlayerAdapter,
  observedPayloads?: ResponseContractPayloads
): Promise<ConformanceResult[]> {
  const checks: Array<[string, ResponseContractRoute | undefined, () => Promise<unknown>]> = [
    ["get-state", "GET /api/game/state", () => adapter.getState()],
    ["get-report", "GET /api/game/report", () => adapter.getReport()],
    ["get-log", undefined, () => adapter.getLog()],
    ["get-match-history", undefined, () => adapter.getMatchHistory()]
  ];

  const results: ConformanceResult[] = [];
  for (const [name, route, check] of checks) {
    try {
      const payload = await check();
      if (route && observedPayloads) {
        observedPayloads[route] = payload;
      }
      results.push({ name, passed: true });
      results.push(...boundaryResults(name, payload));
    } catch (error) {
      results.push({ name, passed: false, message: error instanceof Error ? error.message : String(error) });
    }
  }
  return results;
}

export async function runResponseContractConformance(
  adapter: IocalcPlayerAdapter,
  options: ResponseContractConformanceOptions = {}
): Promise<ConformanceResult[]> {
  if (!adapter.getManifest) {
    return [];
  }

  let manifest: IocalcGameApiManifest;
  try {
    manifest = await adapter.getManifest();
    assertSandboxGameApiManifest(manifest);
  } catch (error) {
    return [
      {
        name: "response-contract-manifest",
        passed: false,
        message: error instanceof Error ? error.message : String(error)
      }
    ];
  }

  const responses = snapshotManifestResponses(manifest);
  if (responses === undefined) {
    return [];
  }
  if (responses === null) {
    return [
      {
        name: "response-contract-manifest",
        passed: false,
        message: "Unsafe response contract map."
      }
    ];
  }

  const checks: Array<[ResponseContractRoute, string, () => Promise<unknown>]> = [
    ["GET /api/game/state", "response-contract-state", () => adapter.getState()],
    ["POST /api/game/resolve", "response-contract-resolve", () => adapter.resolveSeason({ seed: "response-contract-seed" })],
    ["GET /api/game/report", "response-contract-report", () => adapter.getReport()]
  ];
  const results: ConformanceResult[] = [];

  for (const [route, name, read] of checks) {
    const fields = snapshotRequiredResponseFields(responses, route);
    if (fields === undefined) continue;
    if (fields === null) {
      results.push({
        name,
        passed: false,
        message: "Unsafe response contract spec."
      });
      continue;
    }
    try {
      const hasObservedPayload = Object.prototype.hasOwnProperty.call(options.observedPayloads ?? {}, route);
      if (!hasObservedPayload && options.skipUnobserved) {
        continue;
      }
      const payload = hasObservedPayload ? options.observedPayloads?.[route] : await read();
      const missing = fields.filter((field) => !hasOwnPath(payload, field));
      results.push({
        name,
        passed: missing.length === 0,
        message: missing.length === 0 ? undefined : `Missing required response fields: ${missing.join(", ")}`
      });
    } catch (error) {
      results.push({ name, passed: false, message: error instanceof Error ? error.message : String(error) });
    }
  }

  return results;
}

function snapshotManifestResponses(manifest: IocalcGameApiManifest): Record<string, unknown> | undefined | null {
  const descriptor = Object.getOwnPropertyDescriptor(manifest, "responses");
  if (!descriptor) {
    return undefined;
  }
  if (!("value" in descriptor)) {
    return null;
  }
  if (descriptor.value === undefined) {
    return undefined;
  }
  if (!descriptor.value || typeof descriptor.value !== "object" || Array.isArray(descriptor.value)) {
    return null;
  }
  return descriptor.value as Record<string, unknown>;
}

function snapshotRequiredResponseFields(responses: Record<string, unknown>, route: string): string[] | undefined | null {
  if (!Object.prototype.hasOwnProperty.call(responses, route)) {
    return undefined;
  }
  const responseDescriptor = Object.getOwnPropertyDescriptor(responses, route);
  if (!responseDescriptor || !("value" in responseDescriptor)) {
    return null;
  }
  const spec = responseDescriptor.value;
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
    return null;
  }
  const fieldsDescriptor = Object.getOwnPropertyDescriptor(spec, "fields");
  if (!fieldsDescriptor || !("value" in fieldsDescriptor)) {
    return null;
  }
  return snapshotStringArray(fieldsDescriptor.value);
}

function snapshotStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const fields: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !("value" in descriptor) || typeof descriptor.value !== "string") {
      return null;
    }
    fields.push(descriptor.value);
  }
  return fields;
}

function hasOwnPath(payload: unknown, path: string): boolean {
  let current = payload;
  const parts = path.split(".");
  for (let index = 0; index < parts.length; index += 1) {
    if (!current || typeof current !== "object") {
      return false;
    }
    const descriptor = Object.getOwnPropertyDescriptor(current, parts[index]);
    if (!descriptor || !("value" in descriptor)) {
      return false;
    }
    if (index === parts.length - 1) {
      return descriptor.value !== undefined;
    }
    current = descriptor.value;
  }
  return true;
}

export function runCommandValidationConformance(): ConformanceResult[] {
  const empty = normalizeGameCommand("   ");
  const safe = normalizeGameCommand(" repair wall and gather wood ");
  const link = normalizeGameCommand("review https://example.invalid but do not fetch it");

  return [
    {
      name: "reject-empty-command",
      passed: !empty.accepted,
      message: empty.accepted ? "Empty command was accepted." : undefined
    },
    {
      name: "normalize-safe-command",
      passed: safe.accepted && safe.command === "repair wall and gather wood",
      message: safe.accepted ? undefined : safe.rejectedReason
    },
    {
      name: "link-text-warning",
      passed: link.accepted && link.warnings.some((warning) => warning.includes("must not fetch")),
      message: "Commands with links must remain inert text."
    }
  ];
}

export async function runSubmitCommandConformance(
  adapter: IocalcPlayerAdapter,
  input: SubmitCommandInput = {
    mode: "season_duel",
    command: "repair wall and gather wood",
    seed: "conformance-seed"
  }
): Promise<ConformanceResult[]> {
  try {
    const result = await adapter.submitCommand(input);
    const commandDoesNotClaimWalletAccess = !/\b(wallet|transaction|private key|seed phrase)\b/i.test(result.command);
    return [
      {
        name: "submit-sandbox-command",
        passed: result.accepted && commandDoesNotClaimWalletAccess,
        message: result.accepted ? undefined : result.rejectedReason
      },
      ...boundaryResults("submit-command", result)
    ];
  } catch (error) {
    return [
      {
        name: "submit-sandbox-command",
        passed: false,
        message: error instanceof Error ? error.message : String(error)
      }
    ];
  }
}

export async function runResolveSeasonConformance(
  adapter: IocalcPlayerAdapter,
  input: ResolveSeasonInput = {
    seed: "conformance-seed"
  },
  observedPayloads?: ResponseContractPayloads
): Promise<ConformanceResult[]> {
  try {
    const result = await adapter.resolveSeason(input);
    if (observedPayloads) {
      observedPayloads["POST /api/game/resolve"] = result;
    }
    return [
      {
        name: "resolve-season",
        passed: result.resolved === true,
        message: result.resolved ? undefined : "Season did not resolve."
      },
      ...boundaryResults("resolve-season", result)
    ];
  } catch (error) {
    return [
      {
        name: "resolve-season",
        passed: false,
        message: error instanceof Error ? error.message : String(error)
      }
    ];
  }
}

export async function runAgentTrialConformance(
  adapter: IocalcPlayerAdapter,
  input: RunAgentTrialInput = {
    agentA: "iocalc-agent-0001",
    agentB: "iocalc-runner-0001",
    seasons: 1,
    seed: "conformance-trial"
  }
): Promise<ConformanceResult[]> {
  if (!adapter.runAgentTrial) {
    return [];
  }
  try {
    const result = await adapter.runAgentTrial(input);
    return [
      {
        name: "agent-trial",
        passed: Boolean(result.scorecard) && Boolean(result.transcript),
        message: result.scorecard && result.transcript ? undefined : "Agent trial result is missing scorecard or transcript."
      },
      ...boundaryResults("agent-trial", result)
    ];
  } catch (error) {
    return [
      {
        name: "agent-trial",
        passed: false,
        message: error instanceof Error ? error.message : String(error)
      }
    ];
  }
}

export async function runBrowserPlayConformance(
  adapter: IocalcPlayerAdapter,
  options: BrowserPlayConformanceOptions = {}
): Promise<ConformanceResult[]> {
  const command = options.command ?? "repair wall and gather wood";
  const results: ConformanceResult[] = [];

  if (adapter.transport !== "browser") {
    return [
      {
        name: "browser-transport",
        passed: false,
        message: "Browser play conformance requires a browser transport adapter."
      }
    ];
  }

  try {
    const capabilities = await adapter.getCapabilities();
    assertSafeCapabilities(capabilities);
    results.push({
      name: "browser-safe-capabilities",
      passed: capabilities.canRunAgentTrial === false,
      message: capabilities.canRunAgentTrial ? "Browser adapter must not expose agent trial execution through the UI." : undefined
    });
    results.push(...boundaryResults("browser-capabilities", capabilities));
  } catch (error) {
    results.push({
      name: "browser-safe-capabilities",
      passed: false,
      message: conformanceErrorMessage(error, "browser")
    });
  }

  try {
    const state = await adapter.getState();
    results.push({
      name: "browser-read-state",
      passed: state.mode === "season_duel" && Number.isFinite(state.season),
      message: state.mode === "season_duel" ? undefined : "Browser state did not expose Season Duel mode."
    });
    results.push(...boundaryResults("browser-state", state));
    const walletOutOfScope = browserPayloadKeepsWalletOutOfScope(state);
    results.push({
      name: "browser-wallet-out-of-scope",
      passed: walletOutOfScope,
      message: walletOutOfScope ? undefined : "Browser adapter must not expose Wallet Lab or wallet actions through gameplay selectors."
    });
  } catch (error) {
    results.push({
      name: "browser-read-state",
      passed: false,
      message: conformanceErrorMessage(error, "browser")
    });
  }

  try {
    const submitted = await adapter.submitCommand({ mode: "season_duel", command });
    results.push({
      name: "browser-submit-command",
      passed: submitted.accepted === true && submitted.command === command,
      message: submitted.accepted ? undefined : "Browser command was rejected."
    });
    results.push(...boundaryResults("browser-submit-command", submitted));
  } catch (error) {
    results.push({
      name: "browser-submit-command",
      passed: false,
      message: conformanceErrorMessage(error, "browser")
    });
  }

  try {
    const resolved = await adapter.resolveSeason({});
    results.push({
      name: "browser-resolve-season",
      passed: resolved.resolved === true,
      message: resolved.resolved ? undefined : "Browser season did not resolve."
    });
    results.push(...boundaryResults("browser-resolve-season", resolved));
  } catch (error) {
    results.push({
      name: "browser-resolve-season",
      passed: false,
      message: conformanceErrorMessage(error, "browser")
    });
  }

  try {
    const report = await adapter.getReport();
    results.push({
      name: "browser-read-report",
      passed: typeof report.text === "string" && report.text.length > 0,
      message: report.text ? undefined : "Browser report text was empty."
    });
    results.push(...boundaryResults("browser-report", report));
  } catch (error) {
    results.push({ name: "browser-read-report", passed: false, message: conformanceErrorMessage(error, "browser") });
  }

  try {
    const log = await adapter.getLog();
    results.push({
      name: "browser-read-log",
      passed: Array.isArray(log.entries),
      message: Array.isArray(log.entries) ? undefined : "Browser log entries were not an array."
    });
    results.push(...boundaryResults("browser-log", log));
  } catch (error) {
    results.push({ name: "browser-read-log", passed: false, message: conformanceErrorMessage(error, "browser") });
  }

  try {
    const history = await adapter.getMatchHistory();
    results.push({
      name: "browser-read-match-history",
      passed: Array.isArray(history.matches),
      message: Array.isArray(history.matches) ? undefined : "Browser match history was not an array."
    });
    results.push(...boundaryResults("browser-match-history", history));
  } catch (error) {
    results.push({
      name: "browser-read-match-history",
      passed: false,
      message: conformanceErrorMessage(error, "browser")
    });
  }

  return results;
}

function browserPayloadKeepsWalletOutOfScope(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const raw = readOwnDataProperty(payload, "raw");
  if (!raw.present || raw.unsafe) return false;
  const rawValue = raw.value;
  if (!rawValue || typeof rawValue !== "object") return false;

  for (const forbiddenFlag of [
    "walletActionsEnabled",
    "feedbackCanMutateGameplay",
    "externalUrlFetchEnabled",
    "codeExecutionEnabled",
    "secretsAccessEnabled",
    "productionMutationEnabled"
  ]) {
    const flag = readOwnDataProperty(rawValue, forbiddenFlag);
    if (!flag.present || flag.unsafe || flag.value !== false) {
      return false;
    }
  }

  const selectors = readOwnDataProperty(rawValue, "selectors");
  if (!selectors.present || selectors.unsafe) return false;
  if (!selectors.value || typeof selectors.value !== "object") return false;
  let selectorCount = 0;
  for (const selectorKey of Reflect.ownKeys(selectors.value)) {
    if (typeof selectorKey !== "string") return false;
    if (/wallet|feedback|recommend|api\/game|http|javascript/i.test(selectorKey)) return false;
    const selector = readOwnDataProperty(selectors.value, selectorKey);
    if (selector.unsafe || typeof selector.value !== "string" || /wallet|feedback|recommend|api\/game|http|javascript/i.test(selector.value)) {
      return false;
    }
    selectorCount += 1;
  }
  return selectorCount > 0;
}

function aggregateResolveInput(adapter: IocalcPlayerAdapter): ResolveSeasonInput | undefined {
  return adapter.transport === "browser" ? {} : undefined;
}

function aggregateSubmitInput(adapter: IocalcPlayerAdapter): SubmitCommandInput | undefined {
  if (adapter.transport === "browser") {
    return {
      mode: "season_duel",
      command: "repair wall and gather wood"
    };
  }
  return undefined;
}

async function aggregateAgentTrialConformance(adapter: IocalcPlayerAdapter): Promise<ConformanceResult[]> {
  if (adapter.transport === "browser") {
    return [];
  }
  return runAgentTrialConformance(adapter);
}

export async function runAdapterConformance(adapter: IocalcPlayerAdapter): Promise<ConformanceResult[]> {
  const observedPayloads: ResponseContractPayloads = {};
  return [
    ...(await runManifestConformance(adapter)),
    ...(await runSafetyConformance(adapter)),
    ...runCommandValidationConformance(),
    ...(await runReadConformance(adapter, observedPayloads)),
    ...(await runSubmitCommandConformance(adapter, aggregateSubmitInput(adapter))),
    ...(await runResolveSeasonConformance(adapter, aggregateResolveInput(adapter), observedPayloads)),
    ...(await aggregateAgentTrialConformance(adapter)),
    ...(await runResponseContractConformance(adapter, { observedPayloads, skipUnobserved: true }))
  ];
}
