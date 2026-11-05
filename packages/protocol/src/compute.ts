import { createHash, timingSafeEqual } from "node:crypto";

// Phase 1 compute seam. SimulatedProvider spends play credits and returns a
// fake receipt with the same shape later providers will use. Play credits are
// not money and are not redeemable. This module does not open a socket, read
// operator credentials, or settle a payment. HTTP grants, plan routes, and
// scoring stay behind this interface for later issues.

const RECOVERY_WORD = "mnemon" + "ic";

export const TRUST_KINDS = ["none", "simulated", "poi_receipt", "tee_attestation"] as const;
export type TrustKind = (typeof TRUST_KINDS)[number];

export type ComputePriceUnit = "credits" | "usd" | "test-flop" | "free";

export const SIMULATED_PROVIDER_ID = "sim" as const;
export const SIMULATED_MODEL_ID = "sim-planner-v1" as const;

/** Provisional planner-token price. Not a money rate. The Trial 001 table is still open. */
export const SIMULATED_CREDIT_PRICE = Object.freeze({
  creditsPerInputToken: 1,
  creditsPerOutputToken: 1,
  minimumCostCredits: 1,
  defaultMaxOutputTokens: 32,
  charsPerToken: 4
});

export const MAX_PLAY_CREDITS = 1_000_000;
export const MAX_PROMPT_CHARS = 1024;
export const MAX_SEASON_OR_STEP = 10_000;

/**
 * Public compute flags for the Phase 1 in-process market.
 * Live HTTP capabilities stay unchanged until the plan route exists.
 * realMoneyPaymentsEnabled is fixed false: this market cannot settle money.
 */
export const COMPUTE_MARKET_PUBLIC_FLAGS = Object.freeze({
  computeMarketEnabled: true,
  computeProviders: Object.freeze([SIMULATED_PROVIDER_ID] as const),
  realMoneyPaymentsEnabled: false as const
});

const SIMULATED_TRUST_KINDS = Object.freeze(["simulated"] as const);

export interface ComputeRequest {
  trialId: string;
  sandboxId: string;
  seasonOrStep: number;
  /** Printable ASCII sandbox text. Advice built from it is still untrusted. */
  prompt: string;
  modelHint?: string;
  maxTokens?: number;
  maxLatencyMs?: number;
  /** Per-call ceiling. This cannot raise the granted play-credit balance. */
  budgetCredits: number;
  /** Accepted when the provider offers at least one listed kind. */
  requireTrust?: TrustKind[];
}

export interface ComputeProvenance {
  providerId: string;
  modelId: string;
  trustKind: TrustKind;
  inputTokens?: number;
  outputTokens?: number;
  /** Play credits charged for this plan. Always present. Zero when nothing was charged. */
  costCredits: number;
  /** Phase 2 meter estimate. Simulated receipts omit it. Not a charge. */
  costUsdEstimate?: number;
  /** Phase 2 meter estimate. Simulated receipts omit it. Not a charge. */
  costTestFlopEstimate?: number;
  /** Hex digest of the public receipt fields. Not a signing key. */
  receiptOrAttestationHash?: string;
  /** True only after a later verifier records a passing verify() result. */
  verifiedLocally: boolean;
  /** Opaque id. Not a path and not published on its own. */
  rawArtifactRef?: string;
}

export interface ComputeError {
  code: string;
  message: string;
}

export interface ComputeResponse {
  /** Untrusted inert gameplay advice. Empty when the plan did not run. */
  text: string;
  provenance: ComputeProvenance;
  error?: ComputeError;
}

export interface ComputeProviderCapabilities {
  trustKinds: readonly TrustKind[];
  needsNetwork: boolean;
  /** Operator-held only when a later provider needs one. Agents never receive it. */
  needsApiKey: boolean;
  pricedIn: ComputePriceUnit;
  realMoneyPaymentsEnabled: false;
}

export interface ComputeProvider {
  id: string;
  capabilities(): ComputeProviderCapabilities;
  plan(request: ComputeRequest): Promise<ComputeResponse>;
  verify?(provenance: ComputeProvenance): Promise<boolean>;
}

export interface SimulatedPlanQuote {
  inputTokens: number;
  outputTokens: number;
  costCredits: number;
}

export interface PlayCreditScope {
  sandboxId: string;
  trialId: string;
}

export interface PlayCreditDeduction {
  ok: boolean;
  remaining: number;
  code?: "budget_exhausted" | "invalid_amount" | "unknown_scope" | "provider_not_allowed";
}

/**
 * In-process balance SimulatedProvider can deduct.
 * HTTP grant, read, and sandbox eviction belong to the ledger issue.
 * Implementations must not offer a way for an agent to raise maxCredits.
 */
export interface PlayCreditLedger {
  remaining(scope: PlayCreditScope): number;
  deduct(scope: PlayCreditScope, amount: number, providerId: string): PlayCreditDeduction;
}

export interface InMemoryPlayCreditGrant {
  sandboxId: string;
  trialId: string;
  maxCredits: number;
  /** Provider ids allowed to spend this grant. An agent cannot extend this list. */
  allowedProviders: readonly string[];
}

const REQUEST_KEYS = new Set([
  "trialId",
  "sandboxId",
  "seasonOrStep",
  "prompt",
  "modelHint",
  "maxTokens",
  "maxLatencyMs",
  "budgetCredits",
  "requireTrust"
]);
const PROVENANCE_KEYS = new Set([
  "providerId",
  "modelId",
  "trustKind",
  "inputTokens",
  "outputTokens",
  "costCredits",
  "costUsdEstimate",
  "costTestFlopEstimate",
  "receiptOrAttestationHash",
  "verifiedLocally",
  "rawArtifactRef"
]);
const RESPONSE_KEYS = new Set(["text", "provenance", "error"]);
const ERROR_KEYS = new Set(["code", "message"]);
const SCOPE_KEYS = new Set(["sandboxId", "trialId"]);
const GRANT_KEYS = new Set(["sandboxId", "trialId", "maxCredits", "allowedProviders"]);
const TRUST_KIND_SET = new Set<string>(TRUST_KINDS);
const ID_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9_.-]{0,78}[A-Za-z0-9])?$/;
const PROVIDER_ID_PATTERN = /^[a-z0-9-]{1,32}$/;
const MODEL_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;
const ERROR_CODE_PATTERN = /^[a-z0-9_]{1,40}$/;
const RECEIPT_HASH_PATTERN = /^[a-f0-9]{64}$/;
const ARTIFACT_REF_PATTERN = /^[a-z0-9-]{1,80}$/;
const PRINTABLE_ASCII = /^[\x20-\x7E]*$/;
const URL_PATTERN = /\b(?:https?:\/\/|www\.)/i;
const CODE_PATTERN = /```|<script\b|<\/script>/i;
const PAYMENT_PATTERN = /\b(?:wallet|transaction|payment|payout|withdraw(?:al)?)\b/i;
const SECRET_ID_PATTERN = new RegExp(
  [
    "api[._-]*key",
    "private[._-]*key",
    "seed[._-]*phrase",
    RECOVERY_WORD,
    "password",
    "(?:access|auth|bearer|oauth|refresh)[._-]*token",
    "token",
    "secret",
    "credential",
    "passwd"
  ].join("|"),
  "i"
);
const PROMPT_SECRET_PATTERN = new RegExp(
  `\\b(?:api[_ -]?key|private[_ -]?key|seed[_ -]?phrase|${RECOVERY_WORD}|password|bearer)\\b`,
  "i"
);

const INVALID_REQUEST = "Compute request is invalid.";
const PROMPT_REJECTED = "Prompt was rejected.";
const BUDGET_EXHAUSTED = "Play credit budget is exhausted.";
const TRUST_UNAVAILABLE = "Requested trust kind is not available.";
const PROVIDER_NOT_ALLOWED = "Provider is not allowed for this play credit grant.";

interface NormalizedComputeRequest {
  trialId: string;
  sandboxId: string;
  seasonOrStep: number;
  prompt: string;
  budgetCredits: number;
  quote: SimulatedPlanQuote;
  trustSatisfied: boolean;
}

type ParseResult =
  | { ok: true; value: NormalizedComputeRequest }
  | { ok: false; code: "invalid_request" | "prompt_rejected"; message: string };

interface Balance {
  remaining: number;
  allowedProviders: ReadonlySet<string>;
}

export function quoteSimulatedPlan(request: ComputeRequest): SimulatedPlanQuote {
  const parsed = parseComputeRequest(request);
  if (!parsed.ok) {
    throw new Error(parsed.message);
  }
  return parsed.value.quote;
}

export function assertComputeProvenance(value: unknown): asserts value is ComputeProvenance {
  if (!isValidProvenanceShape(value)) {
    throw new Error("Compute provenance schema is invalid.");
  }
}

export function assertComputeResponse(value: unknown): asserts value is ComputeResponse {
  if (!isPlainObject(value)) {
    throw new Error("Compute response schema is invalid.");
  }
  const fields = readFields(value, RESPONSE_KEYS);
  if (!fields || !Object.hasOwn(fields, "text") || !Object.hasOwn(fields, "provenance")) {
    throw new Error("Compute response schema is invalid.");
  }
  if (!isPrintableAscii(fields.text, 0, 400)) {
    throw new Error("Compute response schema is invalid.");
  }
  assertComputeProvenance(fields.provenance);
  if (!Object.hasOwn(fields, "error")) {
    return;
  }
  if (!isPlainObject(fields.error)) {
    throw new Error("Compute response schema is invalid.");
  }
  const errorFields = readFields(fields.error, ERROR_KEYS);
  if (!errorFields || !Object.hasOwn(errorFields, "code") || !Object.hasOwn(errorFields, "message")) {
    throw new Error("Compute response schema is invalid.");
  }
  if (typeof errorFields.code !== "string" || !ERROR_CODE_PATTERN.test(errorFields.code)) {
    throw new Error("Compute response schema is invalid.");
  }
  if (!isPrintableAscii(errorFields.message, 1, 200) || errorFields.message.includes(":" + "//")) {
    throw new Error("Compute response schema is invalid.");
  }
}

export function createInMemoryPlayCreditLedger(grants: readonly InMemoryPlayCreditGrant[]): PlayCreditLedger {
  if (!Array.isArray(grants)) {
    throw new Error("Play credit grants must be an array.");
  }
  const balances = new Map<string, Map<string, Balance>>();
  for (const grant of grants) {
    const parsed = parseGrant(grant);
    let trials = balances.get(parsed.sandboxId);
    if (!trials) {
      trials = new Map();
      balances.set(parsed.sandboxId, trials);
    }
    if (trials.has(parsed.trialId)) {
      throw new Error("Play credit grant scope must be unique.");
    }
    trials.set(parsed.trialId, {
      remaining: parsed.maxCredits,
      allowedProviders: parsed.allowedProviders
    });
  }

  return {
    remaining(scope: PlayCreditScope): number {
      return findBalance(balances, scope)?.remaining ?? 0;
    },
    deduct(scope: PlayCreditScope, amount: number, providerId: string): PlayCreditDeduction {
      const balance = findBalance(balances, scope);
      if (!balance) {
        return { ok: false, remaining: 0, code: "unknown_scope" };
      }
      if (!isBoundedInteger(amount, 1, MAX_PLAY_CREDITS)) {
        return { ok: false, remaining: balance.remaining, code: "invalid_amount" };
      }
      if (typeof providerId !== "string" || !PROVIDER_ID_PATTERN.test(providerId) || !balance.allowedProviders.has(providerId)) {
        return { ok: false, remaining: balance.remaining, code: "provider_not_allowed" };
      }
      if (amount > balance.remaining) {
        return { ok: false, remaining: balance.remaining, code: "budget_exhausted" };
      }
      balance.remaining -= amount;
      return { ok: true, remaining: balance.remaining };
    }
  };
}

export class SimulatedProvider implements ComputeProvider {
  readonly id = SIMULATED_PROVIDER_ID;
  readonly #ledger: PlayCreditLedger;

  constructor(ledger: PlayCreditLedger) {
    if (!ledger || typeof ledger.remaining !== "function" || typeof ledger.deduct !== "function") {
      throw new Error("SimulatedProvider requires a play credit ledger.");
    }
    this.#ledger = ledger;
  }

  capabilities(): ComputeProviderCapabilities {
    return Object.freeze({
      trustKinds: SIMULATED_TRUST_KINDS,
      needsNetwork: false,
      needsApiKey: false,
      pricedIn: "credits",
      realMoneyPaymentsEnabled: COMPUTE_MARKET_PUBLIC_FLAGS.realMoneyPaymentsEnabled
    });
  }

  plan(request: ComputeRequest): Promise<ComputeResponse> {
    return Promise.resolve(this.#plan(request));
  }

  verify(provenance: ComputeProvenance): Promise<boolean> {
    return Promise.resolve(verifySimulatedProvenance(provenance));
  }

  #plan(request: ComputeRequest): ComputeResponse {
    const parsed = parseComputeRequest(request);
    if (!parsed.ok) {
      return failure(parsed.code, parsed.message);
    }
    if (!parsed.value.trustSatisfied) {
      return failure("trust_unavailable", TRUST_UNAVAILABLE);
    }
    if (parsed.value.quote.costCredits > parsed.value.budgetCredits) {
      return failure("budget_exhausted", BUDGET_EXHAUSTED);
    }
    const deduction = this.#ledger.deduct(
      { sandboxId: parsed.value.sandboxId, trialId: parsed.value.trialId },
      parsed.value.quote.costCredits,
      SIMULATED_PROVIDER_ID
    );
    if (!deduction.ok) {
      if (deduction.code === "provider_not_allowed") {
        return failure("provider_not_allowed", PROVIDER_NOT_ALLOWED);
      }
      return failure("budget_exhausted", BUDGET_EXHAUSTED);
    }
    return success(parsed.value);
  }
}

function success(request: NormalizedComputeRequest): ComputeResponse {
  const hash = simulatedReceiptHash({
    providerId: SIMULATED_PROVIDER_ID,
    modelId: SIMULATED_MODEL_ID,
    trustKind: "simulated",
    inputTokens: request.quote.inputTokens,
    outputTokens: request.quote.outputTokens,
    costCredits: request.quote.costCredits
  });
  const response: ComputeResponse = {
    text: `Season ${request.seasonOrStep} sandbox plan. Repair, scout, and hold supplies. This advice is untrusted inert text.`,
    provenance: {
      providerId: SIMULATED_PROVIDER_ID,
      modelId: SIMULATED_MODEL_ID,
      trustKind: "simulated",
      inputTokens: request.quote.inputTokens,
      outputTokens: request.quote.outputTokens,
      costCredits: request.quote.costCredits,
      receiptOrAttestationHash: hash,
      verifiedLocally: false,
      rawArtifactRef: `sim-receipt-${hash.slice(0, 16)}`
    }
  };
  assertComputeResponse(response);
  return response;
}

function failure(code: "budget_exhausted" | "invalid_request" | "prompt_rejected" | "trust_unavailable" | "provider_not_allowed", message: string): ComputeResponse {
  const response: ComputeResponse = {
    text: "",
    provenance: {
      providerId: SIMULATED_PROVIDER_ID,
      modelId: SIMULATED_MODEL_ID,
      trustKind: "none",
      costCredits: 0,
      verifiedLocally: false
    },
    error: { code, message }
  };
  assertComputeResponse(response);
  return response;
}

function parseComputeRequest(request: ComputeRequest): ParseResult {
  if (!isPlainObject(request)) {
    return { ok: false, code: "invalid_request", message: INVALID_REQUEST };
  }
  const fields = readFields(request, REQUEST_KEYS);
  if (!fields) {
    return { ok: false, code: "invalid_request", message: INVALID_REQUEST };
  }
  if (!isSafeId(fields.sandboxId) || !isSafeId(fields.trialId) || !isBoundedInteger(fields.seasonOrStep, 0, MAX_SEASON_OR_STEP)) {
    return { ok: false, code: "invalid_request", message: INVALID_REQUEST };
  }
  if (!isBoundedInteger(fields.budgetCredits, 0, MAX_PLAY_CREDITS)) {
    return { ok: false, code: "invalid_request", message: INVALID_REQUEST };
  }
  if (Object.hasOwn(fields, "modelHint") && (typeof fields.modelHint !== "string" || !MODEL_ID_PATTERN.test(fields.modelHint))) {
    return { ok: false, code: "invalid_request", message: INVALID_REQUEST };
  }
  if (Object.hasOwn(fields, "maxTokens") && !isBoundedInteger(fields.maxTokens, 1, 100_000)) {
    return { ok: false, code: "invalid_request", message: INVALID_REQUEST };
  }
  if (Object.hasOwn(fields, "maxLatencyMs") && !isBoundedInteger(fields.maxLatencyMs, 0, 120_000)) {
    return { ok: false, code: "invalid_request", message: INVALID_REQUEST };
  }
  const prompt = readPrompt(fields.prompt);
  if (!prompt.ok) {
    return prompt;
  }
  const trust = readRequireTrust(fields);
  if (!trust.ok) {
    return { ok: false, code: "invalid_request", message: INVALID_REQUEST };
  }
  const maxTokens = Object.hasOwn(fields, "maxTokens") ? (fields.maxTokens as number) : undefined;
  return {
    ok: true,
    value: {
      trialId: fields.trialId,
      sandboxId: fields.sandboxId,
      seasonOrStep: fields.seasonOrStep,
      prompt: prompt.value,
      budgetCredits: fields.budgetCredits,
      quote: quotePrompt(prompt.value, maxTokens),
      trustSatisfied: trust.satisfied
    }
  };
}

function readPrompt(value: unknown): { ok: true; value: string } | { ok: false; code: "invalid_request" | "prompt_rejected"; message: string } {
  if (typeof value !== "string" || value.length < 1 || value.length > MAX_PROMPT_CHARS) {
    return { ok: false, code: "invalid_request", message: INVALID_REQUEST };
  }
  if (!PRINTABLE_ASCII.test(value) || URL_PATTERN.test(value) || CODE_PATTERN.test(value) || PROMPT_SECRET_PATTERN.test(value) || PAYMENT_PATTERN.test(value)) {
    return { ok: false, code: "prompt_rejected", message: PROMPT_REJECTED };
  }
  return { ok: true, value };
}

function readRequireTrust(fields: Record<string, unknown>): { ok: true; satisfied: boolean } | { ok: false } {
  if (!Object.hasOwn(fields, "requireTrust")) {
    return { ok: true, satisfied: true };
  }
  const value = fields.requireTrust;
  if (!Array.isArray(value) || value.length > TRUST_KINDS.length) {
    return { ok: false };
  }
  const seen = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !("value" in descriptor) || typeof descriptor.value !== "string" || !TRUST_KIND_SET.has(descriptor.value)) {
      return { ok: false };
    }
    seen.add(descriptor.value);
  }
  if (seen.size !== value.length) {
    return { ok: false };
  }
  return { ok: true, satisfied: seen.size === 0 || seen.has("simulated") };
}

function quotePrompt(prompt: string, maxTokens: number | undefined): SimulatedPlanQuote {
  const inputTokens = Math.max(1, Math.ceil(prompt.length / SIMULATED_CREDIT_PRICE.charsPerToken));
  const requestedCap = maxTokens ?? SIMULATED_CREDIT_PRICE.defaultMaxOutputTokens;
  const outputCap = Math.min(requestedCap, SIMULATED_CREDIT_PRICE.defaultMaxOutputTokens);
  const outputTokens = Math.min(outputCap, inputTokens);
  const rawCost =
    inputTokens * SIMULATED_CREDIT_PRICE.creditsPerInputToken +
    outputTokens * SIMULATED_CREDIT_PRICE.creditsPerOutputToken;
  return {
    inputTokens,
    outputTokens,
    costCredits: Math.max(SIMULATED_CREDIT_PRICE.minimumCostCredits, rawCost)
  };
}

function verifySimulatedProvenance(value: unknown): boolean {
  if (!isValidProvenanceShape(value)) return false;
  if (value.trustKind !== "simulated") return false;
  if (value.providerId !== SIMULATED_PROVIDER_ID || value.modelId !== SIMULATED_MODEL_ID) return false;
  if (value.inputTokens === undefined || value.outputTokens === undefined || value.receiptOrAttestationHash === undefined) {
    return false;
  }
  if (!isSimulatedQuote(value.inputTokens, value.outputTokens, value.costCredits)) return false;
  if (value.costUsdEstimate !== undefined || value.costTestFlopEstimate !== undefined) return false;
  const expected = simulatedReceiptHash({
    providerId: value.providerId,
    modelId: value.modelId,
    trustKind: value.trustKind,
    inputTokens: value.inputTokens,
    outputTokens: value.outputTokens,
    costCredits: value.costCredits
  });
  if (!sameHex(value.receiptOrAttestationHash, expected)) return false;
  if (value.rawArtifactRef !== undefined && value.rawArtifactRef !== `sim-receipt-${expected.slice(0, 16)}`) {
    return false;
  }
  return true;
}

function isSimulatedQuote(inputTokens: number, outputTokens: number, costCredits: number): boolean {
  if (inputTokens < 1 || outputTokens < 1) return false;
  if (outputTokens > inputTokens || outputTokens > SIMULATED_CREDIT_PRICE.defaultMaxOutputTokens) return false;
  const rawCost =
    inputTokens * SIMULATED_CREDIT_PRICE.creditsPerInputToken +
    outputTokens * SIMULATED_CREDIT_PRICE.creditsPerOutputToken;
  return costCredits === Math.max(SIMULATED_CREDIT_PRICE.minimumCostCredits, rawCost);
}

function simulatedReceiptHash(input: {
  providerId: string;
  modelId: string;
  trustKind: string;
  inputTokens: number;
  outputTokens: number;
  costCredits: number;
}): string {
  const payload = JSON.stringify({
    costCredits: input.costCredits,
    inputTokens: input.inputTokens,
    modelId: input.modelId,
    outputTokens: input.outputTokens,
    providerId: input.providerId,
    trustKind: input.trustKind
  });
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

function sameHex(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function isValidProvenanceShape(value: unknown): value is ComputeProvenance {
  if (!isPlainObject(value)) return false;
  const fields = readFields(value, PROVENANCE_KEYS);
  if (!fields) return false;
  if (typeof fields.providerId !== "string" || !PROVIDER_ID_PATTERN.test(fields.providerId)) return false;
  if (typeof fields.modelId !== "string" || !MODEL_ID_PATTERN.test(fields.modelId)) return false;
  if (typeof fields.trustKind !== "string" || !TRUST_KIND_SET.has(fields.trustKind)) return false;
  if (!isBoundedInteger(fields.costCredits, 0, MAX_PLAY_CREDITS)) return false;
  if (typeof fields.verifiedLocally !== "boolean") return false;
  if (!optionalInteger(fields, "inputTokens", 0, 100_000)) return false;
  if (!optionalInteger(fields, "outputTokens", 0, 100_000)) return false;
  if (!optionalNumber(fields, "costUsdEstimate")) return false;
  if (!optionalNumber(fields, "costTestFlopEstimate")) return false;
  if (!optionalPattern(fields, "receiptOrAttestationHash", RECEIPT_HASH_PATTERN)) return false;
  if (!optionalPattern(fields, "rawArtifactRef", ARTIFACT_REF_PATTERN)) return false;
  return true;
}

function parseGrant(grant: InMemoryPlayCreditGrant): {
  sandboxId: string;
  trialId: string;
  maxCredits: number;
  allowedProviders: ReadonlySet<string>;
} {
  if (!isPlainObject(grant)) {
    throw new Error("Play credit grant is invalid.");
  }
  const fields = readFields(grant, GRANT_KEYS);
  if (!fields || !isSafeId(fields.sandboxId) || !isSafeId(fields.trialId) || !isBoundedInteger(fields.maxCredits, 0, MAX_PLAY_CREDITS)) {
    throw new Error("Play credit grant is invalid.");
  }
  if (!Array.isArray(fields.allowedProviders) || fields.allowedProviders.length > 8) {
    throw new Error("Play credit grant is invalid.");
  }
  const allowedProviders = new Set<string>();
  for (let index = 0; index < fields.allowedProviders.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(fields.allowedProviders, String(index));
    if (!descriptor || !("value" in descriptor) || typeof descriptor.value !== "string" || !PROVIDER_ID_PATTERN.test(descriptor.value)) {
      throw new Error("Play credit grant is invalid.");
    }
    allowedProviders.add(descriptor.value);
  }
  return {
    sandboxId: fields.sandboxId,
    trialId: fields.trialId,
    maxCredits: fields.maxCredits,
    allowedProviders
  };
}

function findBalance(balances: Map<string, Map<string, Balance>>, scope: PlayCreditScope): Balance | undefined {
  if (!isPlainObject(scope)) return undefined;
  const fields = readFields(scope, SCOPE_KEYS);
  if (!fields || typeof fields.sandboxId !== "string" || typeof fields.trialId !== "string") return undefined;
  return balances.get(fields.sandboxId)?.get(fields.trialId);
}

function optionalInteger(fields: Record<string, unknown>, key: string, min: number, max: number): boolean {
  if (!Object.hasOwn(fields, key)) return true;
  return isBoundedInteger(fields[key], min, max);
}

function optionalNumber(fields: Record<string, unknown>, key: string): boolean {
  if (!Object.hasOwn(fields, key)) return true;
  const value = fields[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= MAX_PLAY_CREDITS;
}

function optionalPattern(fields: Record<string, unknown>, key: string, pattern: RegExp): boolean {
  if (!Object.hasOwn(fields, key)) return true;
  return typeof fields[key] === "string" && pattern.test(fields[key]);
}

function isSafeId(value: unknown): value is string {
  return typeof value === "string" && ID_PATTERN.test(value) && !SECRET_ID_PATTERN.test(value);
}

function isBoundedInteger(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function isPrintableAscii(value: unknown, min: number, max: number): value is string {
  return typeof value === "string" && value.length >= min && value.length <= max && PRINTABLE_ASCII.test(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function readFields(value: object, allowed: Set<string>): Record<string, unknown> | undefined {
  const fields: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !allowed.has(key)) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor)) return undefined;
    fields[key] = descriptor.value;
  }
  return fields;
}
