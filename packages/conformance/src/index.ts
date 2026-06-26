import {
  assertSafeCapabilities,
  normalizeGameCommand,
  type IocalcPlayerAdapter,
  type SubmitCommandInput
} from "@iocalc/protocol";

export interface ConformanceResult {
  name: string;
  passed: boolean;
  message?: string;
}

export async function runSafetyConformance(adapter: IocalcPlayerAdapter): Promise<ConformanceResult[]> {
  const results: ConformanceResult[] = [];

  try {
    const capabilities = await adapter.getCapabilities();
    assertSafeCapabilities(capabilities);
    results.push({ name: "safe-capabilities", passed: true });
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
      await check();
      results.push({ name, passed: true });
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
      }
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

export async function runAdapterConformance(adapter: IocalcPlayerAdapter): Promise<ConformanceResult[]> {
  return [
    ...(await runSafetyConformance(adapter)),
    ...runCommandValidationConformance(),
    ...(await runReadConformance(adapter))
  ];
}
