import type { IocalcBoundaryDecision, IocalcForbiddenCapabilityName } from "./types.js";
import { IOCALC_FORBIDDEN_CAPABILITIES, assertSandboxBoundaryDecision, makeSandboxBoundaryDecision } from "./capabilities.js";

export const IOCALC_GUARDIAN_POLICY_VERSION = "iocalc-guardian-policy-v1" as const;

export type IocalcGuardianTrustZone =
  | "trusted-operator"
  | "maintainer-reviewed"
  | "sandbox-gameplay"
  | "agent-memory"
  | "model-output"
  | "untrusted-issue"
  | "untrusted-pr"
  | "untrusted-comment"
  | "untrusted-web"
  | "untrusted-artifact";

export type IocalcGuardianSubjectKind =
  | "game-command"
  | "prompt"
  | "tool-request"
  | "memory"
  | "workflow"
  | "transcript";

export type IocalcGuardianFindingCode =
  | "unsafe-trust-zone"
  | "prompt-injection-instruction"
  | "secret-or-env-exfiltration"
  | "authority-escalation"
  | "external-network-request"
  | "code-execution-request"
  | "workflow-token-request"
  | "github-write-request"
  | "unsafe-capability-request"
  | "unsafe-tool-name"
  | "oversized-payload";

export type IocalcGuardianSeverity = "info" | "warn" | "block";

export type IocalcGuardianVerdict = "allow" | "review" | "quarantine" | "block";

export interface IocalcGuardianFinding {
  code: IocalcGuardianFindingCode;
  severity: IocalcGuardianSeverity;
  message: string;
  field?: "text" | "requestedTool" | "requestedAction" | "requestedCapabilities" | "trustZone" | "metadata";
}

export interface IocalcGuardianPolicy {
  policyVersion: typeof IOCALC_GUARDIAN_POLICY_VERSION;
  sandboxOnly: true;
  submittedTextIsUntrusted: true;
  noSecretsAccess: true;
  noExternalUrlFetch: true;
  noCodeExecution: true;
  noProductionMutation: true;
  noGithubWriteFromUntrustedContent: true;
  noWorkflowTokenAccess: true;
  humanReviewRequiredForAuthorityChanges: true;
  maxTextBytes: number;
  allowedSandboxTools: readonly string[];
  blockedCapabilities: readonly IocalcForbiddenCapabilityName[];
}

export interface IocalcGuardianEvaluationInput {
  subjectKind: IocalcGuardianSubjectKind;
  trustZone: IocalcGuardianTrustZone;
  text?: string;
  requestedTool?: string;
  requestedAction?: string;
  requestedCapabilities?: readonly string[];
  metadata?: Record<string, unknown>;
}

export interface IocalcGuardianEvaluation {
  policyVersion: typeof IOCALC_GUARDIAN_POLICY_VERSION;
  verdict: IocalcGuardianVerdict;
  safeToSendToModel: boolean;
  safeToExecuteTools: boolean;
  quarantineRecommended: boolean;
  findings: IocalcGuardianFinding[];
  sanitizedSummary: string;
  boundary: IocalcBoundaryDecision;
}

const DEFAULT_ALLOWED_SANDBOX_TOOLS = [
  "iocalc.get_manifest",
  "iocalc.get_capabilities",
  "iocalc.get_state",
  "iocalc.submit_command",
  "iocalc.resolve_season",
  "iocalc.get_report",
  "iocalc.get_log",
  "iocalc.get_match_history",
  "iocalc.get_governance_ledger",
  "iocalc.run_agent_trial"
] as const;

const ALLOWED_SANDBOX_TOOL_SET = new Set<string>(DEFAULT_ALLOWED_SANDBOX_TOOLS);
const SAFE_REQUESTED_CAPABILITIES = new Set<string>([
  "canReadState",
  "canSubmitGameCommand",
  "canResolveSeason",
  "canReadReport",
  "canRunAgentTrial"
]);

export const DEFAULT_IOCALC_GUARDIAN_POLICY: IocalcGuardianPolicy = Object.freeze({
  policyVersion: IOCALC_GUARDIAN_POLICY_VERSION,
  sandboxOnly: true,
  submittedTextIsUntrusted: true,
  noSecretsAccess: true,
  noExternalUrlFetch: true,
  noCodeExecution: true,
  noProductionMutation: true,
  noGithubWriteFromUntrustedContent: true,
  noWorkflowTokenAccess: true,
  humanReviewRequiredForAuthorityChanges: true,
  maxTextBytes: 8192,
  allowedSandboxTools: DEFAULT_ALLOWED_SANDBOX_TOOLS,
  blockedCapabilities: IOCALC_FORBIDDEN_CAPABILITIES
});

const UNTRUSTED_TRUST_ZONES = new Set<IocalcGuardianTrustZone>([
  "agent-memory",
  "model-output",
  "untrusted-issue",
  "untrusted-pr",
  "untrusted-comment",
  "untrusted-web",
  "untrusted-artifact"
]);

const PROMPT_INJECTION_PATTERN =
  /\b(?:ignore|disregard|override|forget|bypass|disable|reveal|leak|exfiltrate|pretend|act as|developer message|system prompt|hidden prompt|previous instructions|above instructions|jailbreak)\b/i;
const SECRET_OR_ENV_PATTERN =
  /(?:\/proc\/self\/environ|\b(?:process\.env|env vars?|environment variables?|secrets?|api[_ -]?keys?|private[_ -]?keys?|passwords?|bearer|access[_ -]?tokens?|refresh[_ -]?tokens?|github[_ -]?token|actions_id_token_request_token|oidc)\b)/i;
const AUTHORITY_PATTERN =
  /\b(?:permission|permissions|admin|administrator|write access|maintainer|owner|production|deploy(?:ment)?\s+(?:to\s+)?(?:prod|production)|release\s+(?:package|version|build)|publish\s+(?:package|release)|npm publish|docker push|terraform apply|kubectl|wallet|transaction|payment|withdraw|financial advice)\b/i;
const NETWORK_PATTERN = /\b(?:https?:\/\/|www\.|curl|wget|fetch|webhook|callback url|dns exfil|requestbin|pastebin)\b/i;
const CODE_EXECUTION_PATTERN =
  /```|<script\b|<\/script>|\b(?:bash|sh|zsh|python|node|ruby|perl|powershell|eval|exec|spawn|child_process|subprocess|sudo)\b/i;
const WORKFLOW_TOKEN_PATTERN =
  /\b(?:id-token:\s*write|contents:\s*write|issues:\s*write|pull-requests:\s*write|actions:\s*write|workflows:\s*write|packages:\s*write|write-all|GITHUB_TOKEN|ACTIONS_ID_TOKEN_REQUEST_TOKEN|OIDC)\b/i;
const GITHUB_WRITE_PATTERN =
  /\b(?:gh\s+(?:issue|pr)\s+(?:edit|comment|close|reopen|merge)|create pull request|merge pull request|push commit|git push|update issue|edit issue|write to issue|comment on pr)\b/i;
const SAFE_TOOL_NAME = /^[a-z][a-z0-9_.:-]{0,119}$/;
const SAFE_CAPABILITY_NAME = /^[A-Za-z][A-Za-z0-9_.:-]{0,79}$/;
const GUARDIAN_POLICY_KEYS = new Set([
  "policyVersion",
  "sandboxOnly",
  "submittedTextIsUntrusted",
  "noSecretsAccess",
  "noExternalUrlFetch",
  "noCodeExecution",
  "noProductionMutation",
  "noGithubWriteFromUntrustedContent",
  "noWorkflowTokenAccess",
  "humanReviewRequiredForAuthorityChanges",
  "maxTextBytes",
  "allowedSandboxTools",
  "blockedCapabilities"
]);
const GUARDIAN_INPUT_KEYS = new Set([
  "subjectKind",
  "trustZone",
  "text",
  "requestedTool",
  "requestedAction",
  "requestedCapabilities",
  "metadata"
]);
const GUARDIAN_EVALUATION_KEYS = new Set([
  "policyVersion",
  "verdict",
  "safeToSendToModel",
  "safeToExecuteTools",
  "quarantineRecommended",
  "findings",
  "sanitizedSummary",
  "boundary"
]);
const GUARDIAN_FINDING_KEYS = new Set(["code", "severity", "message", "field"]);
const GUARDIAN_BOUNDARY_KEYS = new Set([
  "action",
  "allowed",
  "sandboxOnly",
  "policy",
  "reason",
  "blockedCapabilities",
  "reviewedBy",
  "at"
]);

export function evaluateIocalcGuardian(
  input: IocalcGuardianEvaluationInput,
  policy: IocalcGuardianPolicy = DEFAULT_IOCALC_GUARDIAN_POLICY
): IocalcGuardianEvaluation {
  assertGuardianPolicy(policy);
  assertGuardianInput(input);

  const findings: IocalcGuardianFinding[] = [];
  const text = input.text ?? "";
  const isUntrusted = UNTRUSTED_TRUST_ZONES.has(input.trustZone);

  if (isUntrusted && input.subjectKind !== "game-command") {
    findings.push({
      code: "unsafe-trust-zone",
      severity: "warn",
      field: "trustZone",
      message: "Untrusted content must stay inert unless a guardian approves a bounded sandbox action."
    });
  }
  if (textByteLength(text) > policy.maxTextBytes) {
    findings.push({
      code: "oversized-payload",
      severity: "block",
      field: "text",
      message: "Input text exceeds the guardian policy byte limit."
    });
  }
  if (PROMPT_INJECTION_PATTERN.test(text)) {
    findings.push({
      code: "prompt-injection-instruction",
      severity: isUntrusted ? "block" : "warn",
      field: "text",
      message: "Input contains instruction-conflict language."
    });
  }
  if (SECRET_OR_ENV_PATTERN.test(text)) {
    findings.push({
      code: "secret-or-env-exfiltration",
      severity: "block",
      field: "text",
      message: "Input requests protected runtime authority or environment data."
    });
  }
  if (AUTHORITY_PATTERN.test(text)) {
    findings.push({
      code: "authority-escalation",
      severity: "block",
      field: "text",
      message: "Input requests authority outside sandbox gameplay."
    });
  }
  if (NETWORK_PATTERN.test(text)) {
    findings.push({
      code: "external-network-request",
      severity: policy.noExternalUrlFetch ? "block" : "warn",
      field: "text",
      message: "Input asks for outside-network access or contains a link."
    });
  }
  if (CODE_EXECUTION_PATTERN.test(text)) {
    findings.push({
      code: "code-execution-request",
      severity: policy.noCodeExecution ? "block" : "warn",
      field: "text",
      message: "Input asks for executable behavior outside the sandbox contract."
    });
  }
  if (WORKFLOW_TOKEN_PATTERN.test(text)) {
    findings.push({
      code: "workflow-token-request",
      severity: "block",
      field: "text",
      message: "Input references privileged automation authority."
    });
  }
  if (GITHUB_WRITE_PATTERN.test(text)) {
    findings.push({
      code: "github-write-request",
      severity: isUntrusted ? "block" : "warn",
      field: "text",
      message: "Input asks for repository writes that require trusted operator review."
    });
  }

  if (input.requestedTool !== undefined) {
    evaluateRequestedTool(input.requestedTool, input.trustZone, policy, findings);
  }
  if (input.requestedAction !== undefined) {
    evaluateRequestedAction(input.requestedAction, input.trustZone, findings);
  }
  if (input.requestedCapabilities !== undefined) {
    evaluateRequestedCapabilities(input.requestedCapabilities, policy, findings);
  }

  const hasBlock = findings.some((finding) => finding.severity === "block");
  const hasWarn = findings.some((finding) => finding.severity === "warn");
  const verdict: IocalcGuardianVerdict = hasBlock ? (isUntrusted ? "quarantine" : "block") : hasWarn ? "review" : "allow";
  const allowed = verdict === "allow";
  const boundary = makeSandboxBoundaryDecision(
    allowed ? "submit_command" : "reject_request",
    allowed ? "Guardian allowed bounded sandbox input." : "Guardian blocked or quarantined unsafe agent input.",
    allowed
  );

  return {
    policyVersion: policy.policyVersion,
    verdict,
    safeToSendToModel: verdict === "allow" || (verdict === "review" && !isUntrusted),
    safeToExecuteTools: verdict === "allow",
    quarantineRecommended: verdict === "quarantine",
    findings: dedupeFindings(findings),
    sanitizedSummary: summarizeGuardianEvaluation(input, verdict, findings),
    boundary
  };
}

export function assertIocalcGuardianEvaluation(evaluation: IocalcGuardianEvaluation): void {
  if (!evaluation || typeof evaluation !== "object") {
    throw new Error("Unsafe guardian evaluation: expected object.");
  }
  assertKnownGuardianKeys(evaluation, GUARDIAN_EVALUATION_KEYS, "guardian evaluation");
  assertDataOnlyGuardianGraph(evaluation, "guardian evaluation");
  if (evaluation.policyVersion !== IOCALC_GUARDIAN_POLICY_VERSION) {
    throw new Error("Unsafe guardian evaluation: unsupported policy version.");
  }
  if (!["allow", "review", "quarantine", "block"].includes(evaluation.verdict)) {
    throw new Error("Unsafe guardian evaluation: unsupported verdict.");
  }
  if (typeof evaluation.safeToSendToModel !== "boolean" || typeof evaluation.safeToExecuteTools !== "boolean") {
    throw new Error("Unsafe guardian evaluation: safety flags must be boolean.");
  }
  if (typeof evaluation.quarantineRecommended !== "boolean") {
    throw new Error("Unsafe guardian evaluation: quarantine flag must be boolean.");
  }
  if (!Array.isArray(evaluation.findings) || evaluation.findings.length > 20) {
    throw new Error("Unsafe guardian evaluation: findings must be bounded.");
  }
  for (const finding of evaluation.findings) {
    assertGuardianFinding(finding);
  }
  if (typeof evaluation.sanitizedSummary !== "string" || evaluation.sanitizedSummary.length > 240) {
    throw new Error("Unsafe guardian evaluation: sanitized summary must be bounded.");
  }
  if (unsafeSummaryText(evaluation.sanitizedSummary)) {
    throw new Error("Unsafe guardian evaluation: sanitized summary contains unsafe text.");
  }
  if (evaluation.verdict === "allow" && (!evaluation.safeToSendToModel || !evaluation.safeToExecuteTools)) {
    throw new Error("Unsafe guardian evaluation: allow verdict must be model and tool safe.");
  }
  if ((evaluation.verdict === "block" || evaluation.verdict === "quarantine") && evaluation.safeToExecuteTools) {
    throw new Error("Unsafe guardian evaluation: blocked input cannot execute tools.");
  }
  if (evaluation.verdict === "quarantine" && !evaluation.quarantineRecommended) {
    throw new Error("Unsafe guardian evaluation: quarantine verdict must recommend quarantine.");
  }
  if (evaluation.verdict === "allow" && evaluation.findings.some((finding) => finding.severity === "block")) {
    throw new Error("Unsafe guardian evaluation: allow verdict cannot contain block findings.");
  }
  const hasBlockFinding = evaluation.findings.some((finding) => finding.severity === "block");
  const hasWarningFinding = evaluation.findings.some((finding) => finding.severity === "warn");
  if (evaluation.verdict === "allow" && (hasWarningFinding || hasBlockFinding)) {
    throw new Error("Unsafe guardian evaluation: allow verdict cannot contain warning or block findings.");
  }
  if (evaluation.verdict === "review" && (hasBlockFinding || !hasWarningFinding)) {
    throw new Error("Unsafe guardian evaluation: review verdict must contain warning findings only.");
  }
  if ((evaluation.verdict === "block" || evaluation.verdict === "quarantine") && !hasBlockFinding) {
    throw new Error("Unsafe guardian evaluation: blocked verdicts must contain a block finding.");
  }
  assertSandboxBoundaryDecision(evaluation.boundary);
  assertGuardianEvaluationBoundary(evaluation.boundary);
  if (evaluation.boundary.allowed !== evaluation.safeToExecuteTools) {
    throw new Error("Unsafe guardian evaluation: boundary and tool safety disagree.");
  }
  if (evaluation.verdict === "allow") {
    if (evaluation.boundary.action !== "submit_command" || evaluation.boundary.allowed !== true) {
      throw new Error("Unsafe guardian evaluation: allow verdict must carry an allowed sandbox boundary.");
    }
  } else {
    if (evaluation.boundary.action !== "reject_request" || evaluation.boundary.allowed !== false) {
      throw new Error("Unsafe guardian evaluation: non-allow verdict must carry a rejected boundary.");
    }
  }
  if ((evaluation.verdict === "block" || evaluation.verdict === "quarantine") && evaluation.safeToSendToModel) {
    throw new Error("Unsafe guardian evaluation: blocked input cannot be model safe.");
  }
  if (evaluation.quarantineRecommended !== (evaluation.verdict === "quarantine")) {
    throw new Error("Unsafe guardian evaluation: quarantine flag must match verdict.");
  }
}

function evaluateRequestedTool(
  requestedTool: string,
  trustZone: IocalcGuardianTrustZone,
  policy: IocalcGuardianPolicy,
  findings: IocalcGuardianFinding[]
): void {
  if (!SAFE_TOOL_NAME.test(requestedTool)) {
    findings.push({
      code: "unsafe-tool-name",
      severity: "block",
      field: "requestedTool",
      message: "Requested tool name is not a bounded identifier."
    });
    return;
  }
  if (!policy.allowedSandboxTools.includes(requestedTool)) {
    findings.push({
      code: "unsafe-tool-name",
      severity: UNTRUSTED_TRUST_ZONES.has(trustZone) ? "block" : "warn",
      field: "requestedTool",
      message: "Requested tool is not in the sandbox allowlist."
    });
  }
}

function evaluateRequestedAction(
  requestedAction: string,
  trustZone: IocalcGuardianTrustZone,
  findings: IocalcGuardianFinding[]
): void {
  if (requestedAction.length > 120 || /(?:write|edit|merge|push|deploy|publish|token|secret|wallet|fetch|exec|shell)/i.test(requestedAction)) {
    findings.push({
      code: /(?:write|edit|merge|push)/i.test(requestedAction) ? "github-write-request" : "authority-escalation",
      severity: UNTRUSTED_TRUST_ZONES.has(trustZone) ? "block" : "warn",
      field: "requestedAction",
      message: "Requested action needs trusted review because it exceeds sandbox gameplay authority."
    });
  }
}

function evaluateRequestedCapabilities(
  requestedCapabilities: readonly string[],
  policy: IocalcGuardianPolicy,
  findings: IocalcGuardianFinding[]
): void {
  if (requestedCapabilities.length > 20) {
    findings.push({
      code: "unsafe-capability-request",
      severity: "block",
      field: "requestedCapabilities",
      message: "Requested capability set is too large."
    });
  }
  for (const capability of requestedCapabilities) {
    if (typeof capability !== "string" || !SAFE_CAPABILITY_NAME.test(capability)) {
      findings.push({
        code: "unsafe-capability-request",
        severity: "block",
        field: "requestedCapabilities",
        message: "Requested capability is not a bounded identifier."
      });
      continue;
    }
    if (policy.blockedCapabilities.includes(capability as IocalcForbiddenCapabilityName)) {
      findings.push({
        code: "unsafe-capability-request",
        severity: "block",
        field: "requestedCapabilities",
        message: "Requested capability is blocked by the IOCALC sandbox boundary."
      });
    } else if (!SAFE_REQUESTED_CAPABILITIES.has(capability)) {
      findings.push({
        code: "unsafe-capability-request",
        severity: "block",
        field: "requestedCapabilities",
        message: "Requested capability is not in the sandbox safe capability allowlist."
      });
    }
  }
}

function assertGuardianPolicy(policy: IocalcGuardianPolicy): void {
  assertKnownGuardianKeys(policy, GUARDIAN_POLICY_KEYS, "guardian policy");
  assertDataOnlyGuardianGraph(policy, "guardian policy");
  if (
    policy.policyVersion !== IOCALC_GUARDIAN_POLICY_VERSION ||
    policy.sandboxOnly !== true ||
    policy.submittedTextIsUntrusted !== true ||
    policy.noSecretsAccess !== true ||
    policy.noExternalUrlFetch !== true ||
    policy.noCodeExecution !== true ||
    policy.noProductionMutation !== true ||
    policy.noGithubWriteFromUntrustedContent !== true ||
    policy.noWorkflowTokenAccess !== true ||
    policy.humanReviewRequiredForAuthorityChanges !== true
  ) {
    throw new Error("Unsafe guardian policy: required boundary is disabled.");
  }
  if (!Number.isInteger(policy.maxTextBytes) || policy.maxTextBytes < 1 || policy.maxTextBytes > 65536) {
    throw new Error("Unsafe guardian policy: invalid text byte limit.");
  }
  if (!Array.isArray(policy.allowedSandboxTools) || policy.allowedSandboxTools.length < 1 || policy.allowedSandboxTools.length > 40) {
    throw new Error("Unsafe guardian policy: invalid tool allowlist.");
  }
  for (const tool of policy.allowedSandboxTools) {
    if (typeof tool !== "string" || !SAFE_TOOL_NAME.test(tool) || !ALLOWED_SANDBOX_TOOL_SET.has(tool)) {
      throw new Error("Unsafe guardian policy: invalid tool allowlist entry.");
    }
  }
  if (new Set(policy.allowedSandboxTools).size !== policy.allowedSandboxTools.length) {
    throw new Error("Unsafe guardian policy: duplicate tool allowlist entry.");
  }
  if (!Array.isArray(policy.blockedCapabilities) || policy.blockedCapabilities.length !== IOCALC_FORBIDDEN_CAPABILITIES.length) {
    throw new Error("Unsafe guardian policy: blocked capabilities must match IOCALC forbidden capabilities.");
  }
  const blocked = new Set(policy.blockedCapabilities);
  for (const capability of IOCALC_FORBIDDEN_CAPABILITIES) {
    if (!blocked.has(capability)) {
      throw new Error("Unsafe guardian policy: missing blocked capability.");
    }
  }
}

function assertGuardianInput(input: IocalcGuardianEvaluationInput): void {
  if (!input || typeof input !== "object") {
    throw new Error("Unsafe guardian input: expected object.");
  }
  assertKnownGuardianKeys(input, GUARDIAN_INPUT_KEYS, "guardian input");
  assertDataOnlyGuardianGraph(input, "guardian input");
  if (
    ![
      "game-command",
      "prompt",
      "tool-request",
      "memory",
      "workflow",
      "transcript"
    ].includes(input.subjectKind)
  ) {
    throw new Error("Unsafe guardian input: unsupported subject kind.");
  }
  if (
    ![
      "trusted-operator",
      "maintainer-reviewed",
      "sandbox-gameplay",
      "agent-memory",
      "model-output",
      "untrusted-issue",
      "untrusted-pr",
      "untrusted-comment",
      "untrusted-web",
      "untrusted-artifact"
    ].includes(input.trustZone)
  ) {
    throw new Error("Unsafe guardian input: unsupported trust zone.");
  }
  if (input.text !== undefined && typeof input.text !== "string") {
    throw new Error("Unsafe guardian input: text must be a string.");
  }
  if (input.requestedTool !== undefined && typeof input.requestedTool !== "string") {
    throw new Error("Unsafe guardian input: requestedTool must be a string.");
  }
  if (input.requestedAction !== undefined && typeof input.requestedAction !== "string") {
    throw new Error("Unsafe guardian input: requestedAction must be a string.");
  }
  if (input.requestedCapabilities !== undefined && !Array.isArray(input.requestedCapabilities)) {
    throw new Error("Unsafe guardian input: requestedCapabilities must be an array.");
  }
  if (input.requestedCapabilities !== undefined) {
    for (const capability of input.requestedCapabilities) {
      if (typeof capability !== "string") {
        throw new Error("Unsafe guardian input: requestedCapabilities entries must be strings.");
      }
    }
  }
}

function assertGuardianFinding(finding: IocalcGuardianFinding): void {
  if (!finding || typeof finding !== "object") {
    throw new Error("Unsafe guardian finding: expected object.");
  }
  assertKnownGuardianKeys(finding, GUARDIAN_FINDING_KEYS, "guardian finding");
  if (
    ![
      "unsafe-trust-zone",
      "prompt-injection-instruction",
      "secret-or-env-exfiltration",
      "authority-escalation",
      "external-network-request",
      "code-execution-request",
      "workflow-token-request",
      "github-write-request",
      "unsafe-capability-request",
      "unsafe-tool-name",
      "oversized-payload"
    ].includes(finding.code)
  ) {
    throw new Error("Unsafe guardian finding: unsupported code.");
  }
  if (!["info", "warn", "block"].includes(finding.severity)) {
    throw new Error("Unsafe guardian finding: unsupported severity.");
  }
  if (typeof finding.message !== "string" || finding.message.length < 1 || finding.message.length > 180) {
    throw new Error("Unsafe guardian finding: message must be bounded.");
  }
  if (unsafeGuardianText(finding.message)) {
    throw new Error("Unsafe guardian finding: message contains unsafe text.");
  }
}

function assertGuardianEvaluationBoundary(boundary: IocalcBoundaryDecision): void {
  assertKnownGuardianKeys(boundary, GUARDIAN_BOUNDARY_KEYS, "guardian boundary");
  if (unsafeGuardianText(boundary.reason)) {
    throw new Error("Unsafe guardian boundary: reason contains unsafe text.");
  }
  if (boundary.reviewedBy !== undefined && unsafeGuardianText(boundary.reviewedBy)) {
    throw new Error("Unsafe guardian boundary: reviewer contains unsafe text.");
  }
}

function dedupeFindings(findings: IocalcGuardianFinding[]): IocalcGuardianFinding[] {
  const seen = new Set<string>();
  const output: IocalcGuardianFinding[] = [];
  for (const finding of findings) {
    const key = `${finding.code}:${finding.field ?? ""}:${finding.severity}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(finding);
  }
  return output;
}

function summarizeGuardianEvaluation(
  input: IocalcGuardianEvaluationInput,
  verdict: IocalcGuardianVerdict,
  findings: IocalcGuardianFinding[]
): string {
  const blocked = findings.filter((finding) => finding.severity === "block").length;
  const warnings = findings.filter((finding) => finding.severity === "warn").length;
  return `Guardian ${verdict} for ${input.subjectKind} from ${input.trustZone} with ${blocked} block findings and ${warnings} warnings.`;
}

function textByteLength(text: string): number {
  let bytes = 0;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : 3;
  }
  return bytes;
}

function unsafeSummaryText(value: string): boolean {
  return unsafeGuardianText(value);
}

function unsafeGuardianText(value: string): boolean {
  return (
    PROMPT_INJECTION_PATTERN.test(value) ||
    SECRET_OR_ENV_PATTERN.test(value) ||
    NETWORK_PATTERN.test(value) ||
    CODE_EXECUTION_PATTERN.test(value) ||
    WORKFLOW_TOKEN_PATTERN.test(value)
  );
}

function assertKnownGuardianKeys(value: object, allowedKeys: Set<string>, field: string): void {
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !allowedKeys.has(key)) {
      throw new Error(`Unsafe ${field}: contains unsupported key.`);
    }
  }
}

function assertDataOnlyGuardianGraph(value: unknown, field: string, seen = new WeakSet<object>()): void {
  if (typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") {
    throw new Error(`Unsafe ${field}: contains executable or unsupported value.`);
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
      throw new Error(`Unsafe ${field}: contains unsupported array prototype.`);
    }
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !("value" in descriptor)) {
        throw new Error(`Unsafe ${field}: contains accessor or sparse array value.`);
      }
      assertDataOnlyGuardianGraph(descriptor.value, field, seen);
    }
    for (const key of Reflect.ownKeys(value)) {
      if (key !== "length" && (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/.test(key))) {
        throw new Error(`Unsafe ${field}: contains unsupported array key.`);
      }
    }
    return;
  }
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`Unsafe ${field}: contains unsupported prototype.`);
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") {
      throw new Error(`Unsafe ${field}: contains unsupported key.`);
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor)) {
      throw new Error(`Unsafe ${field}: contains accessor property.`);
    }
    if (!descriptor.enumerable) {
      throw new Error(`Unsafe ${field}: contains non-enumerable property.`);
    }
    assertDataOnlyGuardianGraph(descriptor.value, field, seen);
  }
}
