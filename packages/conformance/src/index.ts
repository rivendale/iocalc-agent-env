import {
  assertSafeCapabilities,
  assertSandboxAuditEvent,
  assertSandboxBoundaryDecision,
  normalizeGameCommand,
  type IocalcAuditEvent,
  type IocalcBoundaryDecision,
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

function boundaryResults(name: string, payload: unknown): ConformanceResult[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const record = payload as { boundary?: unknown; audit?: unknown };
  const results: ConformanceResult[] = [];

  if ("boundary" in record) {
    results.push(checkBoundary(`${name}-boundary`, record.boundary));
  }

  if ("audit" in record) {
    const audits = Array.isArray(record.audit) ? record.audit : [record.audit];
    audits.forEach((audit, index) => {
      results.push(checkAuditEvent(`${name}-audit-${index}`, audit));
    });
  }

  return results;
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

export async function runReadConformance(adapter: IocalcPlayerAdapter): Promise<ConformanceResult[]> {
  const checks: Array<[string, () => Promise<unknown>]> = [
    ["get-state", () => adapter.getState()],
    ["get-report", () => adapter.getReport()],
    ["get-log", () => adapter.getLog()],
    ["get-match-history", () => adapter.getMatchHistory()]
  ];

  const results: ConformanceResult[] = [];
  for (const [name, check] of checks) {
    try {
      const payload = await check();
      results.push({ name, passed: true });
      results.push(...boundaryResults(name, payload));
    } catch (error) {
      results.push({ name, passed: false, message: error instanceof Error ? error.message : String(error) });
    }
  }
  return results;
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
  }
): Promise<ConformanceResult[]> {
  try {
    const result = await adapter.resolveSeason(input);
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

export async function runAdapterConformance(adapter: IocalcPlayerAdapter): Promise<ConformanceResult[]> {
  return [
    ...(await runSafetyConformance(adapter)),
    ...runCommandValidationConformance(),
    ...(await runReadConformance(adapter)),
    ...(await runSubmitCommandConformance(adapter)),
    ...(await runResolveSeasonConformance(adapter)),
    ...(await runAgentTrialConformance(adapter))
  ];
}
