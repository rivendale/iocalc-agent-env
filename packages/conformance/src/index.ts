import { assertSafeCapabilities, type IocalcPlayerAdapter } from "@iocalc/protocol";

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

export async function runAdapterConformance(adapter: IocalcPlayerAdapter): Promise<ConformanceResult[]> {
  return [
    ...(await runSafetyConformance(adapter)),
    ...(await runReadConformance(adapter))
  ];
}
